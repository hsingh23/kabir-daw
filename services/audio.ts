
import { Clip, Track, ProjectState, InstrumentConfig, SequencerState, DroneState, AutomationPoint, MidiNote } from '../types';
import { SynthVoice } from './SynthVoice';
import { AudioRecorder } from './AudioRecorder';
import { makeDistortionCurve, EQ_FREQS, audioBufferToWav, shallowEqual } from './utils';

const LOOKAHEAD = 0.1; // 100ms
const SCHEDULE_AHEAD_TIME = 0.15; // 150ms

// Encapsulates the Web Audio graph for a single track
export class TrackChannel {
    public input: GainNode;
    public distortion: WaveShaperNode;
    public eqLow: BiquadFilterNode;
    public eqMid: BiquadFilterNode;
    public eqHigh: BiquadFilterNode;
    public compressor: DynamicsCompressorNode;
    public preFaderTap: GainNode;
    public gain: GainNode;
    public panner: StereoPannerNode;
    public analyser: AnalyserNode;
    
    // Sends
    public reverbSendPre: GainNode;
    public reverbSendPost: GainNode;
    public delaySendPre: GainNode;
    public delaySendPost: GainNode;
    public chorusSendPre: GainNode;
    public chorusSendPost: GainNode;

    // State State for Dirty Checking
    private lastState: {
        volume: number;
        pan: number;
        muted: boolean;
        solo: boolean;
        effectiveMute: boolean;
        distortion: number;
        eq: { low: number; mid: number; high: number };
        compressor: Track['compressor'];
        sends: Track['sends'];
        sendConfig: Track['sendConfig'];
    } = {
        volume: -1, pan: -100, muted: false, solo: false, effectiveMute: false, distortion: -1,
        eq: { low: -100, mid: -100, high: -100 },
        compressor: undefined, sends: { reverb: -1, delay: -1, chorus: -1 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
    };

    public activeVoices: Map<number, SynthVoice> = new Map();

    constructor(private ctx: BaseAudioContext, destination: AudioNode, private busNodes: { reverb: AudioNode, delay: AudioNode, chorus: AudioNode }) {
        // Node Creation
        this.input = ctx.createGain();
        this.distortion = ctx.createWaveShaper();
        this.eqLow = ctx.createBiquadFilter();
        this.eqMid = ctx.createBiquadFilter();
        this.eqHigh = ctx.createBiquadFilter();
        this.compressor = ctx.createDynamicsCompressor();
        this.preFaderTap = ctx.createGain();
        this.gain = ctx.createGain();
        this.panner = ctx.createStereoPanner();
        this.analyser = ctx.createAnalyser();

        // Send Nodes
        this.reverbSendPre = ctx.createGain();
        this.reverbSendPost = ctx.createGain();
        this.delaySendPre = ctx.createGain();
        this.delaySendPost = ctx.createGain();
        this.chorusSendPre = ctx.createGain();
        this.chorusSendPost = ctx.createGain();

        // Config
        this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = EQ_FREQS.low;
        this.eqMid.type = 'peaking'; this.eqMid.frequency.value = EQ_FREQS.mid;
        this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = EQ_FREQS.high;
        this.analyser.fftSize = 512;
        this.distortion.curve = null;

        // Routing Chain
        this.input.connect(this.distortion);
        this.distortion.connect(this.eqLow);
        this.eqLow.connect(this.eqMid);
        this.eqMid.connect(this.eqHigh);
        this.eqHigh.connect(this.compressor);
        this.compressor.connect(this.preFaderTap); // Pre-fader point
        this.preFaderTap.connect(this.gain);
        this.gain.connect(this.panner);
        this.panner.connect(this.analyser);
        this.panner.connect(destination);

        // Send Routing
        this.preFaderTap.connect(this.reverbSendPre);
        this.preFaderTap.connect(this.delaySendPre);
        this.preFaderTap.connect(this.chorusSendPre);
        
        this.panner.connect(this.reverbSendPost);
        this.panner.connect(this.delaySendPost);
        this.panner.connect(this.chorusSendPost);

        // Connect to Bus
        this.reverbSendPre.connect(busNodes.reverb);
        this.reverbSendPost.connect(busNodes.reverb);
        this.delaySendPre.connect(busNodes.delay);
        this.delaySendPost.connect(busNodes.delay);
        this.chorusSendPre.connect(busNodes.chorus);
        this.chorusSendPost.connect(busNodes.chorus);
    }

    update(track: Track, time: number, effectiveMute: boolean) {
        const now = time;
        const rampTime = 0.02; // 20ms smoothing

        // Volume & Mute
        if (this.lastState.volume !== track.volume || this.lastState.effectiveMute !== effectiveMute) {
            const targetVol = effectiveMute ? 0 : track.volume;
            this.gain.gain.setTargetAtTime(targetVol, now, rampTime);
            this.lastState.volume = track.volume;
            this.lastState.effectiveMute = effectiveMute;
        }

        // Pan
        if (this.lastState.pan !== track.pan) {
            this.panner.pan.setTargetAtTime(track.pan, now, rampTime);
            this.lastState.pan = track.pan;
        }

        // EQ
        if (!shallowEqual(this.lastState.eq, track.eq)) {
            this.eqLow.gain.setTargetAtTime(track.eq.low, now, 0.1);
            this.eqMid.gain.setTargetAtTime(track.eq.mid, now, 0.1);
            this.eqHigh.gain.setTargetAtTime(track.eq.high, now, 0.1);
            this.lastState.eq = { ...track.eq };
        }

        // Compressor
        if (!shallowEqual(this.lastState.compressor, track.compressor)) {
            if (track.compressor?.enabled) {
                this.compressor.threshold.value = track.compressor.threshold;
                this.compressor.ratio.value = track.compressor.ratio;
                this.compressor.attack.value = track.compressor.attack;
                this.compressor.release.value = track.compressor.release;
            } else {
                this.compressor.threshold.value = 0;
                this.compressor.ratio.value = 1;
            }
            this.lastState.compressor = track.compressor ? { ...track.compressor } : undefined;
        }

        // Distortion
        if (this.lastState.distortion !== track.distortion) {
            this.distortion.curve = makeDistortionCurve(track.distortion || 0);
            this.lastState.distortion = track.distortion || 0;
        }

        // Sends
        if (!shallowEqual(this.lastState.sends, track.sends) || !shallowEqual(this.lastState.sendConfig, track.sendConfig)) {
            const updateSendNode = (preNode: GainNode, postNode: GainNode, val: number, isPre: boolean) => {
                const targetPre = isPre ? val : 0;
                const targetPost = isPre ? 0 : val;
                preNode.gain.setTargetAtTime(targetPre, now, rampTime);
                postNode.gain.setTargetAtTime(targetPost, now, rampTime);
            };

            updateSendNode(this.reverbSendPre, this.reverbSendPost, track.sends.reverb, track.sendConfig.reverbPre);
            updateSendNode(this.delaySendPre, this.delaySendPost, track.sends.delay, track.sendConfig.delayPre);
            updateSendNode(this.chorusSendPre, this.chorusSendPost, track.sends.chorus, track.sendConfig.chorusPre);

            this.lastState.sends = { ...track.sends };
            this.lastState.sendConfig = { ...track.sendConfig };
        }
    }

    disconnect() {
        this.input.disconnect();
        this.panner.disconnect();
        this.reverbSendPre.disconnect();
        this.reverbSendPost.disconnect();
        this.delaySendPre.disconnect();
        this.delaySendPost.disconnect();
        this.chorusSendPre.disconnect();
        this.chorusSendPost.disconnect();
    }
}

export class AudioEngine {
  ctx: AudioContext;
  offlineCtx: OfflineAudioContext | null = null;
  
