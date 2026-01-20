
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waveformService } from '../../services/waveformService';

// Mock Worker class
class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    
    postMessage(data: any) {
        // Simulate async work
        setTimeout(() => {
            if (this.onmessage) {
                // Return a fake bitmap (mock object)
                this.onmessage({
                    data: {
                        id: data.id,
                        bitmap: { width: data.width, height: data.height } // Fake ImageBitmap
                    }
                } as MessageEvent);
            }
        }, 10);
    }
}

globalThis.Worker = MockWorker as any;

describe('WaveformService', () => {
    beforeEach(() => {
        // Reset service state if possible (not easy with singleton, but init guard handles it)
    });

    it('initializes workers on first call', async () => {
        const mockBuffer = {
            getChannelData: () => new Float32Array(100),
            length: 100,
            sampleRate: 44100,
            numberOfChannels: 1
        } as unknown as AudioBuffer;

        const promise = waveformService.render(mockBuffer, 100, 50, 'red');
        const bitmap = await promise;

        expect(bitmap).toBeDefined();
        expect(bitmap?.width).toBe(100);
        expect(bitmap?.height).toBe(50);
    });

    it('handles multiple concurrent requests', async () => {
        const mockBuffer = {
            getChannelData: () => new Float32Array(100),
            length: 100
        } as unknown as AudioBuffer;

        const p1 = waveformService.render(mockBuffer, 100, 50, 'red');
        const p2 = waveformService.render(mockBuffer, 200, 100, 'blue');

        const [b1, b2] = await Promise.all([p1, p2]);

        expect(b1?.width).toBe(100);
        expect(b2?.width).toBe(200);
    });
});
