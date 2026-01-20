
import { Clip, Track, ProjectState, TanpuraState, TablaState, InstrumentConfig } from '../types';
import { audioBufferToWav, makeDistortionCurve } from './utils';

// Standardized Interface for both Live and Offline contexts
interface AudioGraphChain {
    input: GainNode;
    distortionNode: WaveShaperNode;
    lowFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    highFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    gain: GainNode; // Fader
    panner: StereoPannerNode;
    analyser?: AnalyserNode; 
    reverbSend: GainNode;
    delaySend: GainNode;
    chorusSend: GainNode;
}

interface LiveTrackChannel extends AudioGraphChain {
    analyser: AnalyserNode;
    // Cache for Dirty Checking to prevent redundant AudioParam updates
    lastState: Partial<Track>;
    // Synth Voices for Live Input (MIDI Keyboard)
    activeVoices: Map<number, SynthVoice>; // MIDI Note -> Voice
}

class SynthVoice {
    osc: OscillatorNode;
    env: GainNode;
    ctx: BaseAudioContext;
    config: InstrumentConfig;
    isStopped: boolean = false;
    
    // Updated constructor to take explicit startTime and BaseAudioContext
    constructor(ctx: BaseAudioContext, destination: AudioNode, freq: number, config: InstrumentConfig, velocity: number = 127, startTime: number) {
        this.ctx = ctx;
        this.config = config;
        
        // Velocity Scaling (0-1)
        const velGain = Math.pow(velocity / 127, 1.5);

        this.osc = ctx.createOscillator();
        this.osc.type = config.preset;
        this.osc.frequency.value = freq;
        
        this.env = ctx.createGain();
        this.env.gain.value = 0;
        
        this.osc.connect(this.env);
        this.env.connect(destination);
        
        const { attack, decay, sustain } = this.config;
        const now = startTime;
        
        this.osc.start(now);
        
        // Attack
        this.env.gain.cancelScheduledValues(now);
        this.env.gain.setValueAtTime(0, now);
        this.env.gain.linearRampToValueAtTime(velGain, now + Math.max(0.005, attack)); 
        // Decay to Sustain
        this.env.gain.exponentialRampToValueAtTime(Math.max(0.001, sustain * velGain), now + attack + decay);
    }

    triggerRelease(releaseTime?: number) {
        if (this.isStopped) return;
        const now = releaseTime ?? this.ctx.currentTime;
        const { release } = this.config;
        
        // Cancel any future scheduled values
        try {
            this.env.gain.cancelScheduledValues(now);
            
            // Ramp to 0
            this.env.gain.setTargetAtTime(0, now, release / 3);
            
            const stopTime = now + release + 0.1;
            this.osc.stop(stopTime);
            
            // Cleanup schedule only if running in real-time context
            if (this.ctx instanceof AudioContext) {
                setTimeout(() => this.disconnect(), (release + 0.2) * 1000);
            }
        } catch(e) {
            // Context might be closed
        }
    }
    
    stopNow() {
        if (this.isStopped) return;
        try {
            this.env.gain.cancelScheduledValues(this.ctx.currentTime);
            this.env.gain.setValueAtTime(0, this.ctx.currentTime);
            this.osc.stop();
            this.disconnect();
        } catch(e) {}
    }

    disconnect() {
        if (this.isStopped) return;
        this.isStopped = true;
        try {
            this.osc.disconnect();
            this.env.disconnect();
        } catch (e) {
            console.warn("Error disconnecting SynthVoice", e);
        }
    }
}

const NOTE_FREQS: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

function midiToFreq(note: number) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

