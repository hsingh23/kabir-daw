
import React, { useRef, useEffect } from 'react';
import { audio } from '../services/audio';

interface LevelMeterProps {
  trackId?: string; // If undefined, monitors master
  vertical?: boolean;
}

const LevelMeter: React.FC<LevelMeterProps> = ({ trackId, vertical = true }) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = () => {
      let level = 0;
      if (trackId) {
        level = audio.measureTrackLevel(trackId);
      } else {
        level = audio.measureMasterLevel();
      }

      // Smooth decay could be added here, but raw RMS is good for now
      // Clamp 0-1 (usually audio levels are low, so we boost visualization)
      const displayLevel = Math.min(1, level * 2.5); 
      
      if (fillRef.current) {
        const pct = displayLevel * 100;
        if (vertical) {
            fillRef.current.style.height = `${pct}%`;
        } else {
            fillRef.current.style.width = `${pct}%`;
        }
      }
      
      rafRef.current = requestAnimationFrame(loop);
    };
    
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackId, vertical]);

  return (
    <div className={`bg-zinc-900 rounded overflow-hidden border border-zinc-800 shadow-inner ${vertical ? 'w-2 h-full' : 'h-2 w-full'}`}>
      <div 
        ref={fillRef}
        className={`bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75 ease-out origin-bottom-left ${vertical ? 'w-full' : 'h-full bg-gradient-to-r'}`}
        style={{ [vertical ? 'height' : 'width']: '0%' }}
      />
    </div>
  );
};

export default LevelMeter;
