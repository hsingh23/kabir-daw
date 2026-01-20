
import React, { useRef, useEffect } from 'react';
import { getCompressorCurve } from '../services/utils';

interface VisualCompressorProps {
  threshold: number; // -60 to 0
  ratio: number; // 1 to 20
  knee: number; // 0 to 40
}

const VisualCompressor: React.FC<VisualCompressorProps> = ({ threshold, ratio, knee }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Helpers
    const minDb = -60;
    const maxDb = 0;
    const dbRange = maxDb - minDb;

    const dbToX = (db: number) => ((db - minDb) / dbRange) * w;
    const dbToY = (db: number) => h - ((db - minDb) / dbRange) * h;

    // Draw Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Diagonal 1:1 reference line
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();

    ctx.beginPath();
    // Grid lines
    for (let db = -50; db < 0; db += 10) {
        const x = dbToX(db);
        const y = dbToY(db);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Draw Curve
    const points = getCompressorCurve(threshold, ratio, knee);
    
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e'; // Green
    ctx.lineWidth = 2;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 4;

    points.forEach((p, i) => {
        const x = dbToX(p.x);
        const y = dbToY(p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Threshold Marker
    const tX = dbToX(threshold);
    const tY = dbToY(threshold);
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(tX, tY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Text Label
    ctx.fillStyle = '#aaa';
    ctx.font = '9px monospace';
    ctx.fillText('IN (dB)', 5, h - 5);
    ctx.save();
    ctx.translate(10, h/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('OUT (dB)', 0, 0);
    ctx.restore();

  }, [threshold, ratio, knee]);

  return (
    <div className="relative w-full h-32 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute top-2 left-2 text-[10px] text-zinc-500 font-bold pointer-events-none">
            COMPRESSION CURVE
        </div>
    </div>
  );
};

export default VisualCompressor;
