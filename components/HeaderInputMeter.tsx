
import React, { useRef, useEffect } from 'react';
import { audio } from '../services/audio';

interface HeaderInputMeterProps {
  isRecordingOrMonitoring: boolean;
}

const HeaderInputMeter: React.FC<HeaderInputMeterProps> = ({ isRecordingOrMonitoring }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecordingOrMonitoring) return;

    const loop = () => {
      const level = audio.measureInputLevel(); // 0 to 1 range (rms)
      // Visual boost
      const displayLevel = Math.min(1, level * 5); 
      
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
              const w = canvas.width;
              const h = canvas.height;
              ctx.clearRect(0, 0, w, h);
              
              // Draw Background
              ctx.fillStyle = '#18181b';
              ctx.fillRect(0, 0, w, h);
              
              // Draw Level
              const fillW = w * displayLevel;
              
              // Gradient Color based on level
              let color = '#22c55e';
              if (displayLevel > 0.8) color = '#ef4444';
              else if (displayLevel > 0.6) color = '#eab308';
              
              ctx.fillStyle = color;
              ctx.fillRect(0, 0, fillW, h);
          }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRecordingOrMonitoring]);

  if (!isRecordingOrMonitoring) return null;

  return (
      <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
          <span className="text-[9px] font-bold text-zinc-500 uppercase">IN</span>
          <canvas ref={canvasRef} width={40} height={8} className="rounded-sm bg-zinc-900 border border-zinc-800" />
      </div>
  );
};

export default HeaderInputMeter;
