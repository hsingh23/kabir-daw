import React, { useEffect, useRef } from 'react';
import { audio } from '../services/audio';

interface WaveformProps {
  bufferKey: string;
  color: string;
  // We no longer constrain width/height here rigidly; the parent handles the window
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

      // We want to render the waveform at a resolution that matches the visual size.
      // However, since this component is now placed inside a container that might be cropped,
      // we need to be careful. 
      // Strategy: The canvas will be sized to the *full duration* of the audio file 
      // relative to the current zoom level, but handled via CSS in the parent.
      // Wait, simpler: The parent div determines the visible area. 
      // This component just fills its parent. The parent (in Arranger) will have a 
      // specific width calculated: (bufferDuration * zoom).
      
      const rect = canvas.getBoundingClientRect();
      // If rect is 0 (hidden), skip
      if (rect.width === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const data = buffer.getChannelData(0);
      // Downsample for performance
      const step = Math.ceil(data.length / rect.width);
      const amp = rect.height / 2;

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = color;
      ctx.beginPath();
      
      for (let i = 0; i < rect.width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        // Simple peak finding
        // Optimization: Don't loop huge steps if zoomed out a ton, 
        // but for a DAW we usually want accuracy.
        // A randomized stride check is faster for huge files.
        const idx = i * step;
        if (idx >= data.length) break;

        for (let j = 0; j < step; j++) {
            const val = data[idx + j];
            if (val < min) min = val;
            if (val > max) max = val;
        }
        
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    };

    draw();
    // Re-draw on resize observer could be better, but window resize is okay for now
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [bufferKey, color]);

  return <canvas ref={canvasRef} className="w-full h-full opacity-80" />;
};

export default Waveform;