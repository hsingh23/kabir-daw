
import React, { useEffect, useRef, memo } from 'react';
import { audio } from '../services/audio';

interface WaveformProps {
  bufferKey: string;
  color: string;
}

const Waveform: React.FC<WaveformProps> = memo(({ bufferKey, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Use wrapper for size
  const lastWidth = useRef<number>(0);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const buffer = audio.buffers.get(bufferKey);
      if (!buffer) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      // Don't redraw if width hasn't changed significantly (perf opt)
      if (Math.abs(rect.width - lastWidth.current) < 2) return;
      lastWidth.current = rect.width;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Limit max resolution for performance on mobile
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / rect.width);
      const amp = rect.height / 2;
      const mid = rect.height / 2;
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, color); 
      gradient.addColorStop(1, color); 

      ctx.fillStyle = color;
      ctx.beginPath();
      
      for (let i = 0; i < rect.width; i++) {
        const idx = Math.floor(i * step);
        let max = 0;
        const bound = Math.min(data.length, idx + step);
        
        // Optimize loop: skip samples if step is huge
        const innerStep = Math.max(1, Math.floor((bound - idx) / 10));
        
        for (let j = idx; j < bound; j += innerStep) {
            const val = Math.abs(data[j]);
            if (val > max) max = val;
        }

        const y = mid - (max * amp * 0.95);
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }

      for (let i = rect.width - 1; i >= 0; i--) {
        const idx = Math.floor(i * step);
        let max = 0;
        const bound = Math.min(data.length, idx + step);
        const innerStep = Math.max(1, Math.floor((bound - idx) / 10));

        for (let j = idx; j < bound; j += innerStep) {
            const val = Math.abs(data[j]);
            if (val > max) max = val;
        }
        
        const y = mid + (max * amp * 0.95);
        ctx.lineTo(i, y);
      }

      ctx.closePath();
      ctx.fill();
    };

    draw();
    
    const resizeObserver = new ResizeObserver(() => {
        // Debounce slightly or just draw
        requestAnimationFrame(draw);
    });
    
    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [bufferKey, color]);

  return (
      <div ref={containerRef} className="w-full h-full">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
});

export default Waveform;
