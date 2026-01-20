
import React, { useRef, useEffect, useState } from 'react';
import { audio } from '../services/audio';

interface LevelMeterProps {
  trackId?: string; // If undefined, monitors master
  vertical?: boolean;
}

const LevelMeter: React.FC<LevelMeterProps> = ({ trackId, vertical = true }) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const loop = () => {
      let level = 0;
      if (trackId) {
        level = audio.measureTrackLevel(trackId);
      } else {
        level = audio.measureMasterLevel();
      }

      // Check clipping (level > 1.0 is > 0dBFS)
      if (level > 1.0) {
          setClipped(true);
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
    <div className={`relative bg-zinc-900 rounded overflow-hidden border border-zinc-800 shadow-inner ${vertical ? 'w-2 h-full' : 'h-2 w-full'}`}>
      {/* Clip Indicator */}
      <div 
        onClick={(e) => { e.stopPropagation(); setClipped(false); }}
        className={`absolute z-10 cursor-pointer transition-colors ${vertical ? 'top-0 left-0 w-full h-1' : 'right-0 top-0 h-full w-1'} ${clipped ? 'bg-red-500' : 'bg-zinc-800'}`} 
        title="Clip Indicator (Click to Reset)"
      />
      
      <div 
        ref={fillRef}
        className={`bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75 ease-out origin-bottom-left ${vertical ? 'w-full' : 'h-full bg-gradient-to-r'}`}
        style={{ [vertical ? 'height' : 'width']: '0%' }}
      />
    </div>
  );
};

export default LevelMeter;
