

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioRecorder } from '../../services/AudioRecorder';

// Mock MediaRecorder
class MockMediaRecorder {
    state = 'inactive';
    stream: MediaStream;
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(stream: MediaStream) {
        this.stream = stream;
    }

    start() {
        this.state = 'recording';
    }

    stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
    }
    
    static isTypeSupported() { return true; }
}

globalThis.MediaRecorder = MockMediaRecorder as any;

describe('AudioRecorder', () => {
    let ctx: any;
    let analyser: any;
    let monitorGain: any;
    let recorder: AudioRecorder;

    beforeEach(() => {
        vi.clearAllMocks();
        
        ctx = {
            state: 'running',
            createMediaStreamSource: vi.fn(() => ({
                connect: vi.fn(),
                disconnect: vi.fn()
            })),
            resume: vi.fn(),
            currentTime: 100
        };
        
        analyser = { connect: vi.fn() };
        monitorGain = { gain: { setTargetAtTime: vi.fn() } };
        
        recorder = new AudioRecorder(ctx, analyser, monitorGain);
        
        // Mock navigator
        const mockStream = {
            getTracks: () => [{ stop: vi.fn() }]
        };
        
        if (!globalThis.navigator.mediaDevices) {
            Object.defineProperty(globalThis.navigator, 'mediaDevices', {
                value: {
                    enumerateDevices: vi.fn(() => Promise.resolve([
                        { kind: 'audioinput', deviceId: 'mic1', label: 'Microphone 1' }
                    ])),
                    getUserMedia: vi.fn(() => Promise.resolve(mockStream))
                },
                writable: true
            });
        }
    });

    it('initializes input stream', async () => {
        await recorder.initInput();
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
        expect(ctx.createMediaStreamSource).toHaveBeenCalled();
    });

    it('starts recording', async () => {
        await recorder.start(false);
        expect(recorder['mediaRecorder']?.state).toBe('recording');
        expect(monitorGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    });

    it('enables monitoring if requested', async () => {
        await recorder.start(true);
        expect(monitorGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number));
    });

    it('stops recording and returns blob', async () => {
        await recorder.start(false);
        
        // Simulate data
        const mr = recorder['mediaRecorder'] as unknown as MockMediaRecorder;
        if (mr.ondataavailable) {
            mr.ondataavailable({ data: { size: 100 } });
        }
        
        const stopPromise = recorder.stop();
        const blob = await stopPromise;
        
        expect(blob).toBeInstanceOf(Blob);
        expect(mr.state).toBe('inactive');
    });
});