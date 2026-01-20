
import React, { useState, useEffect } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';
import { formatBars, formatTime } from '../services/utils';

interface TimeDisplayProps {
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ currentTime, bpm, isPlaying }) => {
  const [mode, setMode] = useState<'bars' | 'time'>('bars');
  const [displayTime, setDisplayTime] = useState(currentTime);

  useEffect(() => {
    if (!isPlaying) {
      setDisplayTime(currentTime);
      return;
    }

    const update = () => {
      setDisplayTime(audio.getCurrentTime());
    };
    
    const unsubscribe = animation.subscribe(update);
    return unsubscribe;
  }, [isPlaying, currentTime]);

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
