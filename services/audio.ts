import { Clip, Track } from '../types';
import { getAudioBlob } from './db';

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  reverbNode: ConvolverNode;
  delayNode: DelayNode;
  delayGain: GainNode;
  compressor: DynamicsCompressorNode;
  
  buffers: Map<string, AudioBuffer> = new Map();
  activeSources: Map<string, AudioBufferSourceNode> = new Map();
  
  // Persistent nodes for each track: ID -> { input: Gain, panner: StereoPanner }
  trackChannels: Map<string, { gain: GainNode, panner: StereoPannerNode }> = new Map();

  private _isPlaying: boolean = false;
  private _startTime: number = 0;
  private _pauseTime: number = 0;

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

  // Ensure track nodes exist and are connected to master
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

  // Update volume, pan, mute, solo status for all tracks
  syncTracks(tracks: Track[]) {
    const soloActive = tracks.some(t => t.solo);

    tracks.forEach(track => {
      const channel = this.getTrackChannel(track.id);
      const currentTime = this.ctx.currentTime;
      
      // Mute logic: Muted if track.muted OR (solo mode is active AND track is not soloed)
      const isMuted = track.muted || (soloActive && !track.solo);
      const targetVolume = isMuted ? 0 : track.volume;

      // Smooth transitions
      channel.gain.gain.setTargetAtTime(targetVolume, currentTime, 0.02);
      channel.panner.pan.setTargetAtTime(track.pan, currentTime, 0.02);
    });
  }

  play(clips: Clip[], tracks: Track[], startTime: number = 0) {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.stop(); // Stop any existing playback
    this._isPlaying = true;
    this._startTime = this.ctx.currentTime - startTime;
    this._pauseTime = startTime;

    // Ensure all track channels are ready and synced
    this.syncTracks(tracks);

    clips.forEach(clip => {
      const buffer = this.buffers.get(clip.bufferKey);
      if (!buffer) return;

      const channel = this.getTrackChannel(clip.trackId);

      const when = this.ctx.currentTime + (clip.start - startTime);
      const offset = clip.offset;
      const duration = clip.duration;

      // Playback scheduling logic
      if (when < this.ctx.currentTime) {
         // Clip starts in the past relative to playhead
         const startDiff = startTime - clip.start;
         if (startDiff >= 0 && startDiff < duration) {
            // Start midway
            this.scheduleSource(buffer, this.ctx.currentTime, offset + startDiff, duration - startDiff, channel, clip.id);
         }
      } else {
         // Clip starts in the future
         this.scheduleSource(buffer, when, offset, duration, channel, clip.id);
      }
    });
  }

  scheduleSource(
      buffer: AudioBuffer, 
      when: number, 
      offset: number, 
      duration: number, 
      channel: { gain: GainNode },
      clipId: string
    ) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Smart Loop Logic
    // If the requested play duration + offset exceeds the natural buffer length, enable looping.
    if (offset + duration > buffer.duration) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
    }

    // Connect Source -> Track Channel (Persistent) -> Master
    source.connect(channel.gain);

    source.start(when, offset, duration);
    this.activeSources.set(clipId + Math.random(), source);

    source.onended = () => {
        // Cleanup handled by garbage collector mostly, simplified for demo
    };
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

  // --- Recording ---

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
            
            // Release microphone
            this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
            this.mediaRecorder = null;
            
            resolve(blob);
        };

        this.mediaRecorder.stop();
    });
  }
}

export const audio = new AudioEngine();