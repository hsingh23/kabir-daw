
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Audio API
class AudioContextMock {
  createGain() { return { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }; }
  createOscillator() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 }, type: 'sine', exponentialRampToValueAtTime: vi.fn() }; }
  createDynamicsCompressor() { return { connect: vi.fn() }; }
  createConvolver() { return { connect: vi.fn(), buffer: null }; }
  createDelay() { return { connect: vi.fn(), delayTime: { value: 0 } }; }
  createStereoPanner() { return { connect: vi.fn(), pan: { value: 0, setTargetAtTime: vi.fn() } }; }
  createBiquadFilter() { return { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() }, frequency: { value: 0 }, Q: { value: 0 }, type: 'lowpass' }; }
  createAnalyser() { return { connect: vi.fn(), fftSize: 2048, frequencyBinCount: 1024, getByteTimeDomainData: vi.fn(), getFloatTimeDomainData: vi.fn(), smoothingTimeConstant: 0.8 }; }
  createBuffer() { return { getChannelData: vi.fn(() => new Float32Array(1024)) }; }
  decodeAudioData() { return Promise.resolve({}); }
  resume() { return Promise.resolve(); }
  get currentTime() { return 0; }
  get sampleRate() { return 44100; }
  get state() { return 'suspended'; }
}

class OfflineAudioContextMock extends AudioContextMock {
    startRendering() { return Promise.resolve({} as AudioBuffer); }
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
