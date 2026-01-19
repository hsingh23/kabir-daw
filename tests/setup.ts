import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Audio API
class AudioContextMock {
  createGain() { return { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }; }
  createOscillator() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } }; }
  createDynamicsCompressor() { return { connect: vi.fn() }; }
  createConvolver() { return { connect: vi.fn() }; }
  createDelay() { return { connect: vi.fn(), delayTime: { value: 0 } }; }
  createStereoPanner() { return { connect: vi.fn(), pan: { value: 0, setTargetAtTime: vi.fn() } }; }
  createBiquadFilter() { return { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() }, frequency: { value: 0 }, Q: { value: 0 } }; }
  createBuffer() { return { getChannelData: vi.fn(() => new Float32Array(1024)) }; }
  decodeAudioData() { return Promise.resolve({}); }
  resume() { return Promise.resolve(); }
  get currentTime() { return 0; }
  get sampleRate() { return 44100; }
}

window.AudioContext = AudioContextMock as any;
(window as any).webkitAudioContext = AudioContextMock as any;

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;