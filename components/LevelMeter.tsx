
import React, { useRef, useEffect, useState } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';

interface LevelMeterProps {
  trackId?: string; // If undefined, monitors master
  vertical?: boolean;
}

const LevelMeter: React.FC<LevelMeterProps> = ({ trackId, vertical = true }) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const peakRef = useRef(0);
  const peakTimerRef = useRef(0);

  useEffect(() => {
    const update = () => {
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

      // Smooth falloff for peak
      if (level > peakRef.current) {
          peakRef.current = level;
          peakTimerRef.current = 40; // Frames to hold
      } else {
          if (peakTimerRef.current > 0) {
              peakTimerRef.current--;
          } else {
              peakRef.current *= 0.92; // Decay
          }
      }

      // Clamp 0-1 (boost visualization for lower signals)
      // Visual scale usually log, but simple linear boost is okay for web demo
      const displayLevel = Math.min(1, Math.max(level * 1.2, peakRef.current * 1.2)); 
      
      if (fillRef.current) {
        const pct = displayLevel * 100;
        if (vertical) {
            fillRef.current.style.height = `${pct}%`;
        } else {
            fillRef.current.style.width = `${pct}%`;
        }
      }
    };
    
    const unsubscribe = animation.subscribe(update);
    return unsubscribe;
  }, [trackId, vertical]);

  return (
    <div className={`relative bg-black rounded-sm overflow-hidden border border-zinc-900 shadow-inner ${vertical ? 'w-3 h-full' : 'h-2.5 w-full'}`}>
      
      {/* Clip LED */}
      <div 
        onClick={(e) => { e.stopPropagation(); setClipped(false); }}
        className={`absolute z-20 cursor-pointer transition-colors ${vertical ? 'top-0 left-0 w-full h-1' : 'right-0 top-0 h-full w-1'} ${clipped ? 'bg-[#ff3b30] shadow-[0_0_6px_#ff3b30]' : 'bg-[#333]'}`} 
        title="Clip Indicator (Click to Reset)"
      />
      
      {/* LED Segment Grid Overlay (The "Grill") */}
      <div className="absolute inset-0 z-10 pointer-events-none" 
           style={{ 
               backgroundImage: vertical 
                 ? 'linear-gradient(to bottom, rgba(0,0,0,0.8) 1px, transparent 1px)' 
                 : 'linear-gradient(to right, rgba(0,0,0,0.8) 1px, transparent 1px)',
               backgroundSize: vertical ? '100% 4px' : '4px 100%'
           }} 
      />

      {/* Meter Fill - Gradient mimicking Green > Yellow > Red */}
      <div 
        ref={fillRef}
        className={`transition-transform duration-75 ease-out origin-bottom-left ${vertical ? 'w-full absolute bottom-0' : 'h-full absolute left-0'}`}
        style={{ 
            [vertical ? 'height' : 'width']: '0%',
            background: vertical 
                ? 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 85%, #ef4444 85%, #ef4444 100%)'
                : 'linear-gradient(to right, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 85%, #ef4444 85%, #ef4444 100%)',
            opacity: 0.9 
        }}
      />
    </div>
  );
};

export default LevelMeter;