  // Master Chain
  masterGain: GainNode;
  masterCompressor: DynamicsCompressorNode;
  masterLimiter: DynamicsCompressorNode; // Safety Limiter
  masterLow: BiquadFilterNode;
  masterMid: BiquadFilterNode;
  masterHigh: BiquadFilterNode;
  masterAnalyser: AnalyserNode;
  
  // FX Buses
  reverbNode: ConvolverNode;
  reverbInput: GainNode;
  reverbReturn: GainNode;
  
  delayNode: DelayNode;
  delayInput: GainNode;
  delayReturn: GainNode;
  delayFeedback: GainNode;
  
  chorusInput: GainNode;
  chorusReturn: GainNode;
  chorusOsc: OscillatorNode;
  chorusGain: GainNode;
  
  // Input Monitoring
  inputAnalyser: AnalyserNode;
  monitorGain: GainNode;
  
  // Metronome
  metronomeGain: GainNode;
  metronomeBuffers: Map<string, AudioBuffer> = new Map();
  
  // State
  buffers: Map<string, AudioBuffer> = new Map();
  
  // Use the new TrackChannel abstraction
  trackChannels: Map<string, TrackChannel> = new Map();
  
  // Map clipId to source and gain node for realtime control
  activeSources: Map<string, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  scheduledSynthVoices: Set<SynthVoice> = new Set();
  
