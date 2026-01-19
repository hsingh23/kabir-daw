import { Clip, Track } from '../types';
import { getAudioBlob } from './db';

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
  
  // Persistent nodes for each track: ID -> { input: Gain, panner: StereoPanner }
  trackChannels: Map<string, { gain: GainNode, panner: StereoPannerNode }> = new Map();

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

  getTrackChannel(trackId: string) {
    if (!this.trackChannels.has(trackId)) {
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      
      gain.connect(panner);
      panner.connect(this.masterGain);
      
      this.trackChannels.set(trackId, { gain, panner });
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

      channel.gain.gain.setTargetAtTime(targetVolume, currentTime, 0.02);
      channel.panner.pan.setTargetAtTime(track.pan, currentTime, 0.02);
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
         // Clip starts in the past
         const startDiff = startTime - clip.start;
         if (startDiff >= 0 && startDiff < duration) {
            // Start midway
            // We need to pass the *full* clip details to calculate fade curves correctly relative to the *clip* start/end
            this.scheduleSource(buffer, this.ctx.currentTime, offset + startDiff, duration - startDiff, channel, clip, startDiff);
         }
      } else {
         // Clip starts in the future
         this.scheduleSource(buffer, when, offset, duration, channel, clip, 0);
      }
    });
  }

  scheduleSource(
      buffer: AudioBuffer, 
      when: number, 
      offset: number, 
      playDuration: number, 
      channel: { gain: GainNode },
      clip: Clip,
      elapsedClipTime: number
    ) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Envelope Gain for Fades
    const envelope = this.ctx.createGain();
    source.connect(envelope);
    envelope.connect(channel.gain);

    // Apply Fades
    // We must calculate the gain value at 'when' (the start of *playback*), which might be mid-fade
    
    const clipFadeIn = clip.fadeIn || 0;
    const clipFadeOut = clip.fadeOut || 0;
    const clipTotalDuration = clip.duration;

    // 1. Initial Value
    let startGain = 1;
    if (elapsedClipTime < clipFadeIn) {
        // We are starting inside the Fade In
        startGain = elapsedClipTime / clipFadeIn;
    } else if (elapsedClipTime > clipTotalDuration - clipFadeOut) {
        // We are starting inside the Fade Out
        const timeRemaining = clipTotalDuration - elapsedClipTime;
        startGain = timeRemaining / clipFadeOut;
    }
    
    envelope.gain.setValueAtTime(startGain, when);

    // 2. Scheduled Ramps
    
    // Fade In Ramp (if we haven't passed it yet)
    if (elapsedClipTime < clipFadeIn) {
        // Ramp from current gain to 1
        const timeUntilFull = clipFadeIn - elapsedClipTime;
        envelope.gain.linearRampToValueAtTime(1, when + timeUntilFull);
    }

    // Fade Out Ramp
    // When does the fade out start relative to *playback start*?
    const timeUntilFadeOut = (clipTotalDuration - clipFadeOut) - elapsedClipTime;
    
    if (timeUntilFadeOut > 0) {
        // Fade out hasn't started yet relative to playback start
        envelope.gain.setValueAtTime(1, when + timeUntilFadeOut);
        envelope.gain.linearRampToValueAtTime(0, when + timeUntilFadeOut + clipFadeOut);
    } else {
        // We are already inside fade out region (or past it), handle the ramp down from current startGain
        // However, if we started inside fade out, startGain is already set. We just need to ramp to 0 at the end.
        const timeRemaining = playDuration;
        envelope.gain.linearRampToValueAtTime(0, when + timeRemaining);
    }


    // Looping Logic
    if (offset + playDuration > buffer.duration) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
    }

    source.start(when, offset, playDuration);
    this.activeSources.set(clip.id + Math.random(), source);
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
}

export const audio = new AudioEngine();