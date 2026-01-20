
import React, { useLayoutEffect, useRef, memo } from 'react';
import { MidiNote } from '../types';

interface MidiClipViewProps {
  notes?: MidiNote[];
  color: string;
  duration: number;
}

const MidiClipView: React.FC<MidiClipViewProps> = memo(({ notes, color, duration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number>(0);

  const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!notes || notes.length === 0) {
          // Empty State
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.font = '10px sans-serif';
          ctx.fillText('No Notes', 5, rect.height / 2);
          return;
      }

      // Determine pitch range for auto-scaling
      let minNote = 127;
      let maxNote = 0;
      notes.forEach(n => {
          if (n.note < minNote) minNote = n.note;
          if (n.note > maxNote) maxNote = n.note;
      });
      
      // Add padding
      minNote = Math.max(0, minNote - 2);
      maxNote = Math.min(127, maxNote + 2);
      const noteRange = Math.max(12, maxNote - minNote); // Ensure at least an octave visual
      const noteHeight = rect.height / noteRange;

      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;

      notes.forEach(note => {
          const x = (note.start / duration) * rect.width;
          const w = Math.max(1, (note.duration / duration) * rect.width);
          // Invert Y because higher pitch is higher up
          const y = rect.height - ((note.note - minNote) * noteHeight) - noteHeight;
          
          ctx.fillRect(x, y, w, noteHeight - 1);
          ctx.strokeRect(x, y, w, noteHeight - 1);
      });
  };

  useLayoutEffect(() => {
      draw();
  }, [notes, color, duration]);

  useLayoutEffect(() => {
    const handleResize = () => {
        if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = window.setTimeout(draw, 100);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    
    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    return () => {
        resizeObserver.disconnect();
        if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, []);

  return (
      <div ref={containerRef} className="w-full h-full pointer-events-none bg-black/20">
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
  );
});

export default MidiClipView;