  recorder: AudioRecorder;
  
  isPlaying: boolean = false;
  isInitialized: boolean = false;
  
  // Timing
  bpm: number = 120;
  timeSignature: [number, number] = [4, 4];
  metronomeEnabled: boolean = false;
  metronomeSound: 'beep' | 'click' | 'hihat' = 'beep';
  
  private _startTime: number = 0;
  private _pauseTime: number = 0;
  private _scheduledTime: number = 0;
  
  // Sequencer State
  currentStep: number = 0;
  private _nextNoteTime: number = 0;
  
  public get selectedInputDeviceId() { return this.recorder.selectedInputDeviceId; }
  public set selectedInputDeviceId(id: string | undefined) { this.recorder.selectedInputDeviceId = id; }

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
    
    // Create Nodes
    this.masterGain = this.ctx.createGain();
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterLimiter = this.ctx.createDynamicsCompressor(); // Safety Wall
    this.masterLow = this.ctx.createBiquadFilter();
    this.masterMid = this.ctx.createBiquadFilter();
    this.masterHigh = this.ctx.createBiquadFilter();
    this.masterAnalyser = this.ctx.createAnalyser();
    
    // Master Chain Configuration
    this.masterLow.type = 'lowshelf';
    this.masterLow.frequency.value = EQ_FREQS.low;
    this.masterMid.type = 'peaking';
    this.masterMid.frequency.value = EQ_FREQS.mid;
    this.masterHigh.type = 'highshelf';
    this.masterHigh.frequency.value = EQ_FREQS.high;
    this.masterAnalyser.fftSize = 2048;

    // Configure Limiter (Fast attack, high ratio) to prevent clipping at speakers
    this.masterLimiter.threshold.value = -0.5;
    this.masterLimiter.knee.value = 0;
    this.masterLimiter.ratio.value = 20; 
    this.masterLimiter.attack.value = 0.001; 
    this.masterLimiter.release.value = 0.1;

    // Connect Master Chain
    this.masterGain.connect(this.masterLow);
    this.masterLow.connect(this.masterMid);
    this.masterMid.connect(this.masterHigh);
    this.masterHigh.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // --- Reverb Bus ---
    this.reverbInput = this.ctx.createGain();
    this.reverbNode = this.ctx.createConvolver();
    this.reverbReturn = this.ctx.createGain();
    this.createImpulseResponse(); 
    this.reverbInput.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterGain);

