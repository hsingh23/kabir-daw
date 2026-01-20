
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
  const minDb = -15;
  const maxDb = 15;
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
      // +15dB at top (0), -15dB at bottom (height)
      // 0dB at height/2
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
      // Handle High DPI
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Horizontal dB lines
      [12, 6, 0, -6, -12].forEach(db => {
          const y = dbToY(db, h);
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          if (db === 0) ctx.strokeStyle = '#555'; // Brighter for 0dB
          else ctx.strokeStyle = '#333';
          ctx.stroke();
          ctx.beginPath();
      });
      // Vertical Freq Lines
      [100, 1000, 10000].forEach(f => {
          const x = freqToX(f, w);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
      });
      ctx.strokeStyle = '#333';
      ctx.stroke();

      // Curve
      const curveData = getEQResponse(low, mid, high, w);
      
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6'; // Blue-500
      ctx.lineWidth = 2;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#3b82f6';

      for (let i = 0; i < w; i++) {
          const db = curveData[i];
          const y = dbToY(db, h);
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Nodes
      const drawNode = (freq: number, db: number, label: string) => {
          const x = freqToX(freq, w);
          const y = dbToY(db, h);
          
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Outer ring
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label
          ctx.fillStyle = '#aaa';
          ctx.font = '10px monospace';
          ctx.fillText(label, x - 10, h - 5);
      };

      drawNode(EQ_FREQS.low, low, 'LOW');
      drawNode(EQ_FREQS.mid, mid, 'MID');
      drawNode(EQ_FREQS.high, high, 'HIGH');

  }, [low, mid, high]);

  const handlePointerDown = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Hit test
      const w = rect.width;
      const xLow = freqToX(EQ_FREQS.low, w);
      const xMid = freqToX(EQ_FREQS.mid, w);
      const xHigh = freqToX(EQ_FREQS.high, w);
      
      const threshold = 20;

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
      db = Math.max(-12, Math.min(12, db)); // Clamp to +/- 12dB

      if (dragging === 'low') onChangeLow(db);
      if (dragging === 'mid') onChangeMid(db);
      if (dragging === 'high') onChangeHigh(db);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setDragging(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
      <div className="relative w-full h-32 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 touch-none">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full cursor-pointer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          <div className="absolute top-2 left-2 text-[10px] text-zinc-500 font-bold pointer-events-none">
              VISUAL EQ
          </div>
      </div>
  );
};

export default VisualEQ;
