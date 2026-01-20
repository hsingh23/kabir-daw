
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audio } from '../../services/audio';

// We need to override the global mock for AudioContext specifically for these tests
// to allow stateful buffers.
const originalAudioContext = window.AudioContext;

describe('Audio Processing Logic', () => {
    let mockCtx: any;
    let mockBuffer: any;

    beforeEach(() => {
        // Reset buffers
        audio.buffers.clear();

        // Create a custom mock for this suite
        mockBuffer = {
            numberOfChannels: 1,
            length: 4,
            sampleRate: 44100,
            getChannelData: vi.fn(),
            copyToChannel: vi.fn()
        };

        // Mock Float32Arrays for data
        const channelData = new Float32Array([0.1, 0.5, 0.2, 0.8]);
        mockBuffer.getChannelData.mockReturnValue(channelData);

        mockCtx = {
            createBuffer: vi.fn(() => {
                const newData = new Float32Array(4); // New empty buffer data
                return {
                    numberOfChannels: 1,
                    length: 4,
                    sampleRate: 44100,
                    getChannelData: vi.fn(() => newData),
                    copyToChannel: vi.fn()
                };
            })
        };

        // Inject mock context into audio instance
        // Since `audio` is a singleton created at module level, we must swap its ctx property
        // Note: `audio.ctx` is typed as AudioContext, so we cast our mock
        (audio as any).ctx = mockCtx;
        
        // Add source buffer
        audio.buffers.set('test-key', mockBuffer);
    });

    afterEach(() => {
        // Restore global if needed (though vitest isolates environments usually)
    });

    it('reverses audio data correctly', () => {
        const resultBuffer = audio.processAudioBuffer('test-key', 'reverse');
        
        const resultData = resultBuffer.getChannelData(0);
        
        // Original: [0.1, 0.5, 0.2, 0.8]
        // Expected: [0.8, 0.2, 0.5, 0.1]
        expect(resultData[0]).toBeCloseTo(0.8);
        expect(resultData[1]).toBeCloseTo(0.2);
        expect(resultData[2]).toBeCloseTo(0.5);
        expect(resultData[3]).toBeCloseTo(0.1);
    });

    it('normalizes audio data correctly', () => {
        // Input: [0.1, 0.5, 0.2, 0.8]
        // Max peak is 0.8. Gain factor = 1 / 0.8 = 1.25
        // Expected: [0.125, 0.625, 0.25, 1.0]
        
        const resultBuffer = audio.processAudioBuffer('test-key', 'normalize');
        const resultData = resultBuffer.getChannelData(0);

        expect(resultData[0]).toBeCloseTo(0.125);
        expect(resultData[1]).toBeCloseTo(0.625);
        expect(resultData[2]).toBeCloseTo(0.25);
        expect(resultData[3]).toBeCloseTo(1.0);
    });

    it('throws error if buffer not found', () => {
        expect(() => {
            audio.processAudioBuffer('missing-key', 'reverse');
        }).toThrow("Buffer not found");
    });
});