    // --- Delay Bus ---
    this.delayInput = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayFeedback = this.ctx.createGain();
    this.delayReturn = this.ctx.createGain();
    this.delayNode.delayTime.value = 0.3;
    this.delayFeedback.gain.value = 0.4;
    this.delayInput.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.masterGain);

    // --- Chorus Bus ---
    this.chorusInput = this.ctx.createGain();
    this.chorusReturn = this.ctx.createGain();
    const chorusDelay = this.ctx.createDelay(0.1);
    chorusDelay.delayTime.value = 0.03;
    this.chorusOsc = this.ctx.createOscillator();
    this.chorusGain = this.ctx.createGain();
    this.chorusOsc.frequency.value = 1.5; 
    this.chorusGain.gain.value = 0.002; 
    this.chorusOsc.connect(this.chorusGain);
    this.chorusGain.connect(chorusDelay.delayTime);
    this.chorusOsc.start();
    
    this.chorusInput.connect(chorusDelay);
    chorusDelay.connect(this.chorusReturn);
    this.chorusReturn.connect(this.masterGain);

    // --- Input Monitoring ---
    this.inputAnalyser = this.ctx.createAnalyser();
    this.inputAnalyser.fftSize = 1024;
    this.monitorGain = this.ctx.createGain();
    this.monitorGain.gain.value = 0; 
    this.monitorGain.connect(this.masterGain);

    // --- Metronome ---
    this.metronomeGain = this.ctx.createGain();
    this.metronomeGain.connect(this.masterGain);
    this.generateMetronomeSounds();

    // --- Recorder ---
    this.recorder = new AudioRecorder(this.ctx, this.inputAnalyser, this.monitorGain);
    
    this.isInitialized = true;
  }

  init() {
      if (this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
  }

  async resumeContext() {
      if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
      }
  }

  // --- Audio Loading ---
  
  private loadPromises = new Map<string, Promise<AudioBuffer>>();

  async loadAudio(key: string, blob: Blob): Promise<AudioBuffer> {
      if (this.buffers.has(key)) return this.buffers.get(key)!;
      
      if (this.loadPromises.has(key)) {
          return this.loadPromises.get(key)!;
      }

      const promise = (async () => {
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(key, audioBuffer);
          this.loadPromises.delete(key);
          return audioBuffer;
      })();

      this.loadPromises.set(key, promise);
      return promise;
  }

  clearBuffers() {
      this.buffers.clear();
      this.loadPromises.clear();
  }

  // --- Track Management ---

  getTrackChannel(trackId: string): TrackChannel {
      if (!this.trackChannels.has(trackId)) {
          const channel = new TrackChannel(
              this.ctx, 
              this.masterGain, 
              { reverb: this.reverbInput, delay: this.delayInput, chorus: this.chorusInput }
          );
          this.trackChannels.set(trackId, channel);
      }
      return this.trackChannels.get(trackId)!;
  }

  syncTracks(tracks: Track[]) {
      const activeIds = new Set(tracks.map(t => t.id));
      const isAnySolo = tracks.some(t => t.solo);

      // Cleanup unused channels
      for (const [id, channel] of this.trackChannels) {
          if (!activeIds.has(id)) {
              channel.disconnect();
              this.trackChannels.delete(id);
          }
      }

      // Update existing channels
      tracks.forEach(track => {
          const channel = this.getTrackChannel(track.id);
          const effectiveMute = track.muted || (isAnySolo && !track.solo);
          channel.update(track, this.ctx.currentTime, effectiveMute);
      });
  }

  // --- Direct Setters Optimization ---

  setTrackVolume(trackId: string, volume: number) {
      const channel = this.trackChannels.get(trackId);
      if (channel) {
          channel.gain.gain.cancelScheduledValues(this.ctx.currentTime);
          channel.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
      }
  }

  setTrackPan(trackId: string, pan: number) {
      const channel = this.trackChannels.get(trackId);
      if (channel) {
          channel.panner.pan.cancelScheduledValues(this.ctx.currentTime);
          channel.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.02);
      }
  }

  setClipGain(clipId: string, gain: number) {
      const active = this.activeSources.get(clipId);
      if (active && this.ctx) {
          active.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
      }
  }

  setMasterVolume(val: number) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setMetronomeVolume(val: number) {
      this.metronomeGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
  }

  // --- Playback Control ---

  play(clips: Clip[], tracks: Track[], startTime: number = 0) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      this.stopSources();

      this.isPlaying = true;
      
      this._startTime = this.ctx.currentTime - startTime;
      this._scheduledTime = this.ctx.currentTime;
      
      const secondsPerBeat = 60 / this.bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const startStep = Math.floor(startTime / secondsPerStep);
      this.currentStep = startStep;
      this._nextNoteTime = this.ctx.currentTime + (secondsPerStep - (startTime % secondsPerStep));
      if (startTime % secondsPerStep === 0) this._nextNoteTime = this.ctx.currentTime;
  }

  pause() {
      this.isPlaying = false;
      this._pauseTime = this.ctx.currentTime - this._startTime;
      this.stopSources();
  }

  stop() {
      this.isPlaying = false;
      this._pauseTime = 0;
      this.stopSources();
  }

  private stopSources() {
      this.activeSources.forEach(({ source }) => {
          try { source.stop(); } catch(e) {}
          try { source.disconnect(); } catch(e) {}
      });
      this.activeSources.clear();
      
      this.scheduledSynthVoices.forEach(v => v.disconnect());
      this.scheduledSynthVoices.clear();
  }

  getCurrentTime(): number {
      if (!this.isPlaying) return this._pauseTime; 
      return this.ctx.currentTime - this._startTime;
  }

  getProjectTime(contextTime: number): number {
      return contextTime - this._startTime;
  }

  scheduler(tracks: Track[], clips: Clip[]) {
      if (!this.isPlaying) return;

      const currentTime = this.ctx.currentTime;
      const schedulerWindowEnd = currentTime + SCHEDULE_AHEAD_TIME;
      const projectTimeEnd = schedulerWindowEnd - this._startTime;
      const projectTimeStart = currentTime - this._startTime;

      // 1. Schedule Clips
      clips.forEach(clip => {
          if (this.activeSources.has(clip.id)) return;
          if (clip.muted) return;

          if (clip.start >= projectTimeStart && clip.start < projectTimeEnd) {
              this.scheduleClip(clip, tracks);
          }
          // Catch up if seeking into middle of clip
          else if (clip.start < projectTimeStart && (clip.start + clip.duration) > projectTimeStart) {
              const offset = projectTimeStart - clip.start;
              this.scheduleClip(clip, tracks, offset);
          }
      });

      // 2. Schedule Automation
      tracks.forEach(track => {
          if (track.automation?.volume) {
              const channel = this.getTrackChannel(track.id);
              track.automation.volume.forEach(point => {
                  if (point.time >= projectTimeStart && point.time < projectTimeEnd) {
                      const time = this._startTime + point.time;
                      channel.gain.gain.cancelScheduledValues(time);
                      channel.gain.gain.linearRampToValueAtTime(point.value, time);
                  }
              });
          }
      });

      // 3. Sequencer & Metronome
      while (this._nextNoteTime < schedulerWindowEnd) {
          const stepTime = this._nextNoteTime;
          const stepIndex = this.currentStep % 16;
          
          if (this.metronomeEnabled) {
              this.scheduleMetronome(stepTime, this.currentStep);
          }
          
          this.scheduleSequencer(stepIndex, stepTime);
          
          const secondsPerBeat = 60 / this.bpm;
          this._nextNoteTime += secondsPerBeat / 4; 
          this.currentStep++;
      }
  }

  private scheduleClip(clip: Clip, tracks: Track[], startOffset: number = 0) {
      if (clip.notes) return; 
      
      const buffer = this.buffers.get(clip.bufferKey!);
      if (!buffer) return;

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track || track.muted) return;

      const channel = this.getTrackChannel(track.id);
      
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = clip.speed || 1.0;
      source.detune.value = clip.detune || 0;
      
      const clipGainNode = this.ctx.createGain();
      clipGainNode.gain.value = clip.gain ?? 1.0;
      
      source.connect(clipGainNode);
      clipGainNode.connect(channel.input);

      const startTime = this._startTime + clip.start;
      const duration = clip.duration;
      const playStartTime = startTime + startOffset; 
      
      const bufferOffset = (clip.offset || 0) + (startOffset * (clip.speed || 1));
      const playDuration = duration - startOffset;
      
      if (playDuration <= 0) return;

      source.start(playStartTime, bufferOffset, playDuration);
      
      if (clip.fadeIn > 0) {
          const absStartTime = startTime;
          clipGainNode.gain.setValueAtTime(0, absStartTime);
          clipGainNode.gain.linearRampToValueAtTime(clip.gain ?? 1.0, absStartTime + clip.fadeIn);
      }
      if (clip.fadeOut > 0) {
          const absEndTime = startTime + duration;
          clipGainNode.gain.setValueAtTime(clip.gain ?? 1.0, absEndTime - clip.fadeOut);
          clipGainNode.gain.linearRampToValueAtTime(0, absEndTime);
      }

      this.activeSources.set(clip.id, { source, gain: clipGainNode });
      
      source.onended = () => {
          this.activeSources.delete(clip.id);
          try { clipGainNode.disconnect(); } catch(e) {}
      };
  }

  private scheduleMetronome(time: number, step: number) {
      const isBeat = step % 4 === 0;
      const soundKey = this.metronomeSound;
      const buffer = this.metronomeBuffers.get(soundKey) || this.metronomeBuffers.get('beep');
      
      if (!buffer) return;
      if (!isBeat && soundKey !== 'hihat' && soundKey !== 'click') return; // Default behavior: only beats for beep? Or emphasize beats?
      // Let's make it standard: Beat = High, Offbeat = Low/Normal. 
      // If sound has pitch (beep), we change pitch. If sample (click/hat), we change gain.

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      
      if (soundKey === 'beep') {
          source.playbackRate.value = isBeat ? 1.0 : 0.8;
      }
      
      const gain = this.ctx.createGain();
      gain.gain.value = isBeat ? 1.0 : 0.6;
      
      source.connect(gain);
      gain.connect(this.metronomeGain);
      source.start(time);
      source.stop(time + buffer.duration + 0.1);
  }

  sequencerState: SequencerState | null = null;
  droneState: DroneState | null = null;

  syncInstruments(sequencer: SequencerState, drone: DroneState) {
      this.sequencerState = sequencer;
      this.droneState = drone;
  }

  private scheduleSequencer(stepIndex: number, time: number) {
      if (!this.sequencerState || !this.sequencerState.enabled) return;
      
      this.sequencerState.tracks.forEach(track => {
          if (!track.muted && track.steps[stepIndex]) {
              this.playSample(track.sample, time, this.sequencerState!.volume * track.volume);
          }
      });
  }

  playSample(name: string, time: number, volume: number) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      if (name === 'kick') {
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
          gain.gain.setValueAtTime(volume, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
          osc.start(time);
          osc.stop(time + 0.5);
      } else if (name === 'snare') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(100, time);
          gain.gain.setValueAtTime(volume, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          osc.start(time);
          osc.stop(time + 0.2);
      } else if (name === 'hihat') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(8000, time);
          gain.gain.setValueAtTime(volume * 0.3, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
          osc.start(time);
          osc.stop(time + 0.05);
      }
  }

  triggerNoteAttack(trackId: string, note: number, config: InstrumentConfig, velocity: number) {
      const channel = this.getTrackChannel(trackId);
      const voice = new SynthVoice(this.ctx, channel.input, config);
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      
      voice.play(freq, velocity, this.ctx.currentTime, config);
      this.scheduledSynthVoices.add(voice);
      
      if (!channel.activeVoices) channel.activeVoices = new Map();
      channel.activeVoices.set(note, voice);
  }

  triggerNoteRelease(trackId: string, note: number) {
      const channel = this.getTrackChannel(trackId);
      if (channel && channel.activeVoices) {
          const voice = channel.activeVoices.get(note);
          if (voice) {
              voice.triggerRelease();
              channel.activeVoices.delete(note);
              setTimeout(() => {
                  this.scheduledSynthVoices.delete(voice);
              }, (voice.config.release * 1000) + 200);
          }
      }
  }

  scheduleNote(trackId: string, note: number, time: number, duration: number, config: InstrumentConfig, velocity: number) {
      const channel = this.getTrackChannel(trackId);
      const voice = new SynthVoice(this.ctx, channel.input, config);
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      const startTime = this._startTime + time;
      
      voice.play(freq, velocity, startTime, config);
      voice.triggerRelease(startTime + duration);
      this.scheduledSynthVoices.add(voice);
  }

  async initInput(deviceId?: string) {
      await this.recorder.initInput(deviceId);
  }

  closeInput() {
      this.recorder.closeInput();
  }

  async getAudioDevices() {
      return this.recorder.getAudioDevices();
  }

  async startRecording(monitoring: boolean) {
      return this.recorder.start(monitoring);
  }

  async stopRecording() {
      return this.recorder.stop();
  }

  setOutputDevice(deviceId: string) {
      // @ts-ignore
      if (this.ctx.setSinkId) {
          // @ts-ignore
          this.ctx.setSinkId(deviceId).catch(e => console.warn(e));
      }
  }

  async playCountIn(bars: number, bpm: number) {
      if (bars <= 0) return;
      this.metronomeEnabled = true; 
      const secondsPerBeat = 60 / bpm;
      const totalTime = bars * 4 * secondsPerBeat;
      
      const now = this.ctx.currentTime;
      for (let i = 0; i < bars * 4; i++) {
          this.scheduleMetronome(now + (i * secondsPerBeat), i);
      }
      
      return new Promise<void>(resolve => setTimeout(resolve, totalTime * 1000));
  }

  private createImpulseResponse() {
      const rate = this.ctx.sampleRate;
      const length = rate * 2.0; 
      const impulse = this.ctx.createBuffer(2, length, rate);
      const L = impulse.getChannelData(0);
      const R = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
          const decay = Math.pow(1 - i / length, 3);
          L[i] = (Math.random() * 2 - 1) * decay;
          R[i] = (Math.random() * 2 - 1) * decay;
      }
      this.reverbNode.buffer = impulse;
  }

  private generateMetronomeSounds() {
      const rate = this.ctx.sampleRate;
      
      // Beep (Sine with envelope)
      const beepLen = Math.floor(0.1 * rate);
      const beepBuf = this.ctx.createBuffer(1, beepLen, rate);
      const beepData = beepBuf.getChannelData(0);
      for(let i=0; i<beepLen; i++) {
          beepData[i] = Math.sin(i * 0.1) * Math.exp(-i/(rate*0.015));
      }
      this.metronomeBuffers.set('beep', beepBuf);

      // Click (Woodblock-ish resonant filter)
      const clickLen = Math.floor(0.05 * rate);
      const clickBuf = this.ctx.createBuffer(1, clickLen, rate);
      const clickData = clickBuf.getChannelData(0);
      for(let i=0; i<clickLen; i++) {
          clickData[i] = (Math.random() * 0.2 + Math.sin(i * 0.3)) * Math.exp(-i/(rate*0.005));
      }
      this.metronomeBuffers.set('click', clickBuf);

      // Hi-Hat (Filtered Noise)
      const hatLen = Math.floor(0.05 * rate);
      const hatBuf = this.ctx.createBuffer(1, hatLen, rate);
      const hatData = hatBuf.getChannelData(0);
      for(let i=0; i<hatLen; i++) {
          // Simple High pass noise approximation
          const white = Math.random() * 2 - 1;
          hatData[i] = (white - (i > 0 ? hatData[i-1] : 0) * 0.5) * Math.exp(-i/(rate*0.01));
      }
      this.metronomeBuffers.set('hihat', hatBuf);
  }

  setMasterCompressor(threshold: number, ratio: number, knee: number, attack: number, release: number) {
      this.masterCompressor.threshold.value = threshold;
      this.masterCompressor.ratio.value = ratio;
      this.masterCompressor.knee.value = knee || 30;
      this.masterCompressor.attack.value = attack || 0.003;
      this.masterCompressor.release.value = release || 0.25;
  }

  setMasterEq(low: number, mid: number, high: number) {
      this.masterLow.gain.setTargetAtTime(low, this.ctx.currentTime, 0.1);
      this.masterMid.gain.setTargetAtTime(mid, this.ctx.currentTime, 0.1);
      this.masterHigh.gain.setTargetAtTime(high, this.ctx.currentTime, 0.1);
  }

  setReverbLevel(val: number) { this.reverbReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1); }
  setDelayLevel(val: number) { this.delayReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1); }
  setChorusLevel(val: number) { this.chorusReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1); }

  measureInputLevel() {
      const array = new Uint8Array(this.inputAnalyser.frequencyBinCount);
      this.inputAnalyser.getByteTimeDomainData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
          const val = (array[i] - 128) / 128;
          sum += val * val;
      }
      return Math.sqrt(sum / array.length);
  }

  measureTrackLevel(trackId: string) {
      const ch = this.trackChannels.get(trackId);
      if (!ch) return 0;
      const array = new Uint8Array(ch.analyser.frequencyBinCount);
      ch.analyser.getByteTimeDomainData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
          const val = (array[i] - 128) / 128;
          sum += val * val;
      }
      return Math.sqrt(sum / array.length);
  }

  measureMasterLevel() {
      const array = new Uint8Array(this.masterAnalyser.frequencyBinCount);
      this.masterAnalyser.getByteTimeDomainData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
          const val = (array[i] - 128) / 128;
          sum += val * val;
      }
      return Math.sqrt(sum / array.length);
  }

  processAudioBuffer(key: string, type: 'reverse' | 'normalize'): AudioBuffer {
      const source = this.buffers.get(key);
      if (!source) throw new Error("Buffer not found");
      
      const newBuffer = this.ctx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
      
      for (let i = 0; i < source.numberOfChannels; i++) {
          const data = source.getChannelData(i);
          const newData = new Float32Array(data);
          
          if (type === 'reverse') {
              newData.reverse();
          } else if (type === 'normalize') {
              let max = 0;
              for(let j=0; j<newData.length; j++) if(Math.abs(newData[j]) > max) max = Math.abs(newData[j]);
              if (max > 0) {
                  const gain = 1 / max;
                  for(let j=0; j<newData.length; j++) newData[j] *= gain;
              }
          }
          newBuffer.copyToChannel(newData, i);
      }
      return newBuffer;
  }

  async renderProject(project: ProjectState): Promise<Blob | null> {
      let maxTime = 0;
      project.clips.forEach(c => {
          if (c.start + c.duration > maxTime) maxTime = c.start + c.duration;
      });
      maxTime += 2; 

      const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineContext(2, maxTime * 44100, 44100);
      
      const master = offlineCtx.createGain();
      master.connect(offlineCtx.destination);
      master.gain.value = project.masterVolume;

      for (const track of project.tracks) {
          if (track.muted) continue;
          const clips = project.clips.filter(c => c.trackId === track.id);
          
          for (const clip of clips) {
              if (clip.muted) continue;
              if (clip.bufferKey && this.buffers.has(clip.bufferKey)) {
                  const src = offlineCtx.createBufferSource();
                  src.buffer = this.buffers.get(clip.bufferKey);
                  
                  const gain = offlineCtx.createGain();
                  gain.gain.value = track.volume * (clip.gain ?? 1.0);
                  
                  src.connect(gain);
                  gain.connect(master);
                  
                  src.start(clip.start, clip.offset, clip.duration);
              }
          }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
  }
}

export const audio = new AudioEngine();
