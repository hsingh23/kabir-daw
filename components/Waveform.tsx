
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
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!buffer) {
          // Error State
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'; 
          ctx.lineWidth = 2;
          ctx.beginPath();
          const spacing = 10;
          for (let x = -rect.height; x < rect.width; x += spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x + rect.height, rect.height);
          }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.strokeRect(0, 0, rect.width, rect.height);
          return;
      }

      const bufferDuration = buffer.duration;
      const renderDuration = duration || bufferDuration;
      
      const pixelsPerSecond = rect.width / renderDuration;
      const usePeaks = pixelsPerSecond < 100;
      const peaks = usePeaks ? audio.getPeaks(bufferKey) : null;

      // Base Waveform Drawing Function
      const drawSegment = (segStartX: number, segWidth: number, segTimeOffset: number, segDuration: number) => {
          if (segWidth <= 0) return;

          let dataLength = buffer.length;
          let dataRate = buffer.sampleRate;
          let dataSource: Float32Array | undefined;

          if (peaks) {
              dataSource = peaks;
              dataRate = 100; 
              dataLength = peaks.length;
          } else {
              dataSource = buffer.getChannelData(0);
          }

          if (!dataSource) return;

          const startIndex = Math.floor(segTimeOffset * dataRate);
          const segmentSamples = Math.floor(segDuration * dataRate);
          const endIndex = Math.min(dataLength, startIndex + segmentSamples);
          
          if (endIndex <= startIndex) return;

          const step = (endIndex - startIndex) / segWidth;
          const amp = rect.height / 2;
          const mid = rect.height / 2;

          ctx.beginPath();
          
          // Draw Top
          for (let i = 0; i < segWidth; i++) {
              const dataIdx = Math.floor(startIndex + (i * step));
              // Safeguard index
              if (dataIdx >= dataLength) break;
              
              const stride = Math.max(1, Math.floor(step)); 
              let max = 0;
              // Sample visual peak
              for (let j = 0; j < stride && (dataIdx+j) < dataLength; j++) {
                  const val = Math.abs(dataSource[dataIdx + j]);
                  if (val > max) max = val;
              }
              const drawnHeight = max * amp * 0.95 * gain;
              if (i === 0) ctx.moveTo(segStartX + i, mid - drawnHeight);
              else ctx.lineTo(segStartX + i, mid - drawnHeight);
          }

          // Draw Bottom (Mirrored)
          for (let i = segWidth - 1; i >= 0; i--) {
              const dataIdx = Math.floor(startIndex + (i * step));
              if (dataIdx >= dataLength) break;
              
              const stride = Math.max(1, Math.floor(step)); 
              let max = 0;
              for (let j = 0; j < stride && (dataIdx+j) < dataLength; j++) {
                  const val = Math.abs(dataSource[dataIdx + j]);
                  if (val > max) max = val;
              }
              const drawnHeight = max * amp * 0.95 * gain;
              ctx.lineTo(segStartX + i, mid + drawnHeight);
          }
          
          ctx.closePath();
          ctx.fill();
      };

      ctx.fillStyle = color;

      // Handle Ghost Repeats (Looping)
      // Logic: If renderDuration > remaining buffer duration from offset, loop from start of buffer.
      // 1. First segment: from offset to min(bufferDuration, offset+renderDuration)
      // 2. Subsequent segments: from 0 to bufferDuration (or remainder)
      
      let currentDrawX = 0;
      let timeRemaining = renderDuration;
      let currentBufferOffset = offset % bufferDuration;

      while (timeRemaining > 0) {
          const timeAvailableInThisPass = bufferDuration - currentBufferOffset;
          const timeToDraw = Math.min(timeRemaining, timeAvailableInThisPass);
          
          const widthToDraw = (timeToDraw / renderDuration) * rect.width;
          
          drawSegment(currentDrawX, widthToDraw, currentBufferOffset, timeToDraw);
          
          // Draw loop indicator line if we are looping
          if (timeRemaining > timeToDraw) {
              ctx.save();
              ctx.strokeStyle = 'rgba(255,255,255,0.3)';
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(currentDrawX + widthToDraw, 0);
              ctx.lineTo(currentDrawX + widthToDraw, rect.height);
              ctx.stroke();
              ctx.restore();
          }

          currentDrawX += widthToDraw;
          timeRemaining -= timeToDraw;
          currentBufferOffset = 0; // Next loops start from 0
      }

      // --- Fade Overlays ---
      // Fade In
      if (fadeIn > 0) {
          const fadeWidth = (fadeIn / renderDuration) * rect.width;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          // Draw curve
          for (let x = 0; x <= fadeWidth; x++) {
              const progress = x / fadeWidth;
              // Quadratic curve approximation for visual fade
              const y = (1 - progress) * rect.height; 
              ctx.lineTo(x, 0); // Cover top area? No, we want to mask content or overlay shadow.
              // Let's draw an overlay that is opaque at start and transparent at end
          }
          // Simpler: Draw a gradient mask or simply fill areas that are faded "out"
          // Actually, standard DAW visual is often just changing the waveform amplitude locally.
          // But since we draw the waveform in one pass (or loops), modifying amp there is complex with loops.
          // Let's draw a semi-transparent overlay to indicate fade.
          const grad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0.6)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, fadeWidth, rect.height);
          
          // Draw Fade Line
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, rect.height);
          ctx.quadraticCurveTo(fadeWidth * 0.5, rect.height * 0.8, fadeWidth, 0);
          ctx.stroke();
      }

      // Fade Out
      if (fadeOut > 0) {
          const fadeWidth = (fadeOut / renderDuration) * rect.width;
          const startX = rect.width - fadeWidth;
          
          const grad = ctx.createLinearGradient(startX, 0, rect.width, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.6)');
          ctx.fillStyle = grad;
          ctx.fillRect(startX, 0, fadeWidth, rect.height);

          // Draw Fade Line
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.quadraticCurveTo(startX + fadeWidth * 0.5, rect.height * 0.8, rect.width, rect.height);
          ctx.stroke();
      }
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
