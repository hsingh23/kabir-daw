import React, { useEffect, useRef } from 'react';
import { audio } from '../services/audio';

interface WaveformProps {
  bufferKey: string;
  color: string;
}

const Waveform: React.FC<WaveformProps> = ({ bufferKey, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const buffer = audio.buffers.get(bufferKey);
      if (!buffer) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;

      // Handle High DPI
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / rect.width);
      const amp = rect.height / 2;
      const mid = rect.height / 2;
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Create Gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, color); 
      gradient.addColorStop(1, color); 

      ctx.fillStyle = color;

      ctx.beginPath();
      
      // Draw top half
      for (let i = 0; i < rect.width; i++) {
        const idx = Math.floor(i * step);
        // if (idx >= data.length) break;

        let max = 0;
        // Simple decimation (peak finding)
        const bound = Math.min(data.length, idx + step);
        for (let j = idx; j < bound; j++) {
            const val = Math.abs(data[j]);
            if (val > max) max = val;
        }

        const y = mid - (max * amp * 0.95); // 0.95 to leave a tiny margin
        if (i === 0) {
            ctx.moveTo(i, y);
        } else {
            ctx.lineTo(i, y);
        }
      }

      // Draw bottom half (mirror)
      for (let i = rect.width - 1; i >= 0; i--) {
        const idx = Math.floor(i * step);
        let max = 0;
        const bound = Math.min(data.length, idx + step);
        for (let j = idx; j < bound; j++) {
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
        draw();
    });
    
    if (canvasRef.current) {
        resizeObserver.observe(canvasRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [bufferKey, color]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Waveform;