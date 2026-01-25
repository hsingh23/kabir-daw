
import React, { useRef } from 'react';

interface TempoControlProps {
  bpm: number;
  onChange: (bpm: number) => void;
}

const TempoControl: React.FC<TempoControlProps> = ({ bpm, onChange }) => {
  const tapTimes = useRef<number[]>([]);
  const lastTapTime = useRef<number>(0);

  const handleTap = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTapTime.current > 2000) {
      tapTimes.current = [];
    }
    lastTapTime.current = now;
    tapTimes.current.push(now);

    if (tapTimes.current.length > 5) tapTimes.current.shift();

    if (tapTimes.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.current.length; i++) {
        intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);
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
    <div className="flex flex-col items-center group cursor-ns-resize" onDoubleClick={handleManualEntry}>
        <div 
            className="text-xl font-mono font-bold text-cyan-400 leading-none drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]"
            title="Double click to edit BPM"
        >
            {Math.round(bpm)}
        </div>
        <button 
            className="opacity-0 group-hover:opacity-100 absolute"
            onPointerDown={handleTap}
        >
            {/* Hidden tap area overlay handled by parent usually, keeping specific button hidden for logic retention but visual cleanup */}
        </button>
    </div>
  );
};

export default TempoControl;
