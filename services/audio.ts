
import { Clip, Track, ProjectState, TanpuraState, TablaState } from '../types';
import { audioBufferToWav } from './utils';

interface TrackChannel {
    input: GainNode; // Entry point for sources
    lowFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    highFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode; // Per-track compressor
    gain: GainNode; // Volume fader
    panner: StereoPannerNode; // Pan
    analyser: AnalyserNode; // For metering
    reverbSend: GainNode;
    delaySend: GainNode;
    chorusSend: GainNode;
}

// Frequency map for keys (Middle Sa)
const NOTE_FREQS: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  
  // Master EQ
  masterLow: BiquadFilterNode;
  masterMid: BiquadFilterNode;
  masterHigh: BiquadFilterNode;

  masterAnalyser: AnalyserNode;
  
  // FX Sends/Returns
  reverbInput: GainNode;
  reverbNode: ConvolverNode;
  reverbReturn: GainNode;

  delayInput: GainNode;
  delayNode: DelayNode;
  delayReturn: GainNode;
  
  chorusInput: GainNode;
  chorusDelay: DelayNode;
  chorusLFO: OscillatorNode;
  chorusLFOGain: GainNode;
  chorusReturn: GainNode;

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
  public metronomeSound: 'beep' | 'click' | 'hihat' = 'beep';
  private nextNoteTime: number = 0;
  private currentBeat: number = 0;

  // Drone & Percussion State
  private tanpuraGain: GainNode;
  private tablaGain: GainNode;
  private nextTanpuraNoteTime: number = 0;
  public currentTanpuraString: number = 0; // 0-3 (Public for UI)
  private nextTablaBeatTime: number = 0;
  public currentTablaBeat: number = 0; // Public for UI
  
  // Cache current settings
  private tanpuraConfig: TanpuraState | null = null;
  private tablaConfig: TablaState | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private recordingMimeType: string = 'audio/webm';
  public selectedInputDeviceId: string | undefined;
  
  // Shared noise buffer for percussion
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    
    this.masterLow = this.ctx.createBiquadFilter();
    this.masterLow.type = 'lowshelf';
    this.masterLow.frequency.value = 200;

    this.masterMid = this.ctx.createBiquadFilter();
    this.masterMid.type = 'peaking';
    this.masterMid.frequency.value = 1000;
    this.masterMid.Q.value = 1.0;

    this.masterHigh = this.ctx.createBiquadFilter();
    this.masterHigh.type = 'highshelf';
    this.masterHigh.frequency.value = 3000;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.knee.value = 10;
    this.compressor.attack.value = 0.05;
    this.compressor.release.value = 0.25;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.5;
    
    // --- Effects Bus Setup ---
    
    // 1. Reverb
    this.reverbInput = this.ctx.createGain();
    this.reverbNode = this.ctx.createConvolver();
    this.reverbReturn = this.ctx.createGain();

    // 2. Delay
    this.delayInput = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay();
    this.delayReturn = this.ctx.createGain();

    // 3. Chorus
    this.chorusInput = this.ctx.createGain();
    this.chorusDelay = this.ctx.createDelay();
    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFOGain = this.ctx.createGain();
    this.chorusReturn = this.ctx.createGain();

    // Metronome
    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.gain.value = 0.5;

    // Drone/Percussion Gains
    this.tanpuraGain = this.ctx.createGain();
    this.tablaGain = this.ctx.createGain();

    this.setupRouting();
    this.loadImpulseResponse();
    this.createNoiseBuffer();
  }

  async resumeContext() {
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
  }

  setupRouting() {
    // Master Routing: Gain -> Low -> Mid -> High -> Compressor -> Analyser -> Dest
    this.masterGain.connect(this.masterLow);
    this.masterLow.connect(this.masterMid);
    this.masterMid.connect(this.masterHigh);
    this.masterHigh.connect(this.compressor);
    this.compressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // -- Reverb Routing --
    this.reverbInput.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterGain);

    // -- Delay Routing --
    this.delayNode.delayTime.value = 0.4;
    this.delayReturn.gain.value = 0.0; 
    this.delayInput.connect(this.delayNode);
    // Simple feedback loop for delay
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.4;
    this.delayNode.connect(feedback);
    feedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.masterGain);

    // -- Chorus Routing --
    this.chorusDelay.delayTime.value = 0.03; // 30ms base delay
    this.chorusLFO.type = 'sine';
    this.chorusLFO.frequency.value = 1.5; // Rate
    this.chorusLFOGain.gain.value = 0.002; // Depth
    
    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelay.delayTime);
    
    this.chorusInput.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusReturn);
    this.chorusReturn.connect(this.masterGain);
    
    this.chorusLFO.start();

    // -- Metronome --
    this.metronomeGain.connect(this.masterGain);

    // -- Instruments --
    this.tanpuraGain.connect(this.reverbInput); // Send to Reverb
    this.tanpuraGain.connect(this.masterGain);
    
    this.tablaGain.connect(this.masterGain);
    this.tablaGain.connect(this.reverbInput);
  }
  
  createNoiseBuffer() {
      const bufferSize = this.ctx.sampleRate * 2.0;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
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

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(key, audioBuffer);
        return audioBuffer;
    } catch (e) {
        console.error("Error decoding audio data:", e);
        throw new Error("Failed to decode audio. The file format may not be supported.");
    }
  }

  processAudioBuffer(key: string, type: 'reverse' | 'normalize'): AudioBuffer {
      const original = this.buffers.get(key);
      if (!original) throw new Error("Buffer not found");

      const ctx = this.ctx;
      const channels = original.numberOfChannels;
      const newBuffer = ctx.createBuffer(channels, original.length, original.sampleRate);

      if (type === 'reverse') {
          for (let i = 0; i < channels; i++) {
              const input = original.getChannelData(i);
              const output = newBuffer.getChannelData(i);
              // Manual reverse copy to ensure new array
              for(let j=0; j<input.length; j++) {
                  output[j] = input[input.length - 1 - j];
              }
          }
      } else if (type === 'normalize') {
          let maxPeak = 0;
          for (let i = 0; i < channels; i++) {
              const data = original.getChannelData(i);
              for (let j = 0; j < data.length; j++) {
                  const val = Math.abs(data[j]);
                  if (val > maxPeak) maxPeak = val;
              }
          }
          const gain = maxPeak > 0 ? 1 / maxPeak : 1;
          for (let i = 0; i < channels; i++) {
              const input = original.getChannelData(i);
              const output = newBuffer.getChannelData(i);
              for (let j = 0; j < input.length; j++) {
                  output[j] = input[j] * gain;
              }
          }
      } else {
          // Clone if unknown type (fallback)
           for (let i = 0; i < channels; i++) {
              newBuffer.copyToChannel(original.getChannelData(i), i);
           }
      }
      return newBuffer;
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

      const compressor = this.ctx.createDynamicsCompressor();
      // Default innocuous settings
      compressor.threshold.value = 0; 
      compressor.ratio.value = 1;

      const gain = this.ctx.createGain(); // Fader
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const panner = this.ctx.createStereoPanner(); // Pan

      const reverbSend = this.ctx.createGain();
      const delaySend = this.ctx.createGain();
      const chorusSend = this.ctx.createGain();
      
      // 2. Connect Chain: EQ -> Compressor -> Fader -> Panner
      input.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(compressor);
      compressor.connect(gain);
      gain.connect(analyser); // Metering post-fader
      analyser.connect(panner);
      
      // 3. Connect to Master and Effects Sends
      panner.connect(this.masterGain);

      // Per-track Sends
      panner.connect(reverbSend);
      reverbSend.connect(this.reverbInput);

      panner.connect(delaySend);
      delaySend.connect(this.delayInput);

      panner.connect(chorusSend);
      chorusSend.connect(this.chorusInput);
      
      this.trackChannels.set(trackId, { 
          input, 
          lowFilter, 
          midFilter, 
          highFilter,
          compressor, 
          gain, 
          panner,
          analyser,
          reverbSend,
          delaySend,
          chorusSend
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

      // Update Compressor
      if (track.compressor) {
          if (track.compressor.enabled) {
              channel.compressor.threshold.setTargetAtTime(track.compressor.threshold, currentTime, 0.1);
              channel.compressor.ratio.setTargetAtTime(track.compressor.ratio, currentTime, 0.1);
              channel.compressor.attack.setTargetAtTime(track.compressor.attack || 0.003, currentTime, 0.1);
              channel.compressor.release.setTargetAtTime(track.compressor.release || 0.25, currentTime, 0.1);
          } else {
              // Bypass
              channel.compressor.threshold.setTargetAtTime(0, currentTime, 0.1);
              channel.compressor.ratio.setTargetAtTime(1, currentTime, 0.1);
          }
      }

      // Update Sends
      if (track.sends) {
          channel.reverbSend.gain.setTargetAtTime(track.sends.reverb, currentTime, 0.05);
          channel.delaySend.gain.setTargetAtTime(track.sends.delay, currentTime, 0.05);
          channel.chorusSend.gain.setTargetAtTime(track.sends.chorus, currentTime, 0.05);
      } else {
          // Default to 0 if sends undefined (migration safety)
          channel.reverbSend.gain.setTargetAtTime(0, currentTime, 0.05);
          channel.delaySend.gain.setTargetAtTime(0, currentTime, 0.05);
          channel.chorusSend.gain.setTargetAtTime(0, currentTime, 0.05);
      }
    });
  }

  syncInstruments(tanpura: TanpuraState, tabla: TablaState) {
      this.tanpuraConfig = tanpura;
      this.tablaConfig = tabla;
      
      const currentTime = this.ctx.currentTime;
      
      // Update Volumes
      const tanpuraVol = tanpura.enabled ? tanpura.volume : 0;
      this.tanpuraGain.gain.setTargetAtTime(tanpuraVol, currentTime, 0.1);

      const tablaVol = tabla.enabled ? tabla.volume : 0;
      this.tablaGain.gain.setTargetAtTime(tablaVol, currentTime, 0.1);

      if ((tanpura.enabled || tabla.enabled) && this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
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
    
    // Sync Instruments Start
    this.nextTanpuraNoteTime = this.ctx.currentTime + 0.1;
    this.currentTanpuraString = 0;
    this.nextTablaBeatTime = this.ctx.currentTime + 0.1;
    this.currentTablaBeat = 0;

    this.syncTracks(tracks);

    clips.forEach(clip => {
      if (clip.muted) return;
      
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
    
    const speed = clip.speed || 1;
    source.playbackRate.value = speed;

    // Envelope Gain for Fades
    const envelope = ctx.createGain();
    source.connect(envelope);
    envelope.connect(destination); 

    // Fade Logic
    const clipFadeIn = clip.fadeIn || 0;
    const clipFadeOut = clip.fadeOut || 0;
    const clipGain = clip.gain ?? 1.0;
    const clipTotalDuration = clip.duration;

    let startGain = clipGain;
    if (elapsedClipTime < clipFadeIn) {
        startGain = (elapsedClipTime / clipFadeIn) * clipGain;
    } else if (elapsedClipTime > clipTotalDuration - clipFadeOut) {
        const timeRemaining = clipTotalDuration - elapsedClipTime;
        startGain = (timeRemaining / clipFadeOut) * clipGain;
    }
    
    envelope.gain.setValueAtTime(startGain, when);

    if (elapsedClipTime < clipFadeIn) {
        const timeUntilFull = clipFadeIn - elapsedClipTime;
        envelope.gain.linearRampToValueAtTime(clipGain, when + timeUntilFull);
    }

    const timeUntilFadeOut = (clipTotalDuration - clipFadeOut) - elapsedClipTime;
    if (timeUntilFadeOut > 0) {
        envelope.gain.setValueAtTime(clipGain, when + timeUntilFadeOut);
        envelope.gain.linearRampToValueAtTime(0, when + timeUntilFadeOut + clipFadeOut);
    } else {
        const timeRemaining = playDuration;
        envelope.gain.linearRampToValueAtTime(0, when + timeRemaining);
    }
    
    // Normalize offset to buffer length to be safe
    const bufferOffset = offset % buffer.duration;
    
    // Check if the required audio exceeds the buffer end
    if (bufferOffset + (playDuration * speed) > buffer.duration) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
    }

    source.start(when, bufferOffset, playDuration);
    source.stop(when + playDuration);

    if (ctx === this.ctx) {
        this.activeSources.set(clip.id + Math.random(), source as AudioBufferSourceNode);
    }
  }

  stop() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch(_e) {}
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

  setMasterEq(low: number, mid: number, high: number) {
      this.masterLow.gain.setTargetAtTime(low, this.ctx.currentTime, 0.1);
      this.masterMid.gain.setTargetAtTime(mid, this.ctx.currentTime, 0.1);
      this.masterHigh.gain.setTargetAtTime(high, this.ctx.currentTime, 0.1);
  }

  setMasterCompressor(threshold: number, ratio: number, knee?: number, attack?: number, release?: number) {
      this.compressor.threshold.setTargetAtTime(threshold, this.ctx.currentTime, 0.1);
      this.compressor.ratio.setTargetAtTime(ratio, this.ctx.currentTime, 0.1);
      if (knee !== undefined) this.compressor.knee.setTargetAtTime(knee, this.ctx.currentTime, 0.1);
      if (attack !== undefined) this.compressor.attack.setTargetAtTime(attack, this.ctx.currentTime, 0.1);
      if (release !== undefined) this.compressor.release.setTargetAtTime(release, this.ctx.currentTime, 0.1);
  }

  setMetronomeVolume(val: number) {
      this.metronomeGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setDelayLevel(val: number) {
    this.delayReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setReverbLevel(val: number) {
    this.reverbReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setChorusLevel(val: number) {
      this.chorusReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  getCurrentTime(): number {
      if (!this._isPlaying) return this._pauseTime;
      return this.ctx.currentTime - this._startTime;
  }
  
  get isPlaying() {
      return this._isPlaying;
  }
  
  // ... rest of file (metering, etc) same as before ...
  
  // --- Metering ---
  private getRMS(analyser: AnalyserNode) {
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  measureTrackLevel(trackId: string): number {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return 0;
    return this.getRMS(channel.analyser);
  }

  measureMasterLevel(): number {
      return this.getRMS(this.masterAnalyser);
  }

  scheduler() {
    if (!this._isPlaying) return;
    const lookahead = 0.1;
    
    // Metronome
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        if (this.metronomeEnabled) {
            this.scheduleClick(this.currentBeat, this.nextNoteTime);
        }
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;
    }

    // Procedural Instrument Scheduling
    if (this.tanpuraConfig?.enabled) {
        while (this.nextTanpuraNoteTime < this.ctx.currentTime + lookahead) {
            const freqs = this.getTanpuraFreqs(this.tanpuraConfig);
            const freq = freqs[this.currentTanpuraString];
            this.playTanpuraNote(this.ctx, this.tanpuraGain, freq, this.nextTanpuraNoteTime, 2.0, this.tanpuraConfig.fineTune || 0);
            
            const interval = 60 / this.tanpuraConfig.tempo;
            this.nextTanpuraNoteTime += interval;
            this.currentTanpuraString = (this.currentTanpuraString + 1) % 4;
        }
    }
    
    if (this.tablaConfig?.enabled) {
         while (this.nextTablaBeatTime < this.ctx.currentTime + lookahead) {
            const pattern = this.getTablaPattern(this.tablaConfig.taal);
            const hit = pattern[this.currentTablaBeat % pattern.length];
            this.playTablaHit(this.ctx, this.tablaGain, this.tablaConfig.key, hit as any, this.nextTablaBeatTime);
            
            const beatTime = 60 / this.tablaConfig.bpm;
            this.nextTablaBeatTime += beatTime;
            this.currentTablaBeat++;
         }
    }
  }

  // ... (rest of methods: scheduleClick, playCountIn, devices, recording, instruments, renderProject) ...
  // Re-inserting missing methods for completeness as partial update isn't safe for full class replacement if not careful
  
  scheduleClick(beatNumber: number, time: number) {
    if (this.metronomeSound === 'click') {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.frequency.setValueAtTime(beatNumber % 4 === 0 ? 1200 : 800, time);
        osc.type = 'square';
        env.gain.setValueAtTime(0.3, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        osc.connect(filter);
        filter.connect(env);
        env.connect(this.metronomeGain);
        osc.start(time);
        osc.stop(time + 0.1);
    } else if (this.metronomeSound === 'hihat') {
        if (!this.noiseBuffer) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const env = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        env.gain.setValueAtTime(beatNumber % 4 === 0 ? 0.4 : 0.2, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        src.connect(filter);
        filter.connect(env);
        env.connect(this.metronomeGain);
        src.start(time);
        src.stop(time + 0.05);
    } else {
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
  }

  async playCountIn(bars: number, bpm: number): Promise<void> {
      await this.resumeContext();
      const secondsPerBeat = 60 / bpm;
      const beatsToPlay = bars * 4;
      const now = this.ctx.currentTime;
      for (let i = 0; i < beatsToPlay; i++) {
          this.scheduleClick(i, now + (i * secondsPerBeat));
      }
      return new Promise(resolve => {
          setTimeout(resolve, beatsToPlay * secondsPerBeat * 1000);
      });
  }

  async getAudioDevices(): Promise<{ inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[] }> {
      try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter(d => d.kind === 'audioinput');
          const outputs = devices.filter(d => d.kind === 'audiooutput');
          return { inputs, outputs };
      } catch (e) {
          console.error("Error enumerating devices:", e);
          return { inputs: [], outputs: [] };
      }
  }

  async setOutputDevice(deviceId: string) {
      if (this.ctx && typeof (this.ctx as any).setSinkId === 'function') {
          try {
              await (this.ctx as any).setSinkId(deviceId);
          } catch (e) {
              console.error("Failed to set output device:", e);
          }
      }
  }

  async startRecording() {
      const constraints: MediaStreamConstraints = {
          audio: this.selectedInputDeviceId ? { 
              deviceId: { exact: this.selectedInputDeviceId },
              echoCancellation: false, autoGainControl: false, noiseSuppression: false
          } : {
              echoCancellation: false, autoGainControl: false, noiseSuppression: false
          }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      this.recordingMimeType = mimeType;
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob | undefined> {
      return new Promise((resolve) => {
          if (!this.mediaRecorder) return resolve(undefined);
          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: this.recordingMimeType });
              this.recordedChunks = [];
              if (this.mediaRecorder) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                this.mediaRecorder = null;
              }
              resolve(blob);
          };
          if (this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          } else {
            resolve(undefined);
          }
      });
  }

  playTanpuraNote(ctx: BaseAudioContext, destination: AudioNode, freq: number, time: number, duration: number, detuneCents: number = 0) {
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = freq;
      osc1.detune.value = detuneCents;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = freq * 1.0015;
      osc2.detune.value = detuneCents + 5; 
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4; 
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300; 
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(time);
      lfo.stop(time + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.1); 
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      osc1.start(time);
      osc1.stop(time + duration);
      osc2.start(time);
      osc2.stop(time + duration);
  }

  playTablaHit(ctx: BaseAudioContext, destination: AudioNode, key: string, hit: string, time: number) {
    const baseFreq = NOTE_FREQS[key] || 261.63;
    if (['dha', 'dhin', 'ge', 'ghe'].includes(hit)) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(baseFreq / 2, time);
        osc.frequency.linearRampToValueAtTime((baseFreq / 2) * 1.15, time + 0.05);
        osc.frequency.linearRampToValueAtTime(baseFreq / 2, time + 0.35);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.9, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + 0.5);
    }
    if (['dha', 'dhin', 'tin', 'na'].includes(hit)) {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gain = ctx.createGain();
        carrier.frequency.setValueAtTime(baseFreq, time);
        modulator.frequency.setValueAtTime(baseFreq * 1.48, time); 
        const modIndex = 250;
        modGain.gain.setValueAtTime(modIndex, time);
        modGain.gain.exponentialRampToValueAtTime(1, time + 0.1); 
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
        carrier.connect(gain);
        gain.connect(destination);
        carrier.start(time);
        carrier.stop(time + 0.6);
        modulator.start(time);
        modulator.stop(time + 0.6);
    }
    if (['ka', 'ke', 'kat', 'na'].includes(hit)) { 
        if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1500;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(hit === 'na' ? 0.3 : 0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(destination);
            noise.start(time);
        }
    }
  }

  getTanpuraFreqs(config: TanpuraState): number[] {
      const sa = NOTE_FREQS[config.key] || 261.63;
      const lowerSa = sa / 2;
      let firstStringFreq = sa * 0.75; 
      if (config.tuning === 'Ma') firstStringFreq = sa * (4/3) / 2; 
      if (config.tuning === 'Ni') firstStringFreq = sa * (15/8) / 2; 
      if (config.tuning === 'Pa') firstStringFreq = sa * 0.75; 
      return [firstStringFreq, sa, sa, lowerSa];
  }

  public getTablaPattern(taal: string): string[] {
      const patterns: Record<string, string[]> = {
             'TeenTaal': ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'na', 'na', 'dhin', 'dhin', 'dha'],
             'Keherwa': ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhin', 'na'],
             'Dadra': ['dha', 'dhin', 'na', 'dha', 'tin', 'na']
      };
      return patterns[taal] || patterns['TeenTaal'];
  }

  async renderProject(project: ProjectState): Promise<Blob> {
      const endTimes = project.clips.map(c => c.start + c.duration);
      const maxClipTime = Math.max(0, ...endTimes, project.loopEnd);
      const duration = maxClipTime + 2; 
      const offlineCtx = new OfflineAudioContext(2, duration * this.ctx.sampleRate, this.ctx.sampleRate);
      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = project.masterVolume;
      const masterLow = offlineCtx.createBiquadFilter(); masterLow.type = 'lowshelf'; masterLow.frequency.value = 200;
      const masterMid = offlineCtx.createBiquadFilter(); masterMid.type = 'peaking'; masterMid.frequency.value = 1000;
      const masterHigh = offlineCtx.createBiquadFilter(); masterHigh.type = 'highshelf'; masterHigh.frequency.value = 3000;
      if (project.masterEq) {
          masterLow.gain.value = project.masterEq.low;
          masterMid.gain.value = project.masterEq.mid;
          masterHigh.gain.value = project.masterEq.high;
      }
      const compressor = offlineCtx.createDynamicsCompressor();
      if (project.masterCompressor) {
          compressor.threshold.value = project.masterCompressor.threshold;
          compressor.ratio.value = project.masterCompressor.ratio;
          compressor.knee.value = project.masterCompressor.knee || 10;
          compressor.attack.value = project.masterCompressor.attack || 0.05;
          compressor.release.value = project.masterCompressor.release || 0.25;
      }
      masterGain.connect(masterLow);
      masterLow.connect(masterMid);
      masterMid.connect(masterHigh);
      masterHigh.connect(compressor);
      compressor.connect(offlineCtx.destination);
      
      // ... (Rest of rendering logic for Reverb, Delay, Clips, Instruments - keeping unchanged)
      // Reverb
      const reverbNode = offlineCtx.createConvolver();
      if (this.reverbNode.buffer) reverbNode.buffer = this.reverbNode.buffer;
      const reverbReturn = offlineCtx.createGain();
      reverbReturn.gain.value = project.effects.reverb;
      reverbNode.connect(reverbReturn);
      reverbReturn.connect(masterGain);

      // Delay
      const delayNode = offlineCtx.createDelay();
      delayNode.delayTime.value = 0.4;
      const delayReturn = offlineCtx.createGain();
      delayReturn.gain.value = project.effects.delay;
      const delayFeedback = offlineCtx.createGain();
      delayFeedback.gain.value = 0.4;
      
      delayNode.connect(delayReturn);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayReturn.connect(masterGain);

      // 3. Render Clips
      // We need to map track settings to temporary channel strips
      const trackMap = new Map<string, GainNode>(); // Input node for each track
      
      project.tracks.forEach(track => {
          const tInput = offlineCtx.createGain();
          const tLow = offlineCtx.createBiquadFilter(); tLow.type = 'lowshelf'; tLow.frequency.value = 320;
          const tMid = offlineCtx.createBiquadFilter(); tMid.type = 'peaking'; tMid.frequency.value = 1000;
          const tHigh = offlineCtx.createBiquadFilter(); tHigh.type = 'highshelf'; tHigh.frequency.value = 3200;
          const tCompressor = offlineCtx.createDynamicsCompressor();
          const tGain = offlineCtx.createGain();
          const tPan = offlineCtx.createStereoPanner();
          const tReverbSend = offlineCtx.createGain();
          const tDelaySend = offlineCtx.createGain();
          const tChorusSend = offlineCtx.createGain();

          // Set Values
          if (track.eq) {
              tLow.gain.value = track.eq.low;
              tMid.gain.value = track.eq.mid;
              tHigh.gain.value = track.eq.high;
          }

          if (track.compressor && track.compressor.enabled) {
              tCompressor.threshold.value = track.compressor.threshold;
              tCompressor.ratio.value = track.compressor.ratio;
              tCompressor.attack.value = track.compressor.attack;
              tCompressor.release.value = track.compressor.release;
          } else {
              tCompressor.threshold.value = 0;
              tCompressor.ratio.value = 1;
          }

          if (track.sends) {
             tReverbSend.gain.value = track.sends.reverb;
             tDelaySend.gain.value = track.sends.delay;
             tChorusSend.gain.value = track.sends.chorus;
          }

          tGain.gain.value = (track.muted || (project.tracks.some(t => t.solo) && !track.solo)) ? 0 : track.volume;
          tPan.pan.value = track.pan;

          // Connect
          tInput.connect(tLow);
          tLow.connect(tMid);
          tMid.connect(tHigh);
          tHigh.connect(tCompressor);
          tCompressor.connect(tGain);
          tGain.connect(tPan);
          
          tPan.connect(masterGain);
          
          // Sends
          tPan.connect(tReverbSend);
          tReverbSend.connect(reverbNode);
          
          tPan.connect(tDelaySend);
          tDelaySend.connect(delayNode); 

          trackMap.set(track.id, tInput);
      });

      // Schedule Clips
      for (const clip of project.clips) {
          if (clip.muted) continue;
          const buffer = this.buffers.get(clip.bufferKey);
          const dest = trackMap.get(clip.trackId);
          if (buffer && dest) {
              this.scheduleSource(buffer, clip.start, clip.offset, clip.duration, dest, clip, 0, offlineCtx);
          }
      }

      // 4. Render Backing Instruments
      // Tanpura
      if (project.tanpura.enabled) {
          const tanpuraGain = offlineCtx.createGain();
          tanpuraGain.gain.value = project.tanpura.volume;
          tanpuraGain.connect(masterGain);
          tanpuraGain.connect(reverbNode);
          
          const freqs = this.getTanpuraFreqs(project.tanpura);
          const interval = 60 / project.tanpura.tempo;
          
          let time = 0;
          let sIdx = 0;
          while (time < duration) {
              this.playTanpuraNote(offlineCtx, tanpuraGain, freqs[sIdx], time, interval * 4, project.tanpura.fineTune || 0);
              time += interval;
              sIdx = (sIdx + 1) % 4;
          }
      }

      // Tabla
      if (project.tabla.enabled) {
          const tablaGain = offlineCtx.createGain();
          tablaGain.gain.value = project.tabla.volume;
          tablaGain.connect(masterGain);
          tablaGain.connect(reverbNode);

          const bpm = project.tabla.bpm;
          const beatTime = 60 / bpm;
          const pattern = this.getTablaPattern(project.tabla.taal);

          let time = 0;
          let bIdx = 0;
          while (time < duration) {
              const hit = pattern[bIdx % pattern.length];
              this.playTablaHit(offlineCtx, tablaGain, project.tabla.key, hit as any, time);
              time += beatTime;
              bIdx++;
          }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
  }
}

export const audio = new AudioEngine();
