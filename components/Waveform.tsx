
import React, { useLayoutEffect, useRef, memo, useState } from 'react';
import { audio } from '../services/audio';
import { waveformService } from '../services/waveformService';
import { Loader2 } from 'lucide-react';

interface WaveformProps {
  bufferKey: string;
  color: string;
  offset?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
  gain?: number;
  speed?: number;
}

// Cache promises to prevent re-rendering same waveform unnecessarily
const bitmapPromiseCache = new Map<string, Promise<ImageBitmap | null>>();

const Waveform: React.FC<WaveformProps> = memo(({ bufferKey, color, offset = 0, duration, fadeIn = 0, fadeOut = 0, gain = 1.0, speed = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false); // New state for fade-in

  const getWaveformBitmap = (key: string, buffer: AudioBuffer): Promise<ImageBitmap | null> => {
      const cacheKey = `${key}-${color}`;
      if (bitmapPromiseCache.has(cacheKey)) return bitmapPromiseCache.get(cacheKey)!;

      const promise = waveformService.render(buffer, 2000, 200, color);
      bitmapPromiseCache.set(cacheKey, promise);
      return promise;
  };

  const draw = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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
          try {
             const dbBlob = await import('../services/db').then(m => m.getAudioBlob(bufferKey));
             if (dbBlob) {
                 buffer = await audio.loadAudio(bufferKey, dbBlob);
             }
          } catch(e) {}
      }

      if (!buffer) return;

      const bitmap = await getWaveformBitmap(bufferKey, buffer);
      
      if (bitmap) {
          const bufferDuration = buffer.duration;
          const totalSourceDuration = (duration || bufferDuration) * speed;
          let drawnSourceDuration = 0;
          let currentSourceTime = (offset * speed) % bufferDuration;
          if (currentSourceTime < 0) currentSourceTime += bufferDuration;

          while (drawnSourceDuration < totalSourceDuration) {
              const remainingBufferTime = bufferDuration - currentSourceTime;
              const chunkSourceDuration = Math.min(totalSourceDuration - drawnSourceDuration, remainingBufferTime);
              
              if (chunkSourceDuration <= 0) break;

              const srcX = (currentSourceTime / bufferDuration) * bitmap.width;
              const srcW = (chunkSourceDuration / bufferDuration) * bitmap.width;
              
              const destX = (drawnSourceDuration / totalSourceDuration) * rect.width;
              const destW = (chunkSourceDuration / totalSourceDuration) * rect.width;
              
              // Ensure we don't draw outside bitmap bounds due to floating point precision
              const safeSrcW = Math.min(srcW, bitmap.width - srcX);

              ctx.drawImage(bitmap, srcX, 0, safeSrcW, bitmap.height, destX, 0, destW, rect.height);
              
              drawnSourceDuration += chunkSourceDuration;
              currentSourceTime = 0;
          }
      } else {
          // Fallback
          ctx.fillStyle = color;
          ctx.fillRect(0, rect.height/2 - 1, rect.width, 2);
      }

      // Render Fades
      if (fadeIn > 0) {
          const fadeWidth = (fadeIn / (duration || buffer.duration/speed)) * rect.width;
          const grad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)'); 
          grad.addColorStop(1, 'rgba(0,0,0,1)');
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, fadeWidth, rect.height);
          ctx.restore();
          
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
          const grad = ctx.createLinearGradient(startX, 0, rect.width, 0);
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = grad;
          ctx.fillRect(startX, 0, fadeWidth, rect.height);
          ctx.restore();

          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.quadraticCurveTo(startX + fadeWidth * 0.5, rect.height * 0.8, rect.width, rect.height);
          ctx.stroke();
      }
      
      // Trigger fade in
      setIsReady(true);
  };

  useLayoutEffect(() => {
      draw();
  }, [bufferKey, color, offset, duration, fadeIn, fadeOut, speed, gain]); 

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none relative">
          <canvas 
            ref={canvasRef} 
            className={`w-full h-full block transition-opacity duration-300 ease-out ${isReady ? 'opacity-100' : 'opacity-0'}`} 
          />
          {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] transition-opacity duration-300">
                  <Loader2 className="animate-spin text-white/50" size={12} />
              </div>
          )}
      </div>
  );
});

export default Waveform;
