
self.onmessage = (e) => {
    const { id, channelData, width, height, color } = e.data;

    // Use OffscreenCanvas if available (modern browsers)
    // Fallback logic handled in main thread if not supported, but this worker assumes support or polyfill context
    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            const step = Math.ceil(channelData.length / width);
            const amp = height / 2;

            ctx.fillStyle = color;
            ctx.beginPath();

            for (let i = 0; i < width; i++) {
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const idx = (i * step) + j;
                    if (idx < channelData.length) {
                        const datum = channelData[idx];
                        if (datum < min) min = datum;
                        if (datum > max) max = datum;
                    }
                }
                // If no data in chunk (silence or out of bounds)
                if (min > max) { min = 0; max = 0; }
                
                // Draw vertical bar for this pixel column
                ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
            }

            const bitmap = canvas.transferToImageBitmap();
            (self as any).postMessage({ id, bitmap }, [bitmap]);
        }
    } else {
        // Fallback for environments without OffscreenCanvas in Worker
        // We just return null, main thread handles fallback
        self.postMessage({ id, error: 'OffscreenCanvas not supported' });
    }
};
