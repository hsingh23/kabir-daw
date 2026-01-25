
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
      className="flex flex-col items-end justify-center min-w-[80px] cursor-pointer group outline-none"
      title="Toggle Time Format"
    >
      <span className="text-xl font-mono font-bold text-cyan-400 leading-none tracking-tight drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]">
        {mode === 'bars' ? formatBars(displayTime, bpm) : formatTime(displayTime)}
      </span>
      <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-0.5 group-hover:text-zinc-400">
        {mode === 'bars' ? 'BARS' : 'TIME'}
      </span>
    </button>
  );
};

export default TimeDisplay;
