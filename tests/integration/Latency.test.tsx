
import { render, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';
import * as db from '../../services/db';
import { audio } from '../../services/audio';

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
    playCountIn: vi.fn(() => Promise.resolve()), 
    getCurrentTime: vi.fn(() => 5.0), // Simulate stop time at 5s
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

describe('Recording Latency Compensation', () => {
    
    it('compensates for latency when saving recorded clip', async () => {
        // Setup project with latency set to 100ms
        const initialProject = {
            id: 'latency-test',
            bpm: 120,
            timeSignature: [4, 4],
            returnToStartOnStop: false, // Stay at end to check time
            recordingLatency: 100, // 100ms
            tracks: [
                { id: 't1', type: 'audio', name: 'Rec Track', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0} }
            ],
            clips: [],
            markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn: 0, inputMonitoring: false,
            masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4}, effects:{reverb:0,delay:0,chorus:0},
            tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
        };

        (db.getProject as any).mockResolvedValue(initialProject);

        const { findByTitle } = render(<App />);

        // Wait for load
        await waitFor(() => expect(db.getProject).toHaveBeenCalled());

        // Mock MediaRecorder
        (window as any).MediaRecorder = vi.fn().mockImplementation(() => ({
            start: vi.fn(),
            stop: vi.fn(),
            ondataavailable: vi.fn()
        }));
        (window as any).MediaRecorder.isTypeSupported = vi.fn(() => true);
        if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} });
        navigator.mediaDevices.getUserMedia = vi.fn(() => Promise.resolve({} as any));

        // Start Recording
        const recordBtn = await findByTitle('Record (R)');
        
        // Mock window.alert
        vi.spyOn(window, 'alert').mockImplementation(() => {});

        // Mock start time in component state logic implicitly by controlling calls
        // In App.tsx: startActualRecording calls setCurrentTime(currentTime) -> recordingStartTime
        // We assume currentTime is 0 at start
        
        await fireEvent.click(recordBtn); // Start
        
        expect(audio.startRecording).toHaveBeenCalled();

        // Stop Recording
        await fireEvent.click(recordBtn); // Stop
        
        expect(audio.stopRecording).toHaveBeenCalled();
        expect(db.saveAudioBlob).toHaveBeenCalled();

        // Verify Clip Creation with offset
        await waitFor(() => expect(db.saveProject).toHaveBeenCalled());
        
        const saveCall = (db.saveProject as any).mock.lastCall[0];
        const newClip = saveCall.clips[0];
        
        expect(newClip).toBeDefined();
        
        // Logic: 
        // Recording started at 0.
        // Latency is 100ms (0.1s).
        // Clip Start should be 0 - 0.1 = -0.1.
        // App logic handles negative start: start = 0, offset = 0.1.
        // Duration should be Buffer Duration (default 5s in mock) - Offset.
        
        // Wait, did we set buffer duration in mock? Yes, 5s.
        // Expected: start=0, offset=0.1, duration=4.9
        
        expect(newClip.start).toBe(0);
        expect(newClip.offset).toBeCloseTo(0.1);
    });
});
