
interface WaveformJob {
    id: string;
    resolve: (bitmap: ImageBitmap | null) => void;
}

class WaveformService {
    private workers: Worker[] = [];
    private pending = new Map<string, (bitmap: ImageBitmap | null) => void>();
    private workerIndex = 0;
    private initialized = false;

    init() {
        if (this.initialized) return;
        // Limit concurrency to avoid blocking main thread with message passing overhead
        const concurrency = Math.min(4, navigator.hardwareConcurrency || 2);
        
        for (let i = 0; i < concurrency; i++) {
            const worker = new Worker(new URL('./wave.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (e) => {
                const { id, bitmap } = e.data;
                const resolve = this.pending.get(id);
                if (resolve) {
                    resolve(bitmap || null);
                    this.pending.delete(id);
                }
            };
            this.workers.push(worker);
        }
        this.initialized = true;
    }

    render(buffer: AudioBuffer, width: number, height: number, color: string): Promise<ImageBitmap | null> {
        if (!this.initialized) this.init();
        
        return new Promise((resolve) => {
            const id = crypto.randomUUID();
            this.pending.set(id, resolve);
            
            const worker = this.workers[this.workerIndex];
            this.workerIndex = (this.workerIndex + 1) % this.workers.length;

            const channelData = buffer.getChannelData(0);
            
            // Note: We copy the data here. Transferring (channelData.buffer) would detach it 
            // from the audio engine, breaking playback.
            worker.postMessage({
                id,
                channelData,
                width,
                height,
                color
            });
        });
    }
}

export const waveformService = new WaveformService();
