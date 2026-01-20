
import React, { useRef } from 'react';

interface TempoControlProps {
  bpm: number;
  onChange: (bpm: number) => void;
}

const TempoControl: React.FC<TempoControlProps> = ({ bpm, onChange }) => {
  const tapTimes = useRef<number[]>([]);
  const lastTapTime = useRef<number>(0);

  const handleTap = (e: React.MouseEvent) => {
    // Prevent focus stealing
    e.preventDefault();
    
    const now = performance.now();
    if (now - lastTapTime.current > 2000) {
      tapTimes.current = []; // Reset if gap is too long (2 seconds)
    }
    lastTapTime.current = now;
    tapTimes.current.push(now);

    // Keep only the last 5 taps for moving average
    if (tapTimes.current.length > 5) {
      tapTimes.current.shift();
    }

    if (tapTimes.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.current.length; i++) {
        intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);
      // Clamp reasonable values
      onChange(Math.min(300, Math.max(30, newBpm)));
    }
  };

  const handleManualEntry = () => {
      const val = prompt("Enter BPM (30-300):", bpm.toString());
      if (val) {
          const num = parseFloat(val);
          if (!isNaN(num) && num >= 30 && num <= 300) {
              onChange(Math.round(num));
          }
      }
  };

  return (
    <div className="flex flex-col items-center justify-center bg-black/40 border border-zinc-700/50 rounded px-2 md:px-3 py-1 min-w-[60px] md:min-w-[70px] select-none group">
        <div 
            className="text-sm md:text-lg font-mono font-bold text-studio-accent leading-none cursor-pointer hover:text-white transition-colors"
            onClick={handleManualEntry}
            title="Click to edit BPM"
        >
            {Math.round(bpm)}
        </div>
        <button 
            className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5 hover:text-white hover:bg-zinc-700/50 rounded px-1 transition-all active:scale-95"
            onPointerDown={handleTap}
            title="Tap Tempo"
        >
            TAP
        </button>
    </div>
  );
};

export default TempoControl;
