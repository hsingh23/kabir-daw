
import React, { useEffect, useRef, memo } from 'react';
import { audio } from '../services/audio';

interface WaveformProps {
  bufferKey: string;
  color: string;
  offset?: number; // Start time in the source buffer (seconds)
  duration?: number; // Duration to render (seconds)
  fadeIn?: number; // Fade in time (seconds)
  fadeOut?: number; // Fade out time (seconds)
  gain?: number; // Clip gain for visual scaling
}

const Waveform: React.FC<WaveformProps> = memo(({ bufferKey, color, offset = 0, duration, fadeIn = 0, fadeOut = 0, gain = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number>(0);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const buffer = audio.buffers.get(bufferKey);
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

      ctx.clearRect(0, 0, rect.width, rect.height);

      // --- ERROR STATE: Missing Buffer ---
      if (!buffer) {
          // Draw "Missing Media" Pattern (Diagonal Stripes)
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'; // Red-500 low opacity
          ctx.lineWidth = 2;
          ctx.beginPath();
          const spacing = 10;
          for (let x = -rect.height; x < rect.width; x += spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x + rect.height, rect.height);
          }
          ctx.stroke();
          
          // Error Border
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, rect.width, rect.height);
          
          // Optional text label if wide enough
          if (rect.width > 50) {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
              ctx.font = 'bold 10px sans-serif';
              ctx.fillText('FILE ERROR', 4, rect.height - 4);
          }
          return;
      }

      const bufferDuration = buffer.duration;
      const renderDuration = duration || bufferDuration;
      
      // Calculate resolution to decide whether to use peaks or raw data
      const pixelsPerSecond = rect.width / renderDuration;
      const usePeaks = pixelsPerSecond < 100; // Use peaks if zoomed out (less than 100px per second)
      const peaks = usePeaks ? audio.getPeaks(bufferKey) : null;

      // Clamp offset
      const startOffset = Math.max(0, Math.min(offset, bufferDuration));
      
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
      const step = sampleCount / rect.width;

      for (let i = 0; i < rect.width; i++) {
        // Fade Logic
        const timeInClip = (i / rect.width) * renderDuration;
        let fadeGain = 1.0;
        if (timeInClip < fadeIn) {
            fadeGain = timeInClip / fadeIn;
        } else if (timeInClip > renderDuration - fadeOut) {
            fadeGain = (renderDuration - timeInClip) / fadeOut;
        }
        const effectiveGain = Math.max(0, Math.min(1, fadeGain)) * gain;

        const dataIdx = Math.floor(startIndex + (i * step));
        const nextDataIdx = Math.floor(startIndex + ((i + 1) * step));
        let max = 0;
        
        // Find max in the bin
        const bound = Math.min(endIndex, nextDataIdx);
        const stride = Math.max(1, Math.floor((bound - dataIdx) / 10));

        for (let j = dataIdx; j < bound; j+=stride) {
            const val = Math.abs(dataSource[j]);
            if (val > max) max = val;
        }
        
        if (bound <= dataIdx) {
             max = Math.abs(dataSource[dataIdx] || 0);
        }

        const drawnHeight = max * amp * 0.95 * effectiveGain;
        const yTop = mid - drawnHeight;
        
        if (i === 0) ctx.moveTo(i, yTop);
        else ctx.lineTo(i, yTop);
      }

      // Draw bottom half mirrored
      for (let i = rect.width - 1; i >= 0; i--) {
        const timeInClip = (i / rect.width) * renderDuration;
        let fadeGain = 1.0;
        if (timeInClip < fadeIn) fadeGain = timeInClip / fadeIn;
        else if (timeInClip > renderDuration - fadeOut) fadeGain = (renderDuration - timeInClip) / fadeOut;
        const effectiveGain = Math.max(0, Math.min(1, fadeGain)) * gain;

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

        const drawnHeight = max * amp * 0.95 * effectiveGain;
        ctx.lineTo(i, mid + drawnHeight);
      }

      ctx.closePath();
      ctx.fill();
    };

    draw();
    
    const resizeObserver = new ResizeObserver(() => {
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
  }, [bufferKey, color, offset, duration, fadeIn, fadeOut, gain]);

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
});

export default Waveform;
