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
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = color;
      
      // Draw mirrored waveform
      ctx.beginPath();
      
      for (let i = 0; i < rect.width; i++) {
        const idx = i * step;
        if (idx >= data.length) break;

        let min = 1.0;
        let max = -1.0;
        
        // Find peak in this chunk
        for (let j = 0; j < step; j++) {
            const val = data[idx + j];
            if (val < min) min = val;
            if (val > max) max = val;
        }

        // Sanity check
        if (min === 1.0 && max === -1.0) {
            min = 0;
            max = 0;
        }

        // Draw vertical line for this pixel column
        // Center is amp.
        // Y grows down.
        const yTop = (1 - max) * amp;
        const yBottom = (1 - min) * amp;
        const height = Math.max(1, yBottom - yTop);
        
        ctx.fillRect(i, yTop, 1, height);
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [bufferKey, color]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Waveform;