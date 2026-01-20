
import React, { useEffect, useRef, memo } from 'react';
import { audio } from '../services/audio';

interface WaveformProps {
  bufferKey: string;
  color: string;
  offset?: number; // Start time in the source buffer (seconds)
  duration?: number; // Duration to render (seconds)
  fadeIn?: number; // Fade in time (seconds)
  fadeOut?: number; // Fade out time (seconds)
}

const Waveform: React.FC<WaveformProps> = memo(({ bufferKey, color, offset = 0, duration, fadeIn = 0, fadeOut = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number>(0);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const buffer = audio.buffers.get(bufferKey);
      if (!buffer) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      // Only resize canvas if dimensions changed to avoid clearing
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      // Logic to determine render range
      const bufferDuration = buffer.duration;
      const renderDuration = duration || bufferDuration;
      // Clamp offset
      const startOffset = Math.max(0, Math.min(offset, bufferDuration));
      const endOffset = Math.min(bufferDuration, startOffset + renderDuration);
      
      const data = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      
      const startIndex = Math.floor(startOffset * sampleRate);
      const endIndex = Math.floor(endOffset * sampleRate);
      const sampleCount = endIndex - startIndex;
      
      if (sampleCount <= 0) {
          ctx.clearRect(0, 0, rect.width, rect.height);
          return;
      }

      const step = Math.ceil(sampleCount / rect.width);
      const amp = rect.height / 2;
      const mid = rect.height / 2;
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Fill Style
      ctx.fillStyle = color;
      ctx.beginPath();
      
      for (let i = 0; i < rect.width; i++) {
        // Map pixel i to time in rendered clip
        const timeInClip = (i / rect.width) * renderDuration;
        
        // Calculate Fade Gain
        let gain = 1.0;
        if (timeInClip < fadeIn) {
            gain = timeInClip / fadeIn;
        } else if (timeInClip > renderDuration - fadeOut) {
            gain = (renderDuration - timeInClip) / fadeOut;
        }
        // Clamp gain (avoid negatives or >1)
        gain = Math.max(0, Math.min(1, gain));

        const dataIdx = startIndex + Math.floor(i * step);
        let max = 0;
        
        // Optimization: Don't iterate massive steps if zoomed out a lot
        // Just take a few samples or the max of a smaller window if performance is an issue
        // For now, standard stride
        const bound = Math.min(startIndex + sampleCount, dataIdx + step);
        const stride = Math.max(1, Math.floor((bound - dataIdx) / 10)); // Skip samples for perf

        for (let j = dataIdx; j < bound; j+=stride) {
            const val = Math.abs(data[j]);
            if (val > max) max = val;
        }
        
        // Apply fade gain to amplitude
        const drawnHeight = max * amp * 0.95 * gain;

        const yTop = mid - drawnHeight;
        const yBottom = mid + drawnHeight;

        // Draw vertical line for this pixel column (more robust than path for spikes)
        // Or continue path approach. Path approach allows fill.
        // Let's stick to top/bottom path for fill look.
        
        if (i === 0) ctx.moveTo(i, yTop);
        else ctx.lineTo(i, yTop);
      }

      // Draw bottom half in reverse to close shape
      for (let i = rect.width - 1; i >= 0; i--) {
        const timeInClip = (i / rect.width) * renderDuration;
        let gain = 1.0;
        if (timeInClip < fadeIn) gain = timeInClip / fadeIn;
        else if (timeInClip > renderDuration - fadeOut) gain = (renderDuration - timeInClip) / fadeOut;
        gain = Math.max(0, Math.min(1, gain));

        const dataIdx = startIndex + Math.floor(i * step);
        let max = 0;
        const bound = Math.min(startIndex + sampleCount, dataIdx + step);
        const stride = Math.max(1, Math.floor((bound - dataIdx) / 10));

        for (let j = dataIdx; j < bound; j+=stride) {
            const val = Math.abs(data[j]);
            if (val > max) max = val;
        }

        const drawnHeight = max * amp * 0.95 * gain;
        ctx.lineTo(i, mid + drawnHeight);
      }

      ctx.closePath();
      ctx.fill();
    };

    draw();
    
    const resizeObserver = new ResizeObserver(() => {
        // Debounce resize
        if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = window.setTimeout(draw, 100);
    });
    
    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    return () => {
        resizeObserver.disconnect();
        if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [bufferKey, color, offset, duration, fadeIn, fadeOut]);

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
});

export default Waveform;
