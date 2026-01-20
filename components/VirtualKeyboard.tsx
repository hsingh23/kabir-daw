
import React, { useRef, useState } from 'react';
import { InstrumentConfig } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface VirtualKeyboardProps {
  trackId: string;
  config: InstrumentConfig;
  onClose: () => void;
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
}

const KEYS_COUNT = 24; // 2 Octaves

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ trackId, config, onClose, onNoteOn, onNoteOff }) => {
  const lastNoteRef = useRef<number | null>(null);
  const [octave, setOctave] = useState(3); // C3 start
  
  // Calculate start note based on current octave (C3 = 48)
  // MIDI Note 0 is C-1. C0 is 12. C1 is 24. C2 is 36. C3 is 48.
  const startNote = (octave + 1) * 12;

  const keys = [];
  for (let i = 0; i < KEYS_COUNT; i++) {
      const note = startNote + i;
      const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
      keys.push({ note, isBlack });
  }

  const handlePointerDown = (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerNoteFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      triggerNoteFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (lastNoteRef.current !== null) {
          onNoteOff(lastNoteRef.current);
          lastNoteRef.current = null;
      }
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const triggerNoteFromEvent = (e: React.PointerEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const noteStr = element?.getAttribute('data-note');
      
      if (noteStr) {
          const note = parseInt(noteStr);
          if (note !== lastNoteRef.current) {
              if (lastNoteRef.current !== null) onNoteOff(lastNoteRef.current);
              onNoteOn(note, 100);
              lastNoteRef.current = note;
          }
      } else {
          // If moved off keys, stop note
          if (lastNoteRef.current !== null) {
              onNoteOff(lastNoteRef.current);
              lastNoteRef.current = null;
          }
      }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 h-56 bg-zinc-950 border-t border-zinc-800 z-[200] animate-in slide-in-from-bottom duration-200 select-none touch-none flex flex-col shadow-2xl">
        <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center px-4">
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-studio-accent animate-pulse" /> Piano
                </span>
                
                {/* Octave Controls */}
                <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
                    <button 
                        onClick={() => setOctave(o => Math.max(0, o - 1))}
                        className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                        disabled={octave <= 0}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-[10px] font-mono font-bold text-zinc-300 w-8 text-center">C{octave}</span>
                    <button 
                        onClick={() => setOctave(o => Math.min(8, o + 1))}
                        className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                        disabled={octave >= 8}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
            
            <button onClick={onClose} className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full text-zinc-400 hover:text-white border border-zinc-700 transition-colors">
                CLOSE
            </button>
        </div>
        <div 
            className="flex-1 flex relative overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {keys.map((k, idx) => {
                if (k.isBlack) return null; 
                
                const nextNote = k.note + 1;
                const hasBlack = [1, 3, 6, 8, 10].includes(nextNote % 12);
                
                return (
                    <div 
                        key={k.note} 
                        data-note={k.note}
                        className="flex-1 relative min-w-[40px] border-r border-zinc-300 bg-white active:bg-zinc-200 rounded-b-md mx-[1px]"
                    >
                        {hasBlack && (
                            <div 
                                data-note={nextNote}
                                className="absolute top-0 -right-3 w-6 h-[60%] bg-black z-10 rounded-b-sm active:bg-zinc-800 border border-zinc-800 pointer-events-auto"
                            />
                        )}
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-zinc-400 font-bold pointer-events-none">
                            {k.note % 12 === 0 ? `C${Math.floor(k.note/12)-1}` : ''}
                        </span>
                    </div>
                )
            })}
        </div>
    </div>
  );
};

export default VirtualKeyboard;
