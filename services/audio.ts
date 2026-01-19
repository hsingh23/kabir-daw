
import { Clip, Track, ProjectState, TanpuraState, TablaState } from '../types';
import { audioBufferToWav } from './utils';

interface TrackChannel {
    input: GainNode; // Entry point for sources
    lowFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    highFilter: BiquadFilterNode;
    gain: GainNode; // Volume fader
    panner: StereoPannerNode; // Pan
}

// Frequency map for keys (Middle Sa)
const NOTE_FREQS: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  
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

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();
    
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

  setupRouting() {
    // Master Routing
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

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

      const gain = this.ctx.createGain(); // Fader
      const panner = this.ctx.createStereoPanner(); // Pan
      
      // 2. Connect Chain
      input.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(gain);
      gain.connect(panner);
      
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

  scheduleTanpura() {
      if (!this.tanpuraConfig || !this.tanpuraConfig.enabled) return;
      
      const sa = NOTE_FREQS[this.tanpuraConfig.key] || 261.63;
      const lowerSa = sa / 2;
      
      let firstStringFreq = sa * 0.75; 
      if (this.tanpuraConfig.tuning === 'Ma') firstStringFreq = sa * (4/3) / 2; 
      if (this.tanpuraConfig.tuning === 'Ni') firstStringFreq = sa * (15/8) / 2; 
      if (this.tanpuraConfig.tuning === 'Pa') firstStringFreq = sa * 0.75; 

      const freqs = [firstStringFreq, sa, sa, lowerSa];
      const speed = this.tanpuraConfig.tempo || 60;
      const interval = 60 / speed;

      while (this.nextTanpuraNoteTime < this.ctx.currentTime + 0.2) {
          this.playTanpuraNote(this.ctx, this.tanpuraGain, freqs[this.currentTanpuraString], this.nextTanpuraNoteTime, interval * 4);
          this.nextTanpuraNoteTime += interval;
          this.currentTanpuraString = (this.currentTanpuraString + 1) % 4;
      }
  }

  playTablaHit(ctx: BaseAudioContext, destination: AudioNode, key: string, type: 'dha' | 'dhin' | 'tin' | 'na' | 'ge' | 'ka', time: number) {
      const sa = NOTE_FREQS[key] || 261.63;
      const t = time;
      
      if (type === 'na' || type === 'tin' || type === 'dha' || type === 'dhin') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(sa, t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.6, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(t);
          osc.stop(t + 0.3);
      }

      if (type === 'ge' || type === 'dha' || type === 'dhin') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(100, t);
          osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.8, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(t);
          osc.stop(t + 0.4);
      }
  }

  scheduleTabla() {
      if (!this.tablaConfig || !this.tablaConfig.enabled) return;

      const bpm = this.tablaConfig.bpm || 100;
      const beatTime = 60 / bpm;
      
      const patterns: Record<string, string[]> = {
          'TeenTaal': ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'na', 'na', 'dhin', 'dhin', 'dha'],
          'Keherwa': ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhin', 'na'],
          'Dadra': ['dha', 'dhin', 'na', 'dha', 'tin', 'na']
      };
      
      const pattern = patterns[this.tablaConfig.taal] || patterns['TeenTaal'];

      while (this.nextTablaBeatTime < this.ctx.currentTime + 0.2) {
          const hit = pattern[this.currentTablaBeat % pattern.length];
          this.playTablaHit(this.ctx, this.tablaGain, this.tablaConfig.key, hit as any, this.nextTablaBeatTime);
          this.nextTablaBeatTime += beatTime;
          this.currentTablaBeat++;
      }
  }

  scheduler() {
      if (!this._isPlaying) return;
      
      // Standard Metronome
      if (this.metronomeEnabled) {
        const lookahead = 0.1;
        while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
            this.scheduleClick(this.currentBeat, this.nextNoteTime);
            const secondsPerBeat = 60.0 / this.bpm;
            this.nextNoteTime += secondsPerBeat;
            this.currentBeat++;
        }
      }

      // Instruments
      this.scheduleTanpura();
      this.scheduleTabla();
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
            this.mediaRecorder?.stream.getTracks().forEach(track => { track.stop(); });
            this.mediaRecorder = null;
            resolve(blob);
        };
        this.mediaRecorder.stop();
    });
  }

  async renderProject(project: ProjectState): Promise<Blob | null> {
    if (project.clips.length === 0) return null;

    const sampleRate = 44100;
    const duration = Math.max(...project.clips.map(c => c.start + c.duration), project.loopEnd) + 2; 
    const length = Math.ceil(duration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    // --- Offline Graph Setup (Mirroring Realtime) ---
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = project.masterVolume;
    
    const compressor = offlineCtx.createDynamicsCompressor();
    masterGain.connect(compressor);
    compressor.connect(offlineCtx.destination);

    // FX Bus
    const reverbReturn = offlineCtx.createGain();
    reverbReturn.gain.value = project.effects.reverb;
    const reverbNode = offlineCtx.createConvolver();
    // Copy buffer from live context
    reverbNode.buffer = this.reverbNode.buffer;
    reverbNode.connect(reverbReturn);
    reverbReturn.connect(masterGain);

    const delayReturn = offlineCtx.createGain();
    delayReturn.gain.value = project.effects.delay;
    const delayNode = offlineCtx.createDelay();
    delayNode.delayTime.value = 0.4;
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = 0.4;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayReturn);
    delayReturn.connect(masterGain);

    const chorusReturn = offlineCtx.createGain();
    chorusReturn.gain.value = project.effects.chorus;
    const chorusDelay = offlineCtx.createDelay();
    chorusDelay.delayTime.value = 0.03;
    const chorusLFO = offlineCtx.createOscillator();
    chorusLFO.frequency.value = 1.5;
    const chorusLFOGain = offlineCtx.createGain();
    chorusLFOGain.gain.value = 0.002;
    chorusLFO.connect(chorusLFOGain);
    chorusLFOGain.connect(chorusDelay.delayTime);
    chorusDelay.connect(chorusReturn);
    chorusReturn.connect(masterGain);
    chorusLFO.start(0);

    // Create Track Nodes
    const trackNodes = new Map<string, GainNode>();
    project.tracks.forEach(track => {
        const trackGain = offlineCtx.createGain();
        const isMuted = track.muted || (project.tracks.some(t => t.solo) && !track.solo);
        trackGain.gain.value = isMuted ? 0 : track.volume;
        
        const low = offlineCtx.createBiquadFilter();
        low.type = 'lowshelf'; low.frequency.value = 320; low.gain.value = track.eq?.low || 0;
        const mid = offlineCtx.createBiquadFilter();
        mid.type = 'peaking'; mid.frequency.value = 1000; mid.gain.value = track.eq?.mid || 0;
        const high = offlineCtx.createBiquadFilter();
        high.type = 'highshelf'; high.frequency.value = 3200; high.gain.value = track.eq?.high || 0;

        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = track.pan;

        trackGain.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(panner);
        
        // Connect Panner to Master and FX Sends
        panner.connect(masterGain);
        panner.connect(reverbNode);
        panner.connect(delayNode);
        panner.connect(chorusDelay);
        
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

    // --- Schedule Instruments Offline ---
    
    // Tanpura
    if (project.tanpura.enabled) {
        const tanpuraGain = offlineCtx.createGain();
        tanpuraGain.gain.value = project.tanpura.volume;
        tanpuraGain.connect(masterGain);
        tanpuraGain.connect(reverbNode);

        const sa = NOTE_FREQS[project.tanpura.key] || 261.63;
        const lowerSa = sa / 2;
        let firstStringFreq = sa * 0.75;
        if (project.tanpura.tuning === 'Ma') firstStringFreq = sa * (4/3) / 2;
        if (project.tanpura.tuning === 'Ni') firstStringFreq = sa * (15/8) / 2;

        const freqs = [firstStringFreq, sa, sa, lowerSa];
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
        const patterns: Record<string, string[]> = {
             'TeenTaal': ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'na', 'na', 'dhin', 'dhin', 'dha'],
             'Keherwa': ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhin', 'na'],
             'Dadra': ['dha', 'dhin', 'na', 'dha', 'tin', 'na']
        };
        const pattern = patterns[project.tabla.taal] || patterns['TeenTaal'];

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
