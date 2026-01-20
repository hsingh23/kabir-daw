
import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../services/audio';

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

  const formatBars = (time: number, bpm: number) => {
    const secondsPerBeat = 60 / bpm;
    // Prevent division by zero or negative
    if (secondsPerBeat <= 0) return "1:1:1";
    
    const totalBeats = time / secondsPerBeat;
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = Math.floor(totalBeats % 4) + 1;
    const sixteenth = Math.floor((totalBeats % 1) * 4) + 1;
    return `${bar}:${beat}:${sixteenth}`;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const millis = Math.floor((time % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis}`;
  };

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
