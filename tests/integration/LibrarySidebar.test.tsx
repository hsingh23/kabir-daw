
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import * as db from '../../services/db';

// Mock DB
vi.mock('../../services/db', () => ({
  saveProject: vi.fn(),
  getProject: vi.fn(() => Promise.resolve(null)),
  getAudioBlob: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'audio/wav' }))),
  saveAudioBlob: vi.fn(),
  getAllProjects: vi.fn(() => Promise.resolve([])),
  getAllAssetKeys: vi.fn(() => Promise.resolve([])),
  getAllAssetsMetadata: vi.fn(() => Promise.resolve([
      { id: 'asset1', name: 'Kick Drum', duration: 1, type: 'oneshot', tags: [], dateAdded: 0, instrument: 'Drums' }
  ])),
}));

// Mock Audio
vi.mock('../../services/audio', () => ({
  audio: {
    ctx: { state: 'suspended', resume: vi.fn(), createGain: vi.fn(() => ({ connect: vi.fn(), gain: { setTargetAtTime: vi.fn() } })) },
    buffers: new Map(),
    loadAudio: vi.fn(() => Promise.resolve({ duration: 1 })),
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
    getAudioDevices: vi.fn(() => Promise.resolve({ inputs: [], outputs: [] })),
    isPlaying: false
  }
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('Library Sidebar Integration', () => {
    
    it('toggles library sidebar visibility', async () => {
        const { getByTitle, queryByText, findByText } = render(<App />);
        
        // Go to Arranger
        const arrangerBtn = await findByText('Arranger');
        fireEvent.click(arrangerBtn);

        // Initial state: Library closed (assuming desktop default or testing logic)
        // Actually, logic is `isLibraryOpen` defaults to false in Arranger.
        expect(queryByText('Kick Drum')).not.toBeInTheDocument();

        // Find Toggle Button in Toolbar (FolderOpen icon)
        const toggleBtn = getByTitle('Toggle Library');
        fireEvent.click(toggleBtn);

        // Expect Library to appear and load assets
        expect(await findByText('Kick Drum')).toBeInTheDocument();
        expect(db.getAllAssetsMetadata).toHaveBeenCalled();

        // Close Library
        fireEvent.click(toggleBtn);
        await waitFor(() => {
            expect(queryByText('Kick Drum')).not.toBeInTheDocument();
        });
    });

    it('loads assets on mount if library is open', async () => {
        // This simulates if we somehow forced it open or persistent state logic existed (future proofing test)
        // For now, mainly verifies that opening triggers the DB call which we partly covered above
        // but lets verify the asset rendering specifically.
        
        const { getByTitle, findByText } = render(<App />);
        const arrangerBtn = await findByText('Arranger');
        fireEvent.click(arrangerBtn);
        
        const toggleBtn = getByTitle('Toggle Library');
        fireEvent.click(toggleBtn);
        
        // Check asset item rendering
        const assetItem = await findByText('Kick Drum');
        expect(assetItem).toHaveClass('font-bold');
    });
});
