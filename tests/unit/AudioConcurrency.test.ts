
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audio } from '../../services/audio';

describe('AudioConcurrency', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        audio.clearBuffers();
    });

    const createMockBuffer = () => ({
        length: 100,
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn(() => new Float32Array(100)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
    } as unknown as AudioBuffer);

    it('deduplicates concurrent loading requests', async () => {
        // Mock decodeAudioData to be slow
        const mockBuffer = createMockBuffer();
        
        audio.ctx.decodeAudioData = vi.fn(() => new Promise<AudioBuffer>(resolve => {
            setTimeout(() => resolve(mockBuffer), 50);
        })) as any;

        const blob = new Blob(['test'], { type: 'audio/wav' });
        
        // Start two concurrent loads for same key
        const p1 = audio.loadAudio('key1', blob);
        const p2 = audio.loadAudio('key1', blob);
        
        expect(p1).toBe(p2); // Should be exact same promise instance
        
        await Promise.all([p1, p2]);
        
        // Should only call decode once
        expect(audio.ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    });

    it('loads distinct keys separately', async () => {
        const mockBuffer = createMockBuffer();
        
        audio.ctx.decodeAudioData = vi.fn(() => Promise.resolve(mockBuffer)) as any;
        const blob = new Blob(['test'], { type: 'audio/wav' });

        const p1 = audio.loadAudio('key1', blob);
        const p2 = audio.loadAudio('key2', blob);

        expect(p1).not.toBe(p2);

        await Promise.all([p1, p2]);
        expect(audio.ctx.decodeAudioData).toHaveBeenCalledTimes(2);
    });
});
