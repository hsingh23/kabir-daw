
import React, { useRef, useEffect } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';

interface PlayheadProps {
  zoom: number;
  isPlaying: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  staticTime: number;
  autoScroll?: boolean;
}

const Playhead: React.FC<PlayheadProps> = ({ zoom, isPlaying, scrollContainerRef, staticTime, autoScroll = true }) => {
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      let time = staticTime;
      
      if (isPlaying) {
        time = audio.getCurrentTime();
      }

      const x = time * zoom;
      
      if (lineRef.current) {
        lineRef.current.style.transform = `translateX(${x}px)`;
      }
      
      // Auto-scroll logic decoupled from React render
      if (isPlaying && autoScroll && scrollContainerRef.current) {
         const container = scrollContainerRef.current;
         const visibleStart = container.scrollLeft;
         const visibleWidth = container.clientWidth;
         
         // Keep playhead centered-ish or push when reaching edge
         // Logic Pro behavior: Page scroll or smooth catch up. 
         // Let's do simple edge push for performance.
         if (x > visibleStart + (visibleWidth * 0.9)) {
             container.scrollLeft = x - (visibleWidth * 0.2); // Jump back to 20%
         }
      }
    };

    let unsubscribe: (() => void) | undefined;

    if (isPlaying) {
        unsubscribe = animation.subscribe(updatePosition);
    } else {
        updatePosition(); // Immediate update when not playing
    }

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [isPlaying, zoom, staticTime, scrollContainerRef, autoScroll]);

  return (
    <div 
        ref={lineRef}
        className="absolute top-0 bottom-0 w-0 z-50 pointer-events-none will-change-transform flex flex-col items-center group" 
        style={{ left: 0 }}
    >
         {/* Cap (Logic Style Triangle/Shield) */}
         <div className="absolute -top-1 z-50 filter drop-shadow-md">
             <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M0 0H15V8L7.5 15L0 8V0Z" fill="#ff3b30"/>
             </svg>
         </div>
         
         {/* Line */}
         <div className="w-px h-full bg-[#ff3b30] shadow-[0_0_4px_rgba(255,59,48,0.5)]" />
         
         {/* Glow effect on move */}
         {isPlaying && (
             <div className="absolute top-0 bottom-0 w-4 bg-[#ff3b30] opacity-5 blur-xl pointer-events-none" />
         )}
    </div>
  );
};

export default Playhead;
