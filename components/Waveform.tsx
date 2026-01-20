
import React, { useLayoutEffect, useRef, memo, useState, useEffect } from 'react';
import { audio } from '../services/audio';
import { Loader2 } from 'lucide-react';

interface WaveformProps {
  bufferKey: string;
  color: string;
  offset?: number; // Start time in the source buffer (seconds)
  duration?: number; // Duration to render (seconds)
  fadeIn?: number; // Fade in time (seconds)
  fadeOut?: number; // Fade out time (seconds)
  gain?: number; // Clip gain for visual scaling
  speed?: number; // Playback speed
}

// Global cache for rendered waveforms to reuse across clips referencing the same audio
const bitmapCache = new Map<string, ImageBitmap>();

const Waveform: React.FC<WaveformProps> = memo(({ bufferKey, color, offset = 0, duration, fadeIn = 0, fadeOut = 0, gain = 1.0, speed = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Robust bitmap generation with fallback
  const generateStaticWaveform = async (key: string, buffer: AudioBuffer): Promise<ImageBitmap | null> => {
      if (bitmapCache.has(key)) return bitmapCache.get(key)!;

      const width = 2000; // Fixed high-res width for cache
      const height = 200; // Fixed height
      
      let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
      let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;

      if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(width, height);
          ctx = canvas.getContext('2d');
      } else {
          // Fallback for environments without OffscreenCanvas (e.g., iOS < 16.4, some test envs)
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext('2d');
      }

      if (!ctx) return null;

      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      
      for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;
          for (let j = 0; j < step; j++) {
              if ((i * step) + j < data.length) {
                  const datum = data[(i * step) + j];
                  if (datum < min) min = datum;
                  if (datum > max) max = datum;
              }
          }
          if (min > max) { min = 0; max = 0; }
          ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
      
      if (canvas instanceof OffscreenCanvas) {
          const bitmap = canvas.transferToImageBitmap();
          bitmapCache.set(key, bitmap);
          return bitmap;
      } else {
          // For standard canvas, we can use createImageBitmap
          const bitmap = await createImageBitmap(canvas as HTMLCanvasElement);
          bitmapCache.set(key, bitmap);
          return bitmap;
      }
  };

  const draw = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle Resize
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
      } else {
          ctx.clearRect(0, 0, targetWidth, targetHeight);
      }

      ctx.scale(dpr, dpr);

      let buffer = audio.buffers.get(bufferKey);
      if (!buffer) {
          setIsLoading(true);
          // Try to load if not present (simple retry/check mechanism)
          try {
             const dbBlob = await import('../services/db').then(m => m.getAudioBlob(bufferKey));
             if (dbBlob) {
                 buffer = await audio.loadAudio(bufferKey, dbBlob);
             }
          } catch(e) {
              // Ignore
          }
          setIsLoading(false);
      }

      if (!buffer) {
          // Still no buffer, show error/placeholder
          ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(rect.width, rect.height);
          ctx.stroke();
          return;
      }

      setIsLoading(false);

      // Cached Bitmap Strategy
      let bitmap = bitmapCache.get(bufferKey);
      if (!bitmap) {
          bitmap = await generateStaticWaveform(bufferKey, buffer);
      }

      if (bitmap) {
          const effectiveDuration = buffer.duration / speed;
          const renderDuration = duration || effectiveDuration;
          
          const sourceStartTime = (offset * speed) % buffer.duration;
          const sourceDuration = renderDuration * speed;
          
          const pixelsPerSec = bitmap.width / buffer.duration;
          
          const sx = sourceStartTime * pixelsPerSec;
          const sw = sourceDuration * pixelsPerSec;
          
          if (sx + sw > bitmap.width) {
              const firstPartW = bitmap.width - sx;
              const secondPartW = sw - firstPartW;
              
              const destW1 = (firstPartW / sw) * rect.width;
              const destW2 = rect.width - destW1;
              
              ctx.drawImage(bitmap, sx, 0, firstPartW, bitmap.height, 0, 0, destW1, rect.height);
              ctx.drawImage(bitmap, 0, 0, secondPartW, bitmap.height, destW1, 0, destW2, rect.height);
          } else {
              ctx.drawImage(bitmap, sx, 0, sw, bitmap.height, 0, 0, rect.width, rect.height);
          }
      }

      // Fades
      if (fadeIn > 0) {
          const fadeWidth = (fadeIn / (duration || buffer.duration/speed)) * rect.width;
          const grad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
          grad.addColorStop(0, 'rgba(0,0,0,1)'); // Full mask
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, fadeWidth, rect.height);
          ctx.restore();
          
          // Draw Line
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, rect.height);
          ctx.quadraticCurveTo(fadeWidth * 0.5, rect.height * 0.8, fadeWidth, 0);
          ctx.stroke();
      }

      if (fadeOut > 0) {
          const totalDur = duration || buffer.duration/speed;
          const fadeWidth = (fadeOut / totalDur) * rect.width;
          const startX = rect.width - fadeWidth;
          
          // Overlay strategy for fade out
          const overlay = ctx.createLinearGradient(startX, 0, rect.width, 0);
          overlay.addColorStop(0, 'rgba(0,0,0,0)');
          overlay.addColorStop(1, 'rgba(0,0,0,0.8)'); // Visual fade
          ctx.fillStyle = overlay;
          ctx.fillRect(startX, 0, fadeWidth, rect.height);

          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.quadraticCurveTo(startX + fadeWidth * 0.5, rect.height * 0.8, rect.width, rect.height);
          ctx.stroke();
      }
  };

  useLayoutEffect(() => {
      draw();
  }, [bufferKey, color, offset, duration, fadeIn, fadeOut, speed, gain]); 

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none relative">
          <canvas ref={canvasRef} className="w-full h-full block" />
          {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="animate-spin text-white" size={16} />
              </div>
          )}
      </div>
  );
});

export default Waveform;