// Inline Worker for Peak Generation to avoid main thread blocking
const PEAK_WORKER_CODE = `
self.onmessage = function(e) {
  const { channelData, samplesPerPeak } = e.data;
  const length = Math.ceil(channelData.length / samplesPerPeak);
  const peaks = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let max = 0;
    // Stride optimization: don't check every sample for zoomed out view
    const stride = 10; 
    for (let j = start; j < end; j += stride) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks[i] = max;
  }
  self.postMessage(peaks);
};
`;

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
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map();

  peaks: Map<string, Float32Array> = new Map(); 
  
  activeSources: Map<string, AudioBufferSourceNode> = new Map();
  // Track scheduled synth voices for playback to stop them
  scheduledSynthVoices: Set<SynthVoice> = new Set();
  
  trackChannels: Map<string, LiveTrackChannel> = new Map();

  private _isPlaying: boolean = false;
  private _startTime: number = 0;
  private _pauseTime: number = 0;

  // Metronome State
  public bpm: number = 120;
  public timeSignature: [number, number] = [4, 4];
  public metronomeEnabled: boolean = false;
  public metronomeSound: 'beep' | 'click' | 'hihat' = 'beep';
  private nextNoteTime: number = 0;
  private currentBeat: number = 0;

  // Drone & Percussion State
  private tanpuraGain: GainNode;
  private tablaGain: GainNode;
  private nextTanpuraNoteTime: number = 0;
  public currentTanpuraString: number = 0;
  private nextTablaBeatTime: number = 0;
  public currentTablaBeat: number = 0;
  
  private tanpuraConfig: TanpuraState | null = null;
  private tablaConfig: TablaState | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private recordingMimeType: string = 'audio/webm';
  public selectedInputDeviceId: string | undefined;
  
  // Monitoring
  private monitorNode: MediaStreamAudioSourceNode | null = null;
  private activeStream: MediaStream | null = null;
  private monitorGain: GainNode;
  private inputAnalyser: AnalyserNode; 

  private noiseBuffer: AudioBuffer | null = null;
  private peakWorker: Worker | null = null;

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

    // Monitoring
    this.monitorGain = this.ctx.createGain();
    this.monitorGain.gain.value = 0; // Muted by default
    
    // Input Analyser
    this.inputAnalyser = this.ctx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.3;

    this.setupRouting();
    this.loadImpulseResponse();
    this.createNoiseBuffer();
    this.initPeakWorker();
  }

  initPeakWorker() {
      if (typeof Blob !== 'undefined' && typeof Worker !== 'undefined') {
          const blob = new Blob([PEAK_WORKER_CODE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          this.peakWorker = new Worker(url);
          this.peakWorker.onmessage = (e) => {
              // We need a mechanism to map result back to key. 
              // For simplicity in this single-worker implementation, we can't easily map back without ID.
              // Updating computePeaks to async pattern is cleaner.
          };
      }
  }

  async resumeContext() {
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
  }

  public clearBuffers() {
    this.stop();
    this.buffers.clear();
    this.peaks.clear();
    this.loadingPromises.clear();
    this.trackChannels.forEach(ch => this.disconnectChannel(ch));
    this.trackChannels.clear();
  }

  private disconnectChannel(channel: AudioGraphChain) {
      try {
          channel.input.disconnect();
          channel.panner.disconnect();
          channel.gain.disconnect();
          channel.reverbSend.disconnect();
          channel.delaySend.disconnect();
          channel.chorusSend.disconnect();
      } catch (e) {
          // Ignore disconnection errors if already disconnected
      }
  }

  setupRouting() {
    this.masterGain.connect(this.masterLow);
    this.masterLow.connect(this.masterMid);
    this.masterMid.connect(this.masterHigh);
    this.masterHigh.connect(this.compressor);
    this.compressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.monitorGain.connect(this.masterGain);

    this.reverbInput.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterGain);

    this.delayNode.delayTime.value = 0.4;
    this.delayReturn.gain.value = 0.0; 
    this.delayInput.connect(this.delayNode);
    
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.4;
    this.delayNode.connect(feedback);
    feedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.masterGain);

    this.chorusDelay.delayTime.value = 0.03; 
    this.chorusLFO.type = 'sine';
    this.chorusLFO.frequency.value = 1.5; 
    this.chorusLFOGain.gain.value = 0.002;
    
    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelay.delayTime);
    
    this.chorusInput.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusReturn);
    this.chorusReturn.connect(this.masterGain);
    
    this.chorusLFO.start();

    this.metronomeGain.connect(this.masterGain);

    this.tanpuraGain.connect(this.reverbInput); 
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
    const length = sampleRate * 2; 
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
    if (this.loadingPromises.has(key)) return this.loadingPromises.get(key)!;

    const loadPromise = (async () => {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(key, audioBuffer);
            this.computePeaks(key, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.error("Error decoding audio data:", e);
            throw new Error("Failed to decode audio.");
        } finally {
            this.loadingPromises.delete(key);
        }
    })();

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  computePeaks(key: string, buffer: AudioBuffer) {
      if (buffer.length === 0) return;
      const samplesPerPeak = Math.floor(buffer.sampleRate / 100);
      
      if (this.peakWorker) {
          const channelData = buffer.getChannelData(0);
          // Post message to worker
          const listener = (e: MessageEvent) => {
              this.peaks.set(key, e.data);
              this.peakWorker?.removeEventListener('message', listener);
          };
          this.peakWorker.addEventListener('message', listener);
          this.peakWorker.postMessage({ channelData, samplesPerPeak });
      } else {
          // Fallback sync computation (if worker fails or testing env)
          const length = Math.ceil(buffer.length / samplesPerPeak);
          const peaks = new Float32Array(length);
          const data = buffer.getChannelData(0); 
          const stride = 10; 
          for (let i = 0; i < length; i++) {
              const start = i * samplesPerPeak;
              const end = Math.min(start + samplesPerPeak, buffer.length);
              let max = 0;
              for (let j = start; j < end; j += stride) {
                  const val = Math.abs(data[j]);
                  if (val > max) max = val;
              }
              peaks[i] = max;
          }
          this.peaks.set(key, peaks);
      }
  }

  getPeaks(key: string): Float32Array | undefined {
      return this.peaks.get(key);
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
           for (let i = 0; i < channels; i++) {
              newBuffer.copyToChannel(original.getChannelData(i), i);
           }
      }
      return newBuffer;
  }

  createTrackGraph(context: BaseAudioContext, destination: AudioNode): AudioGraphChain {
      const input = context.createGain(); 
      const distortionNode = context.createWaveShaper();
      distortionNode.oversample = '4x';
      const lowFilter = context.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 320;
      const midFilter = context.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1.0;
      const highFilter = context.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 3200;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = 0; 
      compressor.ratio.value = 1;
      const gain = context.createGain(); // Fader
      const panner = context.createStereoPanner();
      const reverbSend = context.createGain();
      const delaySend = context.createGain();
      const chorusSend = context.createGain();

      input.connect(distortionNode);
      distortionNode.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(compressor);
      compressor.connect(gain);
      gain.connect(panner);
      panner.connect(destination);

      return {
          input, distortionNode, lowFilter, midFilter, highFilter, compressor,
          gain, panner, reverbSend, delaySend, chorusSend
      };
  }

  getTrackChannel(trackId: string): LiveTrackChannel {
    if (!this.trackChannels.has(trackId)) {
      const chain = this.createTrackGraph(this.ctx, this.masterGain);
      chain.gain.disconnect(); 
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      chain.gain.connect(analyser);
      analyser.connect(chain.panner);
      chain.panner.connect(chain.reverbSend);
      chain.reverbSend.connect(this.reverbInput);
      chain.panner.connect(chain.delaySend);
      chain.delaySend.connect(this.delayInput);
      chain.panner.connect(chain.chorusSend);
      chain.chorusSend.connect(this.chorusInput);
      
      const liveChannel: LiveTrackChannel = {
          ...chain,
          analyser,
          lastState: {},
          activeVoices: new Map()
      };
      this.trackChannels.set(trackId, liveChannel);
    }
    return this.trackChannels.get(trackId)!;
  }

  triggerNoteAttack(trackId: string, note: number, config: InstrumentConfig, velocity: number = 127) {
      const channel = this.getTrackChannel(trackId);
      
      // Polyphony Limit (Voice Stealing)
      if (channel.activeVoices.size >= 16) {
          const oldestNote = channel.activeVoices.keys().next().value;
          if (oldestNote !== undefined) {
              const oldVoice = channel.activeVoices.get(oldestNote);
              oldVoice?.triggerRelease();
              channel.activeVoices.delete(oldestNote);
          }
      }

      // Stop existing voice for same note
      if (channel.activeVoices.has(note)) {
          channel.activeVoices.get(note)?.triggerRelease();
      }
      
      const freq = midiToFreq(note);
      // Pass currentTime specifically
      const voice = new SynthVoice(this.ctx, channel.input, freq, config, velocity, this.ctx.currentTime);
      channel.activeVoices.set(note, voice);
  }

  triggerNoteRelease(trackId: string, note: number) {
      const channel = this.getTrackChannel(trackId);
      if (channel.activeVoices.has(note)) {
          const voice = channel.activeVoices.get(note)!;
          voice.triggerRelease();
          // Clean up map entry immediately (voice cleans itself up via onended)
          channel.activeVoices.delete(note);
      }
  }

  scheduleNote(trackId: string, note: number, startTime: number, duration: number, config: InstrumentConfig, velocity: number = 127) {
      const channel = this.getTrackChannel(trackId);
      const freq = midiToFreq(note);
      // NOTE: scheduleNote creates a voice that self-terminates after duration
      const voice = new SynthVoice(this.ctx, channel.input, freq, config, velocity, startTime);
      voice.triggerRelease(startTime + duration);
      
      // Track it to stop it if transport stops
      this.scheduledSynthVoices.add(voice);
      // Clean up reference on stop if it happens naturally
      setTimeout(() => {
          this.scheduledSynthVoices.delete(voice);
      }, (duration + config.release + 1) * 1000); 
  }

  applyTrackSettings(chain: AudioGraphChain, track: Track, currentTime: number, isOffline: boolean) {
      const { gain, panner, lowFilter, midFilter, highFilter, compressor, distortionNode, reverbSend, delaySend, chorusSend } = chain;
      const liveChain = !isOffline ? (chain as LiveTrackChannel) : null;
      const prev = liveChain?.lastState || {};

      const isMuted = track.muted;
      const targetVolume = isMuted ? 0 : track.volume;
      if (isOffline || prev.volume !== targetVolume || prev.muted !== isMuted) {
          if (isOffline) gain.gain.value = targetVolume;
          else gain.gain.setTargetAtTime(targetVolume, currentTime, 0.02);
      }
      if (isOffline || prev.pan !== track.pan) {
          if (isOffline) panner.pan.value = track.pan;
          else panner.pan.setTargetAtTime(track.pan, currentTime, 0.02);
      }
      if (isOffline || prev.eq?.low !== track.eq.low) {
          if (isOffline) lowFilter.gain.value = track.eq.low;
          else lowFilter.gain.setTargetAtTime(track.eq.low, currentTime, 0.1);
      }
      if (isOffline || prev.eq?.mid !== track.eq.mid) {
          if (isOffline) midFilter.gain.value = track.eq.mid;
          else midFilter.gain.setTargetAtTime(track.eq.mid, currentTime, 0.1);
      }
      if (isOffline || prev.eq?.high !== track.eq.high) {
          if (isOffline) highFilter.gain.value = track.eq.high;
          else highFilter.gain.setTargetAtTime(track.eq.high, currentTime, 0.1);
      }
      const dist = track.distortion || 0;
      const prevDist = prev.distortion || 0;
      if (isOffline || dist !== prevDist) {
          if (dist > 0) distortionNode.curve = makeDistortionCurve(dist);
      }
      const comp = track.compressor;
      const prevComp = prev.compressor;
      if (comp && comp.enabled) {
          if (isOffline || prevComp?.threshold !== comp.threshold) {
              const v = comp.threshold;
              isOffline ? (compressor.threshold.value = v) : compressor.threshold.setTargetAtTime(v, currentTime, 0.1);
          }
          if (isOffline || prevComp?.ratio !== comp.ratio) {
              const v = comp.ratio;
              isOffline ? (compressor.ratio.value = v) : compressor.ratio.setTargetAtTime(v, currentTime, 0.1);
          }
          if (isOffline || prevComp?.attack !== comp.attack) {
              const v = comp.attack || 0.003;
              isOffline ? (compressor.attack.value = v) : compressor.attack.setTargetAtTime(v, currentTime, 0.1);
          }
          if (isOffline || prevComp?.release !== comp.release) {
              const v = comp.release || 0.25;
              isOffline ? (compressor.release.value = v) : compressor.release.setTargetAtTime(v, currentTime, 0.1);
          }
      } else if (isOffline || (prevComp && prevComp.enabled && !comp?.enabled)) {
          isOffline ? (compressor.threshold.value = 0) : compressor.threshold.setTargetAtTime(0, currentTime, 0.1);
          isOffline ? (compressor.ratio.value = 1) : compressor.ratio.setTargetAtTime(1, currentTime, 0.1);
      }
      if (isOffline || prev.sends?.reverb !== track.sends.reverb) {
          const v = track.sends.reverb;
          isOffline ? (reverbSend.gain.value = v) : reverbSend.gain.setTargetAtTime(v, currentTime, 0.05);
      }
      if (isOffline || prev.sends?.delay !== track.sends.delay) {
          const v = track.sends.delay;
          isOffline ? (delaySend.gain.value = v) : delaySend.gain.setTargetAtTime(v, currentTime, 0.05);
      }
      if (isOffline || prev.sends?.chorus !== track.sends.chorus) {
          const v = track.sends.chorus;
          isOffline ? (chorusSend.gain.value = v) : chorusSend.gain.setTargetAtTime(v, currentTime, 0.05);
      }
      if (liveChain) {
          liveChain.lastState = { ...track };
      }
  }

  syncTracks(tracks: Track[]) {
    const activeIds = new Set(tracks.map(t => t.id));
    for (const [id, channel] of this.trackChannels) {
        if (!activeIds.has(id)) {
            this.disconnectChannel(channel);
            this.trackChannels.delete(id);
        }
    }
    const soloActive = tracks.some(t => t.solo);
    tracks.forEach(track => {
      const channel = this.getTrackChannel(track.id);
      const currentTime = this.ctx.currentTime;
      const effectiveMuted = track.muted || (soloActive && !track.solo);
      const effectiveTrack = { ...track, muted: effectiveMuted };
      this.applyTrackSettings(channel, effectiveTrack, currentTime, false);
    });
  }

  syncInstruments(tanpura: TanpuraState, tabla: TablaState) {
      this.tanpuraConfig = tanpura;
      this.tablaConfig = tabla;
      const currentTime = this.ctx.currentTime;
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
    
    const safeBpm = Math.max(20, Math.min(999, this.bpm || 120));
    const secondsPerBeat = 60.0 / safeBpm;
    
    const [numerator, denominator] = this.timeSignature;
    const beatMultiplier = 4 / denominator; 
    const secondsPerTick = secondsPerBeat * beatMultiplier;

    this.currentBeat = Math.ceil(startTime / secondsPerTick);
    const nextBeatTimeRelative = this.currentBeat * secondsPerTick;
    
    this.nextNoteTime = this.ctx.currentTime + (nextBeatTimeRelative - startTime);
    this.nextTanpuraNoteTime = this.ctx.currentTime + 0.1;
    this.currentTanpuraString = 0;
    this.nextTablaBeatTime = this.ctx.currentTime + 0.1;
    this.currentTablaBeat = 0;
    this.syncTracks(tracks);
    
    clips.forEach(clip => {
      if (clip.muted) return;
      if (clip.bufferKey) {
          // Audio Clip
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
      }
      // MIDI clips are handled in scheduler
    });
  }

  scheduleSource(buffer: AudioBuffer, when: number, offset: number, playDuration: number, destination: AudioNode, clip: Clip, elapsedClipTime: number, ctx: BaseAudioContext = this.ctx) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const speed = clip.speed || 1;
    source.playbackRate.value = speed;
    if (clip.detune) source.detune.value = clip.detune;
    const envelope = ctx.createGain();
    source.connect(envelope);
    envelope.connect(destination); 
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
    const bufferOffset = offset % buffer.duration;
    if (bufferOffset + (playDuration * speed) > buffer.duration) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
    }
    source.start(when, bufferOffset, playDuration);
    source.stop(when + playDuration);
    if (ctx === this.ctx) {
        const sourceId = clip.id + Math.random();
        this.activeSources.set(sourceId, source as AudioBufferSourceNode);
        source.onended = () => {
            if (this.activeSources.has(sourceId)) {
                this.activeSources.delete(sourceId);
            }
        };
    }
  }

  stop() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch(_e) {}
    });
    this.activeSources.clear();
    
    // Stop scheduled synth voices
    this.scheduledSynthVoices.forEach(voice => voice.stopNow());
    this.scheduledSynthVoices.clear();

    this.trackChannels.forEach(ch => {
        ch.activeVoices.forEach(v => v.triggerRelease());
        ch.activeVoices.clear();
    });
    this._isPlaying = false;
  }

  pause() {
      this.stop();
  }

  panic() {
    this.stop();
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.value = 0;
    setTimeout(() => {
        this.masterGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.5);
    }, 100);
  }

  setMasterVolume(val: number) { this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05); }
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
  setMetronomeVolume(val: number) { this.metronomeGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05); }
  setDelayLevel(val: number) { this.delayReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05); }
  setReverbLevel(val: number) { this.reverbReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05); }
  setChorusLevel(val: number) { this.chorusReturn.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05); }

  getCurrentTime(): number {
      if (!this._isPlaying) return this._pauseTime;
      return this.ctx.currentTime - this._startTime;
  }
  
  get isPlaying() { return this._isPlaying; }
  
  private getRMS(analyser: AnalyserNode) {
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  measureTrackLevel(trackId: string): number {
    const channel = this.trackChannels.get(trackId);
    if (!channel) return 0;
    return this.getRMS(channel.analyser);
  }
  measureMasterLevel(): number { return this.getRMS(this.masterAnalyser); }
  measureInputLevel(): number { return this.getRMS(this.inputAnalyser); }

  scheduler(projectTracks?: Track[], projectClips?: Clip[]) {
    if (!this._isPlaying) return;
    const lookahead = 0.15; // Increased slightly for note stability
    
    const safeBpm = Math.max(20, Math.min(999, this.bpm || 120));
    const secondsPerBeat = 60.0 / safeBpm;
    const [numerator, denominator] = this.timeSignature;
    const beatMultiplier = 4 / denominator; 
    const secondsPerTick = secondsPerBeat * beatMultiplier;

    if (secondsPerTick <= 0 || !Number.isFinite(secondsPerTick)) return;

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        if (this.metronomeEnabled) {
            this.scheduleClick(this.currentBeat, this.nextNoteTime);
        }
        this.nextNoteTime += secondsPerTick;
        this.currentBeat++;
    }
    
    // Tanpura & Tabla logic
    if (this.tanpuraConfig?.enabled) {
        while (this.nextTanpuraNoteTime < this.ctx.currentTime + lookahead) {
            const freqs = this.getTanpuraFreqs(this.tanpuraConfig);
            const freq = freqs[this.currentTanpuraString];
            this.playTanpuraNote(this.ctx, this.tanpuraGain, freq, this.nextTanpuraNoteTime, 2.0, this.tanpuraConfig.fineTune || 0);
            const interval = 60 / Math.max(1, this.tanpuraConfig.tempo);
            this.nextTanpuraNoteTime += interval;
            this.currentTanpuraString = (this.currentTanpuraString + 1) % 4;
        }
    }
    if (this.tablaConfig?.enabled) {
         while (this.nextTablaBeatTime < this.ctx.currentTime + lookahead) {
            const pattern = this.getTablaPattern(this.tablaConfig.taal);
            const hit = pattern[this.currentTablaBeat % pattern.length];
            this.playTablaHit(this.ctx, this.tablaGain, this.tablaConfig.key, hit as any, this.nextTablaBeatTime);
            const beatTime = 60 / Math.max(1, this.tablaConfig.bpm);
            this.nextTablaBeatTime += beatTime;
            this.currentTablaBeat++;
         }
    }

    // Schedule MIDI Notes from Clips
    if (projectTracks && projectClips) {
        try {
            const now = this.ctx.currentTime;
            const schedulerWindowStart = now - this._startTime; // Project time
            const schedulerWindowEnd = schedulerWindowStart + lookahead;

            projectClips.forEach(clip => {
                if (clip.muted || !clip.notes) return;
                const track = projectTracks.find(t => t.id === clip.trackId);
                if (!track || track.type !== 'instrument' || !track.instrument) return;

                const clipStart = clip.start;
                const clipEnd = clip.start + clip.duration;
                const clipOffset = clip.offset || 0;
                
                // If the clip is not in the scheduling window, skip it
                if (clipEnd < schedulerWindowStart || clipStart > schedulerWindowEnd) return;

                const loopLength = clip.loopLength || clip.duration; // Use valid loop length or duration

                clip.notes.forEach(note => {
                    // Base timeline position of the note in the first iteration
                    // Note start relative to clip start (ignoring loop)
                    const baseTime = clipStart - clipOffset + note.start;
                    
                    let startK = 0;
                    if (loopLength > 0) {
                        // Find first iteration that could be within the scheduler window
                        // baseTime + k*loopLength >= schedulerWindowStart
                        startK = Math.ceil((schedulerWindowStart - baseTime) / loopLength);
                        // Ensure we don't look at iterations before the clip's valid content start if offset is involved
                        // But typically MIDI loop starts at 0 relative to clip content.
                        startK = Math.max(0, startK);
                    }
                    
                    // Check a few iterations to be safe
                    let k = startK;
                    let iterationsChecked = 0;
                    
                    while (iterationsChecked < 100) { 
                        const absStart = baseTime + (k * loopLength);
                        
                        if (absStart >= schedulerWindowEnd) break; // Future notes, done with this note
                        
                        // Handle trimming at start: absStart >= clipStart
                        if (absStart < clipStart) {
                            k++;
                            iterationsChecked++;
                            continue;
                        }
                        
                        if (absStart >= clipEnd) break; // Past clip end
                        
                        // Truncate duration if it extends past clip end
                        let duration = note.duration;
                        if (absStart + duration > clipEnd) {
                            duration = clipEnd - absStart;
                        }
                        
                        // Schedule it if within window
                        if (absStart >= schedulerWindowStart) {
                             const schedTime = this._startTime + absStart;
                             this.scheduleNote(
                                track.id, 
                                note.note, 
                                schedTime, 
                                duration, 
                                track.instrument!, 
                                note.velocity
                            );
                        }
                        
                        if (loopLength <= 0) break; // Should not happen if duration > 0
                        k++;
                        iterationsChecked++;
                    }
                });
            });
        } catch (e) {
            console.error("Error in MIDI scheduler", e);
        }
    }
  }

  // Metronome
  scheduleClick(beat: number, time: number) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.metronomeGain);

      if (this.metronomeSound === 'beep') {
          osc.frequency.value = beat % 4 === 0 ? 1000 : 800;
          osc.type = 'sine';
      } else if (this.metronomeSound === 'click') {
          osc.frequency.value = beat % 4 === 0 ? 1200 : 800; 
          osc.type = 'square'; 
      } else {
          osc.type = 'square'; 
          osc.frequency.value = 8000;
      }

      osc.start(time);
      osc.stop(time + 0.05);
      
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  }

  // Tanpura
  getTanpuraFreqs(config: TanpuraState): number[] {
      const rootFreq = NOTE_FREQS[config.key] || 261.63; // Middle C
      
      const sa = rootFreq;
      const saLow = sa / 2;
      
      let firstStringFreq = saLow * 1.5; // Pa lower
      if (config.tuning === 'Ma') firstStringFreq = saLow * 1.333;
      if (config.tuning === 'Ni') firstStringFreq = saLow * 1.875;

      return [firstStringFreq, sa, sa, saLow];
  }

  playTanpuraNote(ctx: BaseAudioContext, destination: AudioNode, freq: number, time: number, duration: number, fineTune: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth'; 
      
      osc.frequency.value = freq;
      osc.detune.value = fineTune;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start(time);
      osc.stop(time + duration);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + duration * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  }

  // Tabla
  getTablaPattern(taal: string): string[] {
      switch (taal) {
          case 'TeenTaal': return ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'];
          case 'Keherwa': return ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ka', 'Dhin', 'Na'];
          case 'Dadra': return ['Dha', 'Dhin', 'Na', 'Dha', 'Tin', 'Na'];
          default: return ['Dha'];
      }
  }

  playTablaHit(ctx: BaseAudioContext, destination: AudioNode, key: string, hit: string, time: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(destination);
      
      const rootFreq = NOTE_FREQS[key] || 261.63;
      
      if (['Dha', 'Dhin', 'Ga', 'Ge'].includes(hit)) {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(100, time);
          osc.frequency.exponentialRampToValueAtTime(80, time + 0.3);
          gain.gain.setValueAtTime(0.8, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
          osc.start(time);
          osc.stop(time + 0.4);
      }
      
      if (['Dha', 'Dhin', 'Ta', 'Na', 'Tin'].includes(hit)) {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(destination);
          
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(rootFreq * 2, time); 
          gain2.gain.setValueAtTime(0.4, time);
          gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          
          osc2.start(time);
          osc2.stop(time + 0.2);
      }
  }

  // Recording
  async startRecording(monitoring: boolean) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      
      if (!this.activeStream) {
          await this.initInput(this.selectedInputDeviceId);
      }
      
      if (!this.activeStream) throw new Error("No input stream available");

      this.mediaRecorder = new MediaRecorder(this.activeStream);
      this.recordedChunks = [];
      
      this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      
      this.mediaRecorder.start();
      
      if (monitoring && this.monitorNode) {
          this.monitorGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.1);
      } else {
          this.monitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
  }

  stopRecording(): Promise<Blob> {
      return new Promise((resolve) => {
          if (!this.mediaRecorder) {
              resolve(new Blob()); 
              return;
          }
          
          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: this.recordingMimeType });
              this.recordedChunks = [];
              this.monitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
              resolve(blob);
          };
          this.mediaRecorder.stop();
          this.mediaRecorder = null;
      });
  }

  async playCountIn(bars: number, bpm: number) {
      const beats = bars * 4; 
      const interval = 60 / bpm;
      const now = this.ctx.currentTime;
      
      for (let i = 0; i < beats; i++) {
          this.scheduleClick(i, now + i * interval);
      }
      
      return new Promise<void>(resolve => {
          setTimeout(resolve, beats * interval * 1000);
      });
  }

  // Audio I/O
  async getAudioDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
          inputs: devices.filter(d => d.kind === 'audioinput'),
          outputs: devices.filter(d => d.kind === 'audiooutput')
      };
  }

  async initInput(deviceId?: string) {
      if (this.activeStream) {
          this.activeStream.getTracks().forEach(t => t.stop());
      }
      try {
          const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true };
          this.activeStream = await navigator.mediaDevices.getUserMedia(constraints);
          this.selectedInputDeviceId = deviceId;
          
          this.monitorNode = this.ctx.createMediaStreamSource(this.activeStream);
          this.monitorNode.connect(this.inputAnalyser);
          this.inputAnalyser.connect(this.monitorGain);
          
      } catch (e) {
          console.error("Error accessing microphone", e);
      }
  }

  closeInput() {
      if (this.activeStream) {
          this.activeStream.getTracks().forEach(t => t.stop());
          this.activeStream = null;
      }
      if (this.monitorNode) {
          this.monitorNode.disconnect();
          this.monitorNode = null;
      }
  }

  async setOutputDevice(deviceId: string) {
      // @ts-ignore
      if (typeof this.ctx.setSinkId === 'function') {
          // @ts-ignore
          await this.ctx.setSinkId(deviceId);
      } else {
          console.warn("setSinkId not supported");
      }
  }

  async renderProject(project: ProjectState): Promise<Blob> {
      const maxTime = Math.max(
          project.loopEnd,
          ...project.clips.map(c => c.start + c.duration)
      ) + 2; 

      const sampleRate = 44100;
      const length = Math.ceil(maxTime * sampleRate);
      const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = project.masterVolume;
      masterGain.connect(offlineCtx.destination);
      
      for (const track of project.tracks) {
          if (track.muted) continue;
          
          const trackChain = this.createTrackGraph(offlineCtx, masterGain);
          this.applyTrackSettings(trackChain, track, 0, true); 
          
          const trackClips = project.clips.filter(c => c.trackId === track.id);
          for (const clip of trackClips) {
              if (clip.muted) continue;
              if (clip.bufferKey) {
                  const buffer = this.buffers.get(clip.bufferKey);
                  if (buffer) {
                      this.scheduleSource(buffer, clip.start, clip.offset, clip.duration, trackChain.input, clip, 0, offlineCtx);
                  }
              }
              if (clip.notes && track.type === 'instrument' && track.instrument) {
                  // Loop logic for MIDI export (similar to play)
                  const loopLength = clip.loopLength || clip.duration;
                  const clipStart = clip.start;
                  const clipEnd = clip.start + clip.duration;
                  const clipOffset = clip.offset || 0;

                  clip.notes.forEach(note => {
                      const baseTime = clipStart - clipOffset + note.start;
                      let k = 0;
                      if (loopLength > 0) {
                          // Start checking from k=0
                      }
                      
                      let iterationsChecked = 0;
                      while (iterationsChecked < 100) {
                          const absStart = baseTime + (k * loopLength);
                          if (absStart >= clipEnd) break;
                          
                          if (absStart < clipStart) {
                              k++;
                              iterationsChecked++;
                              continue;
                          }
                          
                          let duration = note.duration;
                          if (absStart + duration > clipEnd) {
                              duration = clipEnd - absStart;
                          }
                          
                          const freq = midiToFreq(note.note);
                          const voice = new SynthVoice(offlineCtx, trackChain.input, freq, track.instrument!, note.velocity, absStart);
                          voice.triggerRelease(absStart + duration);
                          
                          if (loopLength <= 0) break;
                          k++;
                          iterationsChecked++;
                      }
                  });
              }
          }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
  }
}

export const audio = new AudioEngine();
