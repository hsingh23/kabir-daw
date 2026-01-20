
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { audio } from '../services/audio';

// Mock Web Audio API
class AudioNodeMock {
  context: AudioContextMock;
  numberOfInputs = 1;
  numberOfOutputs = 1;
  channelCount = 2;
  channelCountMode = 'max';
  channelInterpretation = 'speakers';
  connectedNodes: AudioNodeMock[] = [];

  constructor(context: any) {
    this.context = context;
  }

  connect(dest: AudioNodeMock) {
    this.connectedNodes.push(dest);
    return dest;
  }

  disconnect() {
    this.connectedNodes = [];
  }
}

class AudioParamMock {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
  connect = vi.fn();
}

class GainNodeMock extends AudioNodeMock {
  gain = new AudioParamMock();
}

class OscillatorNodeMock extends AudioNodeMock {
  frequency = new AudioParamMock();
  detune = new AudioParamMock();
  type = 'sine';
  start = vi.fn();
  stop = vi.fn();
}

class BiquadFilterNodeMock extends AudioNodeMock {
  frequency = new AudioParamMock();
  Q = new AudioParamMock();
  gain = new AudioParamMock();
  type = 'lowpass';
}

class StereoPannerNodeMock extends AudioNodeMock {
  pan = new AudioParamMock();
}

class DynamicsCompressorNodeMock extends AudioNodeMock {
  threshold = new AudioParamMock();
  knee = new AudioParamMock();
  ratio = new AudioParamMock();
  attack = new AudioParamMock();
  release = new AudioParamMock();
  reduction = 0;
}

class AnalyserNodeMock extends AudioNodeMock {
  fftSize = 2048;
  frequencyBinCount = 1024;
  smoothingTimeConstant = 0.8;
  getByteFrequencyData = vi.fn((array) => array.fill(0));
  getByteTimeDomainData = vi.fn((array) => array.fill(0));
  getFloatTimeDomainData = vi.fn((array) => array.fill(0));
}

class AudioContextMock {
  state = 'suspended';
  sampleRate = 44100;
  currentTime = 0;
  destination = new AudioNodeMock(this);

  createGain() { return new GainNodeMock(this); }
  createOscillator() { return new OscillatorNodeMock(this); }
  createDynamicsCompressor() { return new DynamicsCompressorNodeMock(this); }
  createConvolver() { return new AudioNodeMock(this) as any; }
  createDelay() { return new AudioNodeMock(this) as any; } // DelayNode has delayTime param, simplified here
  createStereoPanner() { return new StereoPannerNodeMock(this); }
  createBiquadFilter() { return new BiquadFilterNodeMock(this); }
  createAnalyser() { return new AnalyserNodeMock(this); }
  createBuffer() { return { getChannelData: vi.fn(() => new Float32Array(1024)), sampleRate: 44100, length: 1024, numberOfChannels: 2, duration: 1024/44100 }; }
  createBufferSource() { return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), playbackRate: { value: 1 }, detune: { value: 0 }, loop: false, loopStart: 0, loopEnd: 0, onended: null }; }
  createWaveShaper() { return { connect: vi.fn(), curve: null, oversample: 'none' }; }
  createMediaStreamSource() { return new AudioNodeMock(this); }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  setSinkId(id: string) { return Promise.resolve(); }
}

class OfflineAudioContextMock extends AudioContextMock {
    startRendering() { return Promise.resolve(this.createBuffer()); }
}

window.AudioContext = AudioContextMock as any;
(window as any).webkitAudioContext = AudioContextMock as any;
(window as any).OfflineAudioContext = OfflineAudioContextMock as any;

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Cleanup hook
afterEach(() => {
    if (audio.reset) audio.reset();
});
