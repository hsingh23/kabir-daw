
import React, { useRef, useState, useEffect } from 'react';
import { MidiNote } from '../types';

interface PianoRollProps {
  notes: MidiNote[];
  duration: number;
  onNotesChange: (notes: MidiNote[]) => void;
}

const PianoRoll: React.FC<PianoRollProps> = ({ notes, duration, onNotesChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  
  // View State
  const [zoomX, setZoomX] = useState(100); // pixels per second
  const noteHeight = 16; // pixels per semitone
  const minPitch = 36; // C2
  const maxPitch = 84; // C6
  
  // Interaction State
  const [dragState, setDragState] = useState<{
      type: 'move' | 'resize' | 'create',
      noteIndex: number,
      startX: number,
      startY: number,
      initialStart: number,
      initialPitch: number,
      initialDuration: number
  } | null>(null);

  const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const keysWidth = 40; // Width of the piano keys sidebar
      const width = Math.max(container.clientWidth, (duration * zoomX) + keysWidth);
      const height = (maxPitch - minPitch + 1) * noteHeight;
      
      // Update canvas size
      if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
      }

      // Draw Background
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, width, height);

      // --- Grid & Rows ---
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= maxPitch - minPitch; i++) {
          const pitch = maxPitch - i;
          const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
          const y = i * noteHeight;
          
          // Row Background
          ctx.fillStyle = isBlack ? '#27272a' : '#3f3f46'; 
          ctx.fillRect(keysWidth, y, width - keysWidth, noteHeight);
          
          // Horizontal Lines
          ctx.strokeStyle = '#52525b';
          ctx.beginPath();
          ctx.moveTo(keysWidth, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          
          // --- Piano Keys Sidebar ---
          ctx.fillStyle = isBlack ? 'black' : 'white';
          ctx.fillRect(0, y, keysWidth, noteHeight);
          ctx.strokeStyle = '#71717a';
          ctx.strokeRect(0, y, keysWidth, noteHeight);
          
          // Note Labels on C
          if (pitch % 12 === 0) {
              ctx.fillStyle = isBlack ? 'white' : 'black';
              ctx.font = '9px sans-serif';
              ctx.fillText(`C${Math.floor(pitch / 12) - 1}`, 2, y + noteHeight - 4);
          }
      }

      // --- Vertical Time Grid ---
      const secondsPerBeat = 0.5; // Assuming 120bpm for grid visual
      const gridSpacing = zoomX * secondsPerBeat;
      for (let x = keysWidth; x < width; x += gridSpacing) {
          ctx.strokeStyle = '#3f3f46';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
      }

      // --- Draw Notes ---
      notes.forEach((note, index) => {
          const x = keysWidth + (note.start * zoomX);
          const y = (maxPitch - note.note) * noteHeight;
          const w = note.duration * zoomX;
          const h = noteHeight;

          const isSelected = index === selectedNoteIndex;

          ctx.fillStyle = isSelected ? '#ef4444' : '#3b82f6';
          ctx.fillRect(x, y + 1, w, h - 2); // +1/-2 for slight gap
          
          ctx.strokeStyle = isSelected ? '#fff' : '#1d4ed8';
          ctx.strokeRect(x, y + 1, w, h - 2);
      });
  };

  useEffect(() => {
      draw();
  }, [notes, duration, zoomX, selectedNoteIndex]);

  const keysWidth = 40;

  const getPitchAtY = (y: number) => {
      const row = Math.floor(y / noteHeight);
      return maxPitch - row;
  };

  const getTimeAtX = (x: number) => {
      return Math.max(0, (x - keysWidth) / zoomX);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x < keysWidth) return; // Ignore sidebar clicks for now

      // Check hit
      const clickedNoteIndex = notes.findIndex(n => {
          const nx = keysWidth + (n.start * zoomX);
          const ny = (maxPitch - n.note) * noteHeight;
          const nw = n.duration * zoomX;
          return x >= nx && x <= nx + nw && y >= ny && y <= ny + noteHeight;
      });

      if (clickedNoteIndex !== -1) {
          setSelectedNoteIndex(clickedNoteIndex);
          const note = notes[clickedNoteIndex];
          
          const nx = keysWidth + (note.start * zoomX);
          const nw = note.duration * zoomX;
          
          // Right edge resize zone
          if (x > nx + nw - 10) {
              setDragState({
                  type: 'resize',
                  noteIndex: clickedNoteIndex,
                  startX: x,
                  startY: y,
                  initialStart: note.start,
                  initialPitch: note.note,
                  initialDuration: note.duration
              });
          } else {
              setDragState({
                  type: 'move',
                  noteIndex: clickedNoteIndex,
                  startX: x,
                  startY: y,
                  initialStart: note.start,
                  initialPitch: note.note,
                  initialDuration: note.duration
              });
          }
      } else {
          // Create new note
          const pitch = getPitchAtY(y);
          const time = getTimeAtX(x);
          const snappedTime = Math.floor(time * 4) / 4; 
          
          if (pitch >= minPitch && pitch <= maxPitch) {
              const newNote: MidiNote = {
                  note: pitch,
                  start: snappedTime,
                  duration: 0.25,
                  velocity: 100
              };
              const newNotes = [...notes, newNote];
              onNotesChange(newNotes);
              setSelectedNoteIndex(newNotes.length - 1);
              
              setDragState({
                  type: 'resize', // Immediately resize new note
                  noteIndex: newNotes.length - 1,
                  startX: x,
                  startY: y,
                  initialStart: snappedTime,
                  initialPitch: pitch,
                  initialDuration: 0.25
              });
          } else {
              setSelectedNoteIndex(null);
          }
      }
      
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragState) return;
      
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const deltaX = x - dragState.startX;
      const deltaY = y - dragState.startY;
      
      const deltaSeconds = deltaX / zoomX;
      
      const updatedNotes = [...notes];
      // Safety check if note exists (e.g. if external delete happened)
      if (!updatedNotes[dragState.noteIndex]) return;
      
      const note = { ...updatedNotes[dragState.noteIndex] };

      if (dragState.type === 'move') {
          // Time
          const newStart = Math.max(0, dragState.initialStart + deltaSeconds);
          const snappedStart = Math.round(newStart * 8) / 8;
          note.start = snappedStart;
          
          // Pitch
          const pitchDiff = Math.round(-deltaY / noteHeight);
          const newPitch = Math.max(minPitch, Math.min(maxPitch, dragState.initialPitch + pitchDiff));
          note.note = newPitch;
      } else {
          // Resize
          const newDuration = Math.max(0.05, dragState.initialDuration + deltaSeconds);
          const snappedDuration = Math.round(newDuration * 8) / 8;
          note.duration = Math.max(0.125, snappedDuration);
      }
      
      updatedNotes[dragState.noteIndex] = note;
      onNotesChange(updatedNotes);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setDragState(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
      <div className="flex flex-col h-full bg-zinc-950">
          <div className="flex justify-between px-2 py-1 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Piano Roll</span>
              <div className="flex gap-2">
                  <button onClick={() => setZoomX(z => Math.max(50, z * 0.8))} className="text-zinc-400 text-xs hover:text-white">-</button>
                  <button onClick={() => setZoomX(z => Math.min(400, z * 1.2))} className="text-zinc-400 text-xs hover:text-white">+</button>
              </div>
          </div>
          <div 
            ref={containerRef} 
            className="flex-1 overflow-auto relative touch-none"
          >
              <canvas 
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="cursor-pointer block"
              />
          </div>
      </div>
  );
};

export default PianoRoll;
