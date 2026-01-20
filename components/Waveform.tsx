
import React, { useLayoutEffect, useRef, memo } from 'react';
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

  const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const buffer = audio.buffers.get(bufferKey);
      
      // Get dimensions directly from the styled container
      // This is performant because the parent (Arranger) sets these styles
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      // Only resize canvas if dimensions actually changed to avoid layout thrashing
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!buffer) {
          // Error State / Loading State
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
      
      // Optimization: Downsample if pixel density is high
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
          
          if (startIndex >= dataLength) return;

          const step = Math.max(1, segmentSamples / segWidth);
          const amp = rect.height / 2;
          const mid = rect.height / 2;

          ctx.beginPath();
          
          // Draw Top
          for (let i = 0; i < segWidth; i++) {
              const dataIdx = Math.floor(startIndex + (i * step));
              if (dataIdx >= dataLength) break;
              
              const sampleStride = Math.floor(step);
              let max = 0;
              // Sample visual peak
              for (let j = 0; j < sampleStride && (dataIdx+j) < dataLength; j++) {
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
              
              const sampleStride = Math.floor(step);
              let max = 0;
              for (let j = 0; j < sampleStride && (dataIdx+j) < dataLength; j++) {
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

      let currentDrawX = 0;
      let timeRemaining = renderDuration;
      let currentBufferOffset = offset % bufferDuration;

      while (timeRemaining > 0) {
          const timeAvailableInThisPass = bufferDuration - currentBufferOffset;
          const timeToDraw = Math.min(timeRemaining, timeAvailableInThisPass);
          
          const widthToDraw = (timeToDraw / renderDuration) * rect.width;
          
          drawSegment(currentDrawX, widthToDraw, currentBufferOffset, timeToDraw);
          
          // Draw loop markers
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
          currentBufferOffset = 0; 
      }

      // --- Fade Overlays ---
      if (fadeIn > 0) {
          const fadeWidth = (fadeIn / renderDuration) * rect.width;
          const grad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0.6)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, fadeWidth, rect.height);
          
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, rect.height);
          ctx.quadraticCurveTo(fadeWidth * 0.5, rect.height * 0.8, fadeWidth, 0);
          ctx.stroke();
      }

      if (fadeOut > 0) {
          const fadeWidth = (fadeOut / renderDuration) * rect.width;
          const startX = rect.width - fadeWidth;
          
          const grad = ctx.createLinearGradient(startX, 0, rect.width, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.6)');
          ctx.fillStyle = grad;
          ctx.fillRect(startX, 0, fadeWidth, rect.height);

          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.quadraticCurveTo(startX + fadeWidth * 0.5, rect.height * 0.8, rect.width, rect.height);
          ctx.stroke();
      }
  };

  // Re-draw when props change or container resizes (handled by parents passing new props/style)
  // We don't need ResizeObserver because the Arranger re-renders this component 
  // with new style width whenever zoom changes.
  useLayoutEffect(() => {
      draw();
  });

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
});

export default Waveform;
