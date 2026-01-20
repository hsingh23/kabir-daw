
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import * as db from '../../services/db';
import { audio } from '../../services/audio';

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

describe('Drag and Drop Integration', () => {
    
    it('drags an asset from library and drops onto arranger track', async () => {
        // Render App
        const { getByText, findByText } = render(<App />);
        
        // Ensure we are in Arranger view (default might be Mixer depending on URL mock, force via button)
        const arrangerBtn = await findByText('Arranger');
        fireEvent.click(arrangerBtn);

        // Desktop layout shows library in sidebar automatically
        // We need to ensure library loads assets
        await waitFor(() => expect(db.getAllAssetsMetadata).toHaveBeenCalled());
        
        const assetItem = await findByText('Kick Drum');
        const trackLane = (await findByText('Drums')).closest('div')?.parentElement?.nextSibling; // Timeline area for Drums track
        
        // Verify we found the timeline lane (it should have onDrop handler)
        // It's the div inside relative container.
        // Let's assume structure: Headers (Left) | Timeline (Right)
        // The test environment might not perfectly render layout but handlers are attached.
        // We can target the track lane by looking for the drop handler attached div
        // Easier: simulate drop on a known text element in the timeline? No, clips are empty.
        // We need to query the timeline container for the specific track index.
        // The Arranger renders track lanes in order. Drums is index 0.
        
        // Find the timeline container
        // It has style with height based on track count
        const timelineContainer = document.querySelector('.relative[style*="height"]');
        expect(timelineContainer).toBeInTheDocument();
        
        // The first child div is the first track's timeline lane
        const firstTrackLane = timelineContainer?.children[0];
        
        // Mock DataTransfer
        const dataTransfer = {
            getData: vi.fn(() => JSON.stringify({ id: 'asset1', name: 'Kick Drum' })),
            setData: vi.fn(),
            dropEffect: 'none',
            effectAllowed: 'all'
        };

        // 1. Drag Start
        fireEvent.dragStart(assetItem!, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith('application/json', expect.stringContaining('Kick Drum'));

        // 2. Drop on Track Lane
        fireEvent.drop(firstTrackLane!, { 
            dataTransfer, 
            clientX: 100, // Simulate drop position
            preventDefault: vi.fn()
        });

        // 3. Verify Audio Load and Clip Creation
        await waitFor(() => {
            expect(audio.loadAudio).toHaveBeenCalledWith('asset1', expect.anything());
        });
        
        // Verify saveProject was called (implies state update)
        expect(db.saveProject).toHaveBeenCalled();
        const savedProject = (db.saveProject as any).mock.lastCall[0];
        const newClip = savedProject.clips.find((c: any) => c.name === 'Kick Drum');
        
        expect(newClip).toBeDefined();
        // clientX 100 / zoom 50 = 2 seconds
        // snapped to grid (default 1/4 = 0.5s at 120bpm)? 
        // 120bpm = 0.5s/beat. 100px = 2s = 4 beats. 
        // Logic might vary slightly based on exact mock rect, but clip should exist.
        expect(newClip.trackId).toBe('1'); // Drums ID
    });
});
