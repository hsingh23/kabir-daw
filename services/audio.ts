import { Clip, Track, ProjectState } from '../types';
import { audioBufferToWav } from './utils';

interface TrackChannel {
    input: GainNode; // Entry point for sources
    lowFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    highFilter: BiquadFilterNode;
    gain: GainNode; // Volume fader
    panner: StereoPannerNode; // Pan
}

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  reverbNode: ConvolverNode;
  delayNode: DelayNode;
  delayGain: GainNode;
  compressor: DynamicsCompressorNode;
  metronomeGain: GainNode;
  
  buffers: Map<string, AudioBuffer> = new Map();
  activeSources: Map<string, AudioBufferSourceNode> = new Map();
  
  // Persistent nodes for each track: ID -> Channel Strip
  trackChannels: Map<string, TrackChannel> = new Map();

  private _isPlaying: boolean = false;
  private _startTime: number = 0;
  private _pauseTime: number = 0;

  // Metronome State
  public bpm: number = 120;
  public metronomeEnabled: boolean = false;
  private nextNoteTime: number = 0;
  private currentBeat: number = 0;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();
    
    // Effects Bus
    this.reverbNode = this.ctx.createConvolver();
    this.delayNode = this.ctx.createDelay();
    this.delayGain = this.ctx.createGain();

    // Metronome
    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.value = 0.5;

    this.setupRouting();
    this.loadImpulseResponse();
  }

  setupRouting() {
    // Master Routing
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Effects Default Settings
    this.delayNode.delayTime.value = 0.4;
    this.delayGain.gain.value = 0.0; // Default dry
    
    // Connect FX to Master
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.masterGain);

    // Connect Metronome directly to destination
    this.metronomeGain.connect(this.masterGain);
  }

  async loadImpulseResponse() {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbNode.buffer = impulse;
  }

  async loadAudio(key: string, blob: Blob): Promise<AudioBuffer> {
    if (this.buffers.has(key)) return this.buffers.get(key)!;

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(key, audioBuffer);
    return audioBuffer;
  }

  getTrackChannel(trackId: string): TrackChannel {
    if (!this.trackChannels.has(trackId)) {
      // 1. Create Nodes
      const input = this.ctx.createGain(); // Entry point
      
      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 320;

      const midFilter = this.ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1.0;

      const highFilter = this.ctx.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 3200;

      const gain = this.ctx.createGain(); // Fader
      const panner = this.ctx.createStereoPanner(); // Pan
      
      // 2. Connect Chain
      input.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
      
      this.trackChannels.set(trackId, { 
          input, 
          lowFilter, 
          midFilter, 
          highFilter, 
          gain, 
          panner 
      });
    }
    return this.trackChannels.get(trackId)!;
  }

  syncTracks(tracks: Track[]) {
    const soloActive = tracks.some(t => t.solo);

    tracks.forEach(track => {
      const channel = this.getTrackChannel(track.id);
      const currentTime = this.ctx.currentTime;
      
      const isMuted = track.muted || (soloActive && !track.solo);
      const targetVolume = isMuted ? 0 : track.volume;

      // Update Gain/Pan
      channel.gain.gain.setTargetAtTime(targetVolume, currentTime, 0.02);
      channel.panner.pan.setTargetAtTime(track.pan, currentTime, 0.02);

      // Update EQ
      if (track.eq) {
          channel.lowFilter.gain.setTargetAtTime(track.eq.low, currentTime, 0.1);
          channel.midFilter.gain.setTargetAtTime(track.eq.mid, currentTime, 0.1);
          channel.highFilter.gain.setTargetAtTime(track.eq.high, currentTime, 0.1);
      }
    });
  }

  play(clips: Clip[], tracks: Track[], startTime: number = 0) {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.stop();
    this._isPlaying = true;
    this._startTime = this.ctx.currentTime - startTime;
    this._pauseTime = startTime;

    const secondsPerBeat = 60.0 / this.bpm;
    this.currentBeat = Math.ceil(startTime / secondsPerBeat);
    const nextBeatTimeRelative = this.currentBeat * secondsPerBeat;
    this.nextNoteTime = this.ctx.currentTime + (nextBeatTimeRelative - startTime);

    this.syncTracks(tracks);

    clips.forEach(clip => {
      const buffer = this.buffers.get(clip.bufferKey);
      if (!buffer) return;

      const channel = this.getTrackChannel(clip.trackId);

      const when = this.ctx.currentTime + (clip.start - startTime);
      const offset = clip.offset;
      const duration = clip.duration;

      if (when < this.ctx.currentTime) {
         const startDiff = startTime - clip.start;
         if (startDiff >= 0 && startDiff < duration) {
            this.scheduleSource(buffer, this.ctx.currentTime, offset + startDiff, duration - startDiff, channel.input, clip, startDiff);
         }
      } else {
         this.scheduleSource(buffer, when, offset, duration, channel.input, clip, 0);
      }
    });
  }

  scheduleSource(
      buffer: AudioBuffer, 
      when: number, 
      offset: number, 
      playDuration: number, 
      destination: AudioNode,
      clip: Clip,
      elapsedClipTime: number,
      ctx: BaseAudioContext = this.ctx
    ) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Envelope Gain for Fades
    const envelope = ctx.createGain();
    source.connect(envelope);
    envelope.connect(destination); // Connect to Track Input (Start of chain)

    // Fade Logic
    const clipFadeIn = clip.fadeIn || 0;
    const clipFadeOut = clip.fadeOut || 0;
    const clipTotalDuration = clip.duration;

    let startGain = 1;
    if (elapsedClipTime < clipFadeIn) {
        startGain = elapsedClipTime / clipFadeIn;
    } else if (elapsedClipTime > clipTotalDuration - clipFadeOut) {
        const timeRemaining = clipTotalDuration - elapsedClipTime;
        startGain = timeRemaining / clipFadeOut;
    }
    
    envelope.gain.setValueAtTime(startGain, when);

    if (elapsedClipTime < clipFadeIn) {
        const timeUntilFull = clipFadeIn - elapsedClipTime;
        envelope.gain.linearRampToValueAtTime(1, when + timeUntilFull);
    }

    const timeUntilFadeOut = (clipTotalDuration - clipFadeOut) - elapsedClipTime;
    if (timeUntilFadeOut > 0) {
        envelope.gain.setValueAtTime(1, when + timeUntilFadeOut);
        envelope.gain.linearRampToValueAtTime(0, when + timeUntilFadeOut + clipFadeOut);
    } else {
        const timeRemaining = playDuration;
        envelope.gain.linearRampToValueAtTime(0, when + timeRemaining);
    }

    if (offset + playDuration > buffer.duration) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
    }

    source.start(when, offset, playDuration);
    if (ctx === this.ctx) {
        this.activeSources.set(clip.id + Math.random(), source as AudioBufferSourceNode);
    }
  }

  stop() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    this.activeSources.clear();
    this._isPlaying = false;
  }

  pause() {
      this.stop();
  }

  setMasterVolume(val: number) {
    this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setDelayLevel(val: number) {
    this.delayGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  getCurrentTime(): number {
      if (!this._isPlaying) return this._pauseTime;
      return this.ctx.currentTime - this._startTime;
  }
  
  get isPlaying() {
      return this._isPlaying;
  }

  scheduleClick(beatNumber: number, time: number) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.frequency.value = beatNumber % 4 === 0 ? 1000 : 800;
    
    env.gain.value = 1;
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(env);
    env.connect(this.metronomeGain);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  scheduler() {
      if (!this.metronomeEnabled || !this._isPlaying) return;
      const lookahead = 0.1;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
          this.scheduleClick(this.currentBeat, this.nextNoteTime);
          const secondsPerBeat = 60.0 / this.bpm;
          this.nextNoteTime += secondsPerBeat;
          this.currentBeat++;
      }
  }

  async startRecording(): Promise<void> {
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.recordedChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.start();
    } catch (err) {
        console.error("Error accessing microphone:", err);
        throw err;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            resolve(null);
            return;
        }
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            this.recordedChunks = [];
            this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
            resolve(blob);
        };
        this.mediaRecorder.stop();
    });
  }

  async renderProject(project: ProjectState): Promise<Blob | null> {
    if (project.clips.length === 0) return null;

    const sampleRate = 44100;
    const duration = Math.max(...project.clips.map(c => c.start + c.duration)) + 2; // +2s tail
    const length = Math.ceil(duration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    // Reconstruct Master Chain on Offline Context
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = project.masterVolume;
    
    const compressor = offlineCtx.createDynamicsCompressor();
    masterGain.connect(compressor);
    compressor.connect(offlineCtx.destination);

    // Create Track Nodes
    const trackNodes = new Map<string, GainNode>();
    project.tracks.forEach(track => {
        const trackGain = offlineCtx.createGain();
        const isMuted = track.muted || (project.tracks.some(t => t.solo) && !track.solo);
        trackGain.gain.value = isMuted ? 0 : track.volume;
        
        // Simple EQ simulation for offline (filters)
        const low = offlineCtx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 320;
        low.gain.value = track.eq?.low || 0;

        const mid = offlineCtx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1000;
        mid.gain.value = track.eq?.mid || 0;

        const high = offlineCtx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 3200;
        high.gain.value = track.eq?.high || 0;

        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = track.pan;

        trackGain.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(panner);
        panner.connect(masterGain);
        
        trackNodes.set(track.id, trackGain);
    });

    // Schedule Clips
    project.clips.forEach(clip => {
        const buffer = this.buffers.get(clip.bufferKey);
        const trackNode = trackNodes.get(clip.trackId);
        
        if (buffer && trackNode) {
            this.scheduleSource(buffer, clip.start, clip.offset, clip.duration, trackNode, clip, 0, offlineCtx);
        }
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWav(renderedBuffer);
  }
}

export const audio = new AudioEngine();