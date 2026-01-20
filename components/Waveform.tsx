
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

      const bufferDuration = buffer.duration;
      const renderDuration = duration || bufferDuration;
      
      // Calculate resolution to decide whether to use peaks or raw data
      const pixelsPerSecond = rect.width / renderDuration;
      const usePeaks = pixelsPerSecond < 100; // Use peaks if zoomed out (less than 100px per second)
      const peaks = usePeaks ? audio.getPeaks(bufferKey) : null;

      // Clamp offset
      const startOffset = Math.max(0, Math.min(offset, bufferDuration));
      
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Fill Style
      ctx.fillStyle = color;
      ctx.beginPath();
      
      const amp = rect.height / 2;
      const mid = rect.height / 2;

      // Source Data Props
      let dataLength = buffer.length;
      let dataRate = buffer.sampleRate;
      let dataSource: Float32Array | undefined;

      if (peaks) {
          dataSource = peaks;
          dataRate = 100; // Peaks are always 100Hz
          dataLength = peaks.length;
      } else {
          dataSource = buffer.getChannelData(0);
      }

      if (!dataSource) return;

      const startIndex = Math.floor(startOffset * dataRate);
      const renderLengthSamples = Math.floor(renderDuration * dataRate);
      const endIndex = Math.min(dataLength, startIndex + renderLengthSamples);
      const sampleCount = endIndex - startIndex;

      if (sampleCount <= 0) return;

      // Draw Loop
      // We iterate pixels (x) and find the max value in the corresponding time slice of data
      const step = sampleCount / rect.width;

      for (let i = 0; i < rect.width; i++) {
        // Fade Logic
        const timeInClip = (i / rect.width) * renderDuration;
        let gain = 1.0;
        if (timeInClip < fadeIn) {
            gain = timeInClip / fadeIn;
        } else if (timeInClip > renderDuration - fadeOut) {
            gain = (renderDuration - timeInClip) / fadeOut;
        }
        gain = Math.max(0, Math.min(1, gain));

        const dataIdx = Math.floor(startIndex + (i * step));
        const nextDataIdx = Math.floor(startIndex + ((i + 1) * step));
        let max = 0;
        
        // Find max in the bin
        const bound = Math.min(endIndex, nextDataIdx);
        // optimization: if step is huge, don't iterate all, just take stride
        const stride = Math.max(1, Math.floor((bound - dataIdx) / 10));

        for (let j = dataIdx; j < bound; j+=stride) {
            const val = Math.abs(dataSource[j]);
            if (val > max) max = val;
        }
        
        // If step < 1 (zoomed in extremely), we might miss data if we just floor.
        // But for visualization, picking nearest neighbor or max is fine.
        if (bound <= dataIdx) {
             max = Math.abs(dataSource[dataIdx] || 0);
        }

        const drawnHeight = max * amp * 0.95 * gain;
        const yTop = mid - drawnHeight;
        
        if (i === 0) ctx.moveTo(i, yTop);
        else ctx.lineTo(i, yTop);
      }

      // Draw bottom half mirrored
      for (let i = rect.width - 1; i >= 0; i--) {
        const timeInClip = (i / rect.width) * renderDuration;
        let gain = 1.0;
        if (timeInClip < fadeIn) gain = timeInClip / fadeIn;
        else if (timeInClip > renderDuration - fadeOut) gain = (renderDuration - timeInClip) / fadeOut;
        gain = Math.max(0, Math.min(1, gain));

        const dataIdx = Math.floor(startIndex + (i * step));
        const nextDataIdx = Math.floor(startIndex + ((i + 1) * step));
        const bound = Math.min(endIndex, nextDataIdx);
        let max = 0;
        const stride = Math.max(1, Math.floor((bound - dataIdx) / 10));

        for (let j = dataIdx; j < bound; j+=stride) {
            const val = Math.abs(dataSource[j]);
            if (val > max) max = val;
        }
        if (bound <= dataIdx) {
             max = Math.abs(dataSource[dataIdx] || 0);
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
