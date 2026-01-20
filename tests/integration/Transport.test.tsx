
import { render, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import { audio } from '../../services/audio';

// Mock audio
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
    playCountIn: vi.fn(() => Promise.resolve()), // Mock count-in
    getCurrentTime: vi.fn(() => 0),
    measureTrackLevel: vi.fn(() => 0),
    measureMasterLevel: vi.fn(() => 0),
    getTrackChannel: vi.fn(() => ({ input: {}, gain: { gain: {} } })),
    getAudioDevices: vi.fn(() => Promise.resolve({ inputs: [], outputs: [] })),
    isPlaying: false
  }
}));

// Mock DB
vi.mock('../../services/db', () => ({
  saveProject: vi.fn(),
  getProject: vi.fn(() => Promise.resolve(null)),
  getAudioBlob: vi.fn(() => Promise.resolve(new Blob())),
  saveAudioBlob: vi.fn(),
  getAllProjects: vi.fn(() => Promise.resolve([])),
  getAllAssetKeys: vi.fn(() => Promise.resolve([])),
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('Global Transport Integration', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('plays audio when Play button is clicked', async () => {
        const { getByTitle } = render(<App />);
        
        // Find Play button (title="Play/Pause (Space)")
        const playBtn = getByTitle('Play/Pause (Space)');
        
        // Initial Click -> Play
        fireEvent.click(playBtn);
        expect(audio.play).toHaveBeenCalled();
        expect(audio.ctx.resume).toHaveBeenCalled();
    });

    it('stops audio when Stop button is clicked', async () => {
        const { getByTitle } = render(<App />);
        const stopBtn = getByTitle('Stop');
        
        fireEvent.click(stopBtn);
        expect(audio.stop).toHaveBeenCalled();
    });

    it('handles recording with count-in logic', async () => {
        // Need to enable count-in first via Settings
        const { getByTitle, getByText, findByLabelText } = render(<App />);
        
        // Open Settings
        const settingsBtn = getByTitle('Settings');
        fireEvent.click(settingsBtn);
        
        // Find count-in selector (it is a select with value="0" by default)
        // Since we don't have distinct labels easily targetable in basic mock without aria setup,
        // we can look for the select element directly or text
        const countInText = await waitFor(() => getByText('Count-In (Bars)'));
        const countInSelect = countInText.nextElementSibling as HTMLSelectElement;
        
        fireEvent.change(countInSelect, { target: { value: '4' } });
        
        // Close settings (X button)
        const closeBtn = settingsBtn.parentElement?.querySelector('button'); // In header or just find by Icon
        // Actually App renders SettingsDialog as overlay.
        // We can just click outside or find X.
        // Let's assume we proceed.
        
        // Click Record
        const recordBtn = getByTitle('Record (R)');
        
        // Mock window.alert to avoid error if no track selected (default project has tracks selected usually? '1')
        vi.spyOn(window, 'alert').mockImplementation(() => {});

        // Mock MediaRecorder
        (window as any).MediaRecorder = vi.fn().mockImplementation(() => ({
            start: vi.fn(),
            stop: vi.fn(),
            ondataavailable: vi.fn()
        }));
        (window as any).MediaRecorder.isTypeSupported = vi.fn(() => true);
        
        // Need to ensure getUserMedia is mocked if not global
        if (!navigator.mediaDevices) {
             Object.defineProperty(navigator, 'mediaDevices', { value: {} });
        }
        navigator.mediaDevices.getUserMedia = vi.fn(() => Promise.resolve({} as any));

        await fireEvent.click(recordBtn);
        
        // Expect audio.playCountIn to be called first
        expect(audio.playCountIn).toHaveBeenCalledWith(4, 120);
        
        // After count-in resolves (mocked to resolve immediately/promise), startRecording should be called
        // Since playCountIn is mocked to resolve instantly, we expect subsequent calls in next tick
        await waitFor(() => {
             expect(audio.startRecording).toHaveBeenCalled();
        });
    });
});
