
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
}

// Frequency map for keys (Middle Sa)
const NOTE_FREQS: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
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
  private nextNoteTime: number = 0;
  private currentBeat: number = 0;

  // Drone & Percussion State
  private tanpuraGain: GainNode;
  private tablaGain: GainNode;
  private nextTanpuraNoteTime: number = 0;
  private currentTanpuraString: number = 0; // 0-3
  private nextTablaBeatTime: number = 0;
  private currentTablaBeat: number = 0;
  
  // Cache current settings
  private tanpuraConfig: TanpuraState | null = null;
  private tablaConfig: TablaState | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private recordingMimeType: string = 'audio/webm';

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
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
  }

  async resumeContext() {
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
  }

  setupRouting() {
    // Master Routing
    this.masterGain.connect(this.compressor);
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

      const compressor = this.ctx.createDynamicsCompressor();
      // Default innocuous settings
      compressor.threshold.value = 0; 
      compressor.ratio.value = 1;

      const gain = this.ctx.createGain(); // Fader
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const panner = this.ctx.createStereoPanner(); // Pan
      
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
      panner.connect(this.reverbInput);
      panner.connect(this.delayInput);
      panner.connect(this.chorusInput);
      
      this.trackChannels.set(trackId, { 
          input, 
          lowFilter, 
          midFilter, 
          highFilter,
          compressor, 
          gain, 
          panner,
          analyser 
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
    envelope.connect(destination); 

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

  setMasterCompressor(threshold: number, ratio: number) {
      this.compressor.threshold.setTargetAtTime(threshold, this.ctx.currentTime, 0.1);
      this.compressor.ratio.setTargetAtTime(ratio, this.ctx.currentTime, 0.1);
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
    if (!this.metronomeEnabled || !this._isPlaying) return;
    const lookahead = 0.1;
    
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this.scheduleClick(this.currentBeat, this.nextNoteTime);
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;
    }

    // Procedural Instrument Scheduling (Simple)
    if (this.tanpuraConfig?.enabled) {
        while (this.nextTanpuraNoteTime < this.ctx.currentTime + lookahead) {
            const freqs = this.getTanpuraFreqs(this.tanpuraConfig);
            const freq = freqs[this.currentTanpuraString];
            this.playTanpuraNote(this.ctx, this.tanpuraGain, freq, this.nextTanpuraNoteTime, 2.0); // 2s sustain
            
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

  // --- Recording ---

  async startRecording() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type (fixes Safari recording issues)
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


  // --- Synthesis for Instruments (Refactored for Reusability) ---

  playTanpuraNote(ctx: BaseAudioContext, destination: AudioNode, freq: number, time: number, duration: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.5); 
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start(time);
      osc.stop(time + duration);
  }

  playTablaHit(ctx: BaseAudioContext, destination: AudioNode, key: string, hit: 'dha' | 'dhin' | 'tin' | 'na' | 'ge' | 'ka', time: number) {
    const baseFreq = NOTE_FREQS[key] || 261.63;
    
    // Low Drum (Bayan)
    if (['dha', 'dhin', 'ge', 'ghe'].includes(hit)) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.frequency.setValueAtTime(baseFreq / 2, time);
        osc.frequency.exponentialRampToValueAtTime(baseFreq / 2 * 0.8, time + 0.3);
        env.gain.setValueAtTime(0.8, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
        osc.connect(env);
        env.connect(destination);
        osc.start(time);
        osc.stop(time + 0.4);
    }

    // High Drum (Dayan) - Resonant
    if (['dha', 'dhin', 'tin', 'na'].includes(hit)) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const isMuted = hit === 'dhin'; // simplified
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, time);
        
        env.gain.setValueAtTime(0.6, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + (isMuted ? 0.2 : 0.6));
        
        osc.connect(env);
        env.connect(destination);
        osc.start(time);
        osc.stop(time + (isMuted ? 0.2 : 0.6));
    }
    
    // Slap (Ka)
    if (hit === 'ka' || hit === 'na') {
        const osc = ctx.createOscillator(); // noise approximation
        // Web Audio noise is usually buffer, assume simple high freq osc for now or nothing
        const noise = ctx.createBufferSource();
        // Skip noise generation for brevity/performance in simple synth, usually requires noise buffer
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

  getTablaPattern(taal: string): string[] {
      const patterns: Record<string, string[]> = {
             'TeenTaal': ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'na', 'na', 'dhin', 'dhin', 'dha'],
             'Keherwa': ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhin', 'na'],
             'Dadra': ['dha', 'dhin', 'na', 'dha', 'tin', 'na']
      };
      return patterns[taal] || patterns['TeenTaal'];
  }

  async renderProject(project: ProjectState): Promise<Blob> {
      // 1. Calculate Total Duration
      const endTimes = project.clips.map(c => c.start + c.duration);
      const maxClipTime = Math.max(0, ...endTimes, project.loopEnd);
      const duration = maxClipTime + 2; // Tail
      
      const offlineCtx = new OfflineAudioContext(2, duration * this.ctx.sampleRate, this.ctx.sampleRate);

      // 2. Reconstruct Graph in Offline Context
      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = project.masterVolume;
      
      const compressor = offlineCtx.createDynamicsCompressor();
      if (project.masterCompressor) {
          compressor.threshold.value = project.masterCompressor.threshold;
          compressor.ratio.value = project.masterCompressor.ratio;
      }
      masterGain.connect(compressor);
      compressor.connect(offlineCtx.destination);
      
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
          tPan.connect(reverbNode); // Send to reverb
          tPan.connect(delayNode);  // Send to delay

          trackMap.set(track.id, tInput);
      });

      // Schedule Clips
      for (const clip of project.clips) {
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
              this.playTanpuraNote(offlineCtx, tanpuraGain, freqs[sIdx], time, interval * 4);
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
