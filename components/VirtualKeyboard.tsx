
import React from 'react';
import { InstrumentConfig } from '../types';

interface VirtualKeyboardProps {
  trackId: string;
  config: InstrumentConfig;
  onClose: () => void;
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
}

const OCTAVES = 2;
const START_NOTE = 48; // C3

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ trackId, config, onClose, onNoteOn, onNoteOff }) => {
  
  const keys = [];
  for (let i = 0; i < OCTAVES * 12; i++) {
      const note = START_NOTE + i;
      const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
      keys.push({ note, isBlack });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 h-48 bg-zinc-950 border-t border-zinc-800 z-[200] animate-in slide-in-from-bottom duration-200 select-none touch-none flex flex-col shadow-2xl">
        <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center px-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-studio-accent animate-pulse" /> Virtual Piano
            </span>
            <button onClick={onClose} className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white">CLOSE</button>
        </div>
        <div className="flex-1 flex relative overflow-x-auto no-scrollbar">
            {keys.map((k, idx) => {
                // Simple flex layout: White keys take space, black keys absolute over them
                if (k.isBlack) return null; 
                
                // Find if there's a black key after this white key
                const nextNote = k.note + 1;
                const hasBlack = [1, 3, 6, 8, 10].includes(nextNote % 12);
                
                return (
                    <div key={k.note} className="flex-1 relative min-w-[40px] border-r border-zinc-300 bg-white active:bg-zinc-200 rounded-b-md mx-[1px]"
                         onPointerDown={(e) => {
                             e.currentTarget.setPointerCapture(e.pointerId);
                             onNoteOn(k.note, 100);
                         }}
                         onPointerUp={(e) => {
                             e.currentTarget.releasePointerCapture(e.pointerId);
                             onNoteOff(k.note);
                         }}
                         onPointerLeave={() => onNoteOff(k.note)}
                    >
                        {hasBlack && (
                            <div 
                                className="absolute top-0 -right-3 w-6 h-[60%] bg-black z-10 rounded-b-sm active:bg-zinc-800 border border-zinc-800"
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                    onNoteOn(nextNote, 100);
                                }}
                                onPointerUp={(e) => {
                                    e.stopPropagation();
                                    e.currentTarget.releasePointerCapture(e.pointerId);
                                    onNoteOff(nextNote);
                                }}
                                onPointerLeave={() => onNoteOff(nextNote)}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    </div>
  );
};

export default VirtualKeyboard;
