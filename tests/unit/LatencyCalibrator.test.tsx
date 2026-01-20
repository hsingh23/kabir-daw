
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LatencyCalibrator from '../../components/LatencyCalibrator';
import { audio } from '../../services/audio';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    ctx: { 
        createOscillator: vi.fn(() => ({ 
            type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() 
        })),
        createGain: vi.fn(() => ({ 
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        })),
        masterGain: {},
        resume: vi.fn(), // Missing in AudioContext mock sometimes
    },
    resumeContext: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    loadAudio: vi.fn()
  }
}));

describe('LatencyCalibrator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs calibration flow successfully', async () => {
        const onApply = vi.fn();
        const { getByText, queryByText } = render(
            <LatencyCalibrator currentLatency={0} onApply={onApply} />
        );

        // 1. Initial State
        expect(getByText('Ready to calibrate')).toBeInTheDocument();
        const startBtn = getByText('Start');
        
        // Mock audio flows
        (audio.startRecording as any).mockResolvedValue(100); // Start time 100s
        (audio.stopRecording as any).mockResolvedValue(new Blob());
        
        // Mock Buffer Analysis
        const mockBuffer = {
            sampleRate: 44100,
            getChannelData: () => {
                // Return data with a peak at 0.2s (200ms)
                // Impulse fired at 0.1s.
                // Latency = 0.2 - 0.1 = 0.1s = 100ms.
                const data = new Float32Array(44100); // 1 sec
                const peakIdx = Math.floor(0.2 * 44100);
                data[peakIdx] = 0.8; // High peak
                return data;
            }
        };
        (audio.loadAudio as any).mockResolvedValue(mockBuffer);

        // 2. Click Start
        await act(async () => {
            fireEvent.click(startBtn);
        });

        // 3. Status changes to recording/listening
        expect(audio.startRecording).toHaveBeenCalled();
        
        // 4. Wait for timeout in component (500ms)
        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        // 5. Verification
        await waitFor(() => expect(audio.stopRecording).toHaveBeenCalled());
        
        // Check computed latency display
        // Logic: Peak at 0.2s. Impulse scheduled at 0.1s offset.
        // Result: 100ms.
        expect(getByText('100 ms')).toBeInTheDocument();
        
        // 6. Apply
        const applyBtn = getByText('Apply');
        fireEvent.click(applyBtn);
        expect(onApply).toHaveBeenCalledWith(100);
    });

    it('handles low signal error', async () => {
        const { getByText } = render(
            <LatencyCalibrator currentLatency={0} onApply={() => {}} />
        );

        const startBtn = getByText('Start');
        
        (audio.startRecording as any).mockResolvedValue(0);
        (audio.stopRecording as any).mockResolvedValue(new Blob());
        
        // Mock Silent Buffer
        const mockBuffer = {
            sampleRate: 44100,
            getChannelData: () => new Float32Array(44100) // All zeros
        };
        (audio.loadAudio as any).mockResolvedValue(mockBuffer);

        await act(async () => {
            fireEvent.click(startBtn);
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(getByText(/Signal too quiet/)).toBeInTheDocument();
        });
    });
});
