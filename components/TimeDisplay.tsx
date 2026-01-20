
import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../services/audio';
import { formatBars, formatTime } from '../services/utils';

interface TimeDisplayProps {
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ currentTime, bpm, isPlaying }) => {
  const [mode, setMode] = useState<'bars' | 'time'>('bars');
  const [displayTime, setDisplayTime] = useState(currentTime);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      setDisplayTime(currentTime);
      return;
    }

    const loop = () => {
      setDisplayTime(audio.getCurrentTime());
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentTime]); // Sync with props when paused

  return (
    <button 
      onClick={() => setMode(mode === 'bars' ? 'time' : 'bars')}
      className="hidden sm:flex flex-col items-center justify-center bg-black/40 border border-zinc-700/50 rounded px-2 md:px-3 py-1 min-w-[70px] md:min-w-[90px] cursor-pointer hover:bg-black/60 transition-colors select-none outline-none focus:ring-1 focus:ring-zinc-600"
      title="Toggle Time Format"
    >
      <span className="text-sm md:text-lg font-mono font-bold text-studio-accent leading-none tabular-nums tracking-tighter">
        {mode === 'bars' ? formatBars(displayTime, bpm) : formatTime(displayTime)}
      </span>
      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5">
        {mode === 'bars' ? 'BARS' : 'TIME'}
      </span>
    </button>
  );
};

export default TimeDisplay;
