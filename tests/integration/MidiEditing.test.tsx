
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import * as db from '../../services/db';

// Mock DB
vi.mock('../../services/db', () => ({
  saveProject: vi.fn(),
  getProject: vi.fn(() => Promise.resolve(null)),
  getAudioBlob: vi.fn(() => Promise.resolve(new Blob())),
  saveAudioBlob: vi.fn(),
  getAllProjects: vi.fn(() => Promise.resolve([])),
  getAllAssetKeys: vi.fn(() => Promise.resolve([])),
}));

// Mock Audio
vi.mock('../../services/audio', () => ({
  audio: {
    ctx: { state: 'suspended', resume: vi.fn(), createGain: vi.fn(() => ({ connect: vi.fn(), gain: { setTargetAtTime: vi.fn() } })) },
    buffers: new Map(),
    loadAudio: vi.fn(() => Promise.resolve({ duration: 5 })),
    syncTracks: vi.fn(),
    syncInstruments: vi.fn(),
    setMasterVolume: vi.fn(),
    setMasterCompressor: vi.fn(),
    setMasterEq: vi.fn(),
    setDelayLevel: vi.fn(),
    setReverbLevel: vi.fn(),
    setChorusLevel: vi.fn(),
    setMetronomeVolume: vi.fn(),
    stop: vi.fn(),
    play: vi.fn(),
    scheduler: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    measureTrackLevel: vi.fn(() => 0),
    measureMasterLevel: vi.fn(() => 0),
    getTrackChannel: vi.fn(() => ({ input: {}, gain: { gain: {} } })),
    isPlaying: false
  }
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('MIDI Editing Integration', () => {
    
    it('opens MIDI clip inspector and shows piano roll', async () => {
        const midiClip = {
            id: 'c1', trackId: 't1', name: 'MIDI Clip', start: 0, duration: 4, offset: 0, 
            notes: [{ note: 60, start: 0, duration: 1, velocity: 100 }],
            fadeIn: 0, fadeOut: 0
        };
        const initialProject = {
            id: 'test-midi',
            bpm: 120,
            tracks: [
                { id: 't1', type: 'instrument', name: 'Synth', volume: 0.8, pan: 0, muted: false, solo: false, color: '#f00', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, instrument: { type: 'synth', preset: 'sawtooth', attack: 0, decay: 0, sustain: 1, release: 0 } }
            ],
            clips: [midiClip],
            markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn: 0, recordingLatency: 0, inputMonitoring: false,
            masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4}, effects:{reverb:0,delay:0,chorus:0},
            tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
        };

        (db.getProject as any).mockResolvedValue(initialProject);

        const { findByText } = render(<App />);

        // Switch to Arranger
        const arrangerBtn = await findByText('Arranger');
        fireEvent.click(arrangerBtn);

        // Find track
        const trackHeader = await findByText('Synth');
        // Find clip
        // Note: MidiClipView renders canvas, no text inside usually, but Arranger renders clip name in overlay
        const clipOverlay = await findByText('MIDI Clip');
        
        // Double click clip to open inspector
        fireEvent.doubleClick(clipOverlay);

        // Expect Inspector
        expect(await findByText('MIDI Clip')).toBeInTheDocument();
        expect(await findByText('Piano Roll')).toBeInTheDocument();
    });
});
