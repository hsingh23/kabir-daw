
import { render, fireEvent, waitFor } from '@testing-library/react';
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
    startRecording: vi.fn(),
    stopRecording: vi.fn(() => Promise.resolve(new Blob())),
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

describe('Step Sequencer Integration', () => {
    
    it('toggles sequencer steps and saves state', async () => {
        const initialProject = {
            id: 'seq-test',
            name: 'Sequencer Project',
            bpm: 120,
            tracks: [],
            clips: [],
            markers: [],
            sequencer: {
                enabled: true,
                volume: 0.8,
                tracks: [
                    { name: 'Kick', sample: 'kick', steps: new Array(16).fill(false), volume: 1, muted: false }
                ]
            }
        };

        // Mock DB return
        (db.getProject as any).mockResolvedValue(initialProject);

        const { findByText, getByText } = render(<App />);

        // Switch to Mixer
        const mixerBtn = await findByText('Mixer');
        fireEvent.click(mixerBtn);

        // Switch to Backing Tab
        const backingTab = await findByText('Backing');
        fireEvent.click(backingTab);

        // Find Sequencer Header
        expect(await findByText('Beat Sequencer')).toBeInTheDocument();
        
        // Find Kick Track Row (using the name button)
        const kickLabel = getByText('Kick');
        const kickRow = kickLabel.parentElement; // The div containing label + grid
        
        // Find grid buttons. The grid is a sibling div to the label button.
        const gridContainer = kickRow?.querySelector('.grid');
        expect(gridContainer).toBeInTheDocument();
        
        const steps = gridContainer?.querySelectorAll('button');
        expect(steps?.length).toBe(16);

        // Click first step to enable
        fireEvent.pointerDown(steps![0]);

        // Wait for save
        await waitFor(() => expect(db.saveProject).toHaveBeenCalled());
        
        const saveCall = (db.saveProject as any).mock.lastCall[0];
        // Check if sequencer state is updated
        expect(saveCall.sequencer.tracks[0].steps[0]).toBe(true);
        expect(saveCall.sequencer.tracks[0].steps[1]).toBe(false); // Others unchanged
    });
});
