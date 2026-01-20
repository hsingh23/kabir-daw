

import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
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

describe('Track Operations Integration', () => {
    
    it('duplicates a track correctly', async () => {
        // Setup initial project with one track and one clip
        const initialProject = {
            id: 'test-dup',
            bpm: 120,
            tracks: [
                { id: 't1', name: 'Original', volume: 0.8, pan: 0, muted: false, solo: false, color: '#f00', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0} }
            ],
            clips: [
                { id: 'c1', trackId: 't1', name: 'Clip 1', start: 0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 }
            ],
            markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn: 0, recordingLatency: 0, inputMonitoring: false,
            masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4}, effects:{reverb:0,delay:0,chorus:0},
            tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
        };

        (db.getProject as any).mockResolvedValue(initialProject);

        const { findByText, getByText } = render(<App />);

        // Switch to Arranger
        const arrangerBtn = await findByText('Arranger');
        fireEvent.click(arrangerBtn);

        // Find track and open inspector (double click on track header or clicking settings icon logic depending on view)
        // In Arranger, track name is clickable to rename, let's assume we double click header body
        // But App.tsx passes `onOpenInspector` to Arranger which calls it on double click of track div
        const trackHeader = await findByText('Original');
        const trackContainer = trackHeader.closest('div[style*="height"]'); // Finding parent container
        
        fireEvent.doubleClick(trackContainer!);

        // Inspector should be open
        expect(await findByText('Channel Strip')).toBeInTheDocument();

        // Click Duplicate
        const duplicateBtn = getByText('Duplicate');
        fireEvent.click(duplicateBtn);

        // Verify SaveProject called with new state
        expect(db.saveProject).toHaveBeenCalled();
        
        const saveCall = (db.saveProject as any).mock.lastCall[0];
        const tracks = saveCall.tracks;
        
        expect(tracks).toHaveLength(2);
        expect(tracks[1].name).toBe('Original (Copy)');
        
        // Verify clips duplicated
        const clips = saveCall.clips;
        expect(clips).toHaveLength(2);
        expect(clips[1].trackId).toBe(tracks[1].id);
        expect(clips[1].name).toBe('Clip 1');
    });
});