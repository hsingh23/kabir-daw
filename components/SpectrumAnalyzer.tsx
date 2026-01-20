
import React, { useRef, useEffect } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';

interface SpectrumAnalyzerProps {
  height?: number;
  color?: string;
}

const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ height = 64, color = '#ef4444' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audio.masterAnalyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      // Handle resizing
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, w, h);

      const barWidth = (w / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, color); // Base color
      gradient.addColorStop(1, '#fcd34d'); // Peak color (yellow)

      ctx.fillStyle = gradient;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * h;

        // Draw rounded bars
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);

        x += barWidth + 1;
        if (x > w) break;
      }
    };

    const unsubscribe = animation.subscribe(draw);
    return unsubscribe;
  }, [color]);

  return <canvas ref={canvasRef} className="w-full rounded bg-black/20" style={{ height }} />;
};

export default SpectrumAnalyzer;
