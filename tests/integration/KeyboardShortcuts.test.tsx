
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import * as db from '../../services/db';

// Mock dependencies
vi.mock('../../services/db', () => ({
  saveProject: vi.fn(),
  getProject: vi.fn(() => Promise.resolve(null)),
  getAudioBlob: vi.fn(() => Promise.resolve(new Blob())),
  saveAudioBlob: vi.fn(),
  getAllProjects: vi.fn(() => Promise.resolve([])),
  getAllAssetKeys: vi.fn(() => Promise.resolve([])),
}));

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

// Mock ResizeObserver for Arranger
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App Keyboard Shortcuts', () => {
    
  it('handles Copy and Paste of clips', async () => {
    // 1. Setup App with default project
    const { getByText, findByText } = render(<App />);
    
    // Switch to Arranger to see clips (requires 'Arranger' button)
    const arrangerBtn = await findByText('Arranger');
    fireEvent.click(arrangerBtn);

    // 2. Create a dummy clip by simulating file upload or ensuring default state has one?
    // The default state has no clips. Let's mock `getProject` to return a state with a clip.
    // However, since we already rendered, we need to inject state or use interactions.
    // Easiest is to rely on `getProject` mock which returns null -> loads default -> no clips.
    // Let's manually trigger a state update via a file input simulation? 
    // Or simpler: Mock `getProject` to return a project WITH a clip for THIS test.
    
    // Re-render with mocked data
    const mockClip = {
        id: 'c1', trackId: '1', name: 'Test Clip', start: 0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0
    };
    (db.getProject as any).mockResolvedValueOnce({
        id: 'test-p',
        bpm: 120,
        tracks: [{ id: '1', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0} }],
        clips: [mockClip],
        loopStart: 0, loopEnd: 4, isLooping: false, metronomeOn: false,
        masterVolume: 1, masterEq: {low:0,mid:0,high:0}, masterCompressor: {threshold:-20,ratio:4}, effects: {reverb:0,delay:0,chorus:0},
        tanpura: {enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla: {enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
    });
    
    // Force re-mount
    const { getByText: getByText2, findByText: findByText2, queryAllByText } = render(<App />);
    
    // Wait for clip to appear
    await findByText2('Test Clip');

    // 3. Select the clip
    const clipEl = getByText2('Test Clip');
    fireEvent.pointerDown(clipEl); // Selects clip

    // 4. Copy (Ctrl+C)
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // 5. Paste (Ctrl+V)
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    // 6. Expect two clips named "Test Clip" (original) and "Test Clip (Copy)"
    expect(await findByText2('Test Clip (Copy)')).toBeInTheDocument();
  });

  it('handles Nudging with Arrow Keys', async () => {
    const mockClip = {
        id: 'c1', trackId: '1', name: 'Nudge Me', start: 1.0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0
    };
    (db.getProject as any).mockResolvedValueOnce({
        id: 'test-nudge',
        bpm: 120,
        tracks: [{ id: '1', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0} }],
        clips: [mockClip],
        loopStart: 0, loopEnd: 4, isLooping: false, metronomeOn: false,
        masterVolume: 1, masterEq: {low:0,mid:0,high:0}, masterCompressor: {threshold:-20,ratio:4}, effects: {reverb:0,delay:0,chorus:0},
        tanpura: {enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla: {enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
    });

    const { findByText } = render(<App />);
    const clipEl = await findByText('Nudge Me');
    
    fireEvent.pointerDown(clipEl); // Select

    // Nudge Right
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    
    // Since we can't easily check the internal state without exposing it, 
    // we assume the saveProject was called with updated data or UI updated position (via style)
    // However, JSdom style updates might not trigger layout. 
    // Best check is if `saveProject` is called or check if subsequent logic reflects change.
    // For this integration test, verifying no crash and event handling is a good start.
    
    // Actually, we can check if saveProject was called recently with updated clip start
    // wait for debounce
    await new Promise(r => setTimeout(r, 2100));
    
    expect(db.saveProject).toHaveBeenCalled();
    const lastCallArg = (db.saveProject as any).mock.lastCall[0];
    const updatedClip = lastCallArg.clips.find((c: any) => c.id === 'c1');
    expect(updatedClip.start).toBeCloseTo(1.01); // 1.0 + 0.01 default nudge
  });
});
