
import React, { useRef, useEffect } from 'react';
import { audio } from '../services/audio';
import { animation } from '../services/animation';

interface PlayheadProps {
  zoom: number;
  isPlaying: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  staticTime: number; // Used when paused
  autoScroll?: boolean;
}

const Playhead: React.FC<PlayheadProps> = ({ zoom, isPlaying, scrollContainerRef, staticTime, autoScroll = true }) => {
  const lineRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

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
         
         // Scroll if playhead moves past 90% of screen
         if (x > visibleStart + (visibleWidth * 0.9)) {
             container.scrollLeft = x - (visibleWidth * 0.1);
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
        className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none shadow-[0_0_4px_#ef4444] will-change-transform" 
        style={{ left: 0 }} // Position controlled by transform for performance
    >
         <div ref={headRef} className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45" />
    </div>
  );
};

export default Playhead;
