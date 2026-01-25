
import React, { useRef, useEffect, useState } from 'react';
import { getEQResponse, EQ_FREQS } from '../services/utils';

interface VisualEQProps {
  low: number; // dB -12 to 12
  mid: number;
  high: number;
  onChangeLow: (val: number) => void;
  onChangeMid: (val: number) => void;
  onChangeHigh: (val: number) => void;
}

const VisualEQ: React.FC<VisualEQProps> = ({ low, mid, high, onChangeLow, onChangeMid, onChangeHigh }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<'low' | 'mid' | 'high' | null>(null);

  // Constants
  const minDb = -24;
  const maxDb = 24;
  const dbRange = maxDb - minDb;
  
  // Frequency mapping helpers
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const logRange = maxLog - minLog;

  const freqToX = (freq: number, width: number) => {
      const logFreq = Math.log10(freq);
      return ((logFreq - minLog) / logRange) * width;
  };

  const dbToY = (db: number, height: number) => {
      const norm = (db - minDb) / dbRange;
      return height - (norm * height);
  };

  const yToDb = (y: number, height: number) => {
      const norm = 1 - (y / height);
      return minDb + (norm * dbRange);
  };

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      // --- Background ---
      const gradientBg = ctx.createLinearGradient(0, 0, 0, h);
      gradientBg.addColorStop(0, '#1a1a1a');
      gradientBg.addColorStop(1, '#0f0f0f');
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, 0, w, h);

      // --- Grid ---
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Horizontal dB lines
      ctx.strokeStyle = '#333';
      [12, 0, -12].forEach(db => {
          const y = dbToY(db, h);
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
      });
      ctx.stroke();
      
      // Vertical Freq Lines
      ctx.strokeStyle = '#222';
      [100, 1000, 10000].forEach(f => {
          const x = freqToX(f, w);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
      });

      // --- Curve Fill ---
      const curveData = getEQResponse(low, mid, high, w);
      
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)'); // Light Blue
      fillGrad.addColorStop(1, 'rgba(3, 105, 161, 0.1)'); // Dark Blue
      
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < w; i++) {
          const db = curveData[i];
          const y = dbToY(db, h);
          ctx.lineTo(i, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // --- Curve Stroke ---
      ctx.beginPath();
      ctx.strokeStyle = '#7dd3fc'; // Sky 300
      ctx.lineWidth = 2;
      for (let i = 0; i < w; i++) {
          const db = curveData[i];
          const y = dbToY(db, h);
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
      }
      ctx.stroke();

      // --- Draw Nodes (Logic Style Colored Dots) ---
      const drawNode = (freq: number, db: number, color: string, label: string) => {
          const x = freqToX(freq, w);
          const y = dbToY(db, h);
          
          // Glow
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
          
          // Outer circle
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowBlur = 0;
          
          // Label
          // ctx.fillStyle = '#666';
          // ctx.font = '8px sans-serif';
          // ctx.fillText(label, x - 4, h - 4);
      };

      drawNode(EQ_FREQS.low, low, '#ef4444', 'LO');
      drawNode(EQ_FREQS.mid, mid, '#eab308', 'MID');
      drawNode(EQ_FREQS.high, high, '#22c55e', 'HI');

  }, [low, mid, high]);

  const handlePointerDown = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      
      const xLow = freqToX(EQ_FREQS.low, w);
      const xMid = freqToX(EQ_FREQS.mid, w);
      const xHigh = freqToX(EQ_FREQS.high, w);
      
      const threshold = 30;

      if (Math.abs(x - xLow) < threshold) setDragging('low');
      else if (Math.abs(x - xMid) < threshold) setDragging('mid');
      else if (Math.abs(x - xHigh) < threshold) setDragging('high');
      
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      let db = yToDb(y, rect.height);
      db = Math.max(-18, Math.min(18, db)); 

      if (dragging === 'low') onChangeLow(db);
      if (dragging === 'mid') onChangeMid(db);
      if (dragging === 'high') onChangeHigh(db);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setDragging(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
      <div className="relative w-full h-32 bg-black rounded border border-zinc-800 touch-none shadow-inner overflow-hidden cursor-crosshair">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full block"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
      </div>
  );
};

export default VisualEQ;
