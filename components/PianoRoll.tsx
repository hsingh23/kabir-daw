
import React, { useRef, useState, useEffect } from 'react';
import { MidiNote } from '../types';
import { getPitchAtY, getTimeAtX, getNoteAtPosition } from '../services/utils';

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
  const noteHeight = 20; // Taller rows for touch
  const minPitch = 36; // C2
  const maxPitch = 84; // C6
  const keysWidth = 50;
  
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

      const width = Math.max(container.clientWidth, (duration * zoomX) + keysWidth);
      const height = (maxPitch - minPitch + 1) * noteHeight;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.scale(dpr, dpr);

      // 1. Background
      ctx.fillStyle = '#1c1c1c'; // Dark Logic background
      ctx.fillRect(0, 0, width, height);

      // 2. Horizontal Rows & Keys
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= maxPitch - minPitch; i++) {
          const pitch = maxPitch - i;
          const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
          const y = i * noteHeight;
          
          // Row Background
          if (isBlack) {
              ctx.fillStyle = '#161616'; 
              ctx.fillRect(keysWidth, y, width - keysWidth, noteHeight);
          } else {
              ctx.fillStyle = '#1e1e1e';
              ctx.fillRect(keysWidth, y, width - keysWidth, noteHeight);
          }
          
          // Horizontal Lines
          ctx.strokeStyle = '#2a2a2a';
          ctx.beginPath();
          ctx.moveTo(keysWidth, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          
          // --- Piano Keys Sidebar ---
          // White key
          if (!isBlack) {
              ctx.fillStyle = '#d4d4d4';
              ctx.fillRect(0, y, keysWidth, noteHeight);
              ctx.strokeStyle = '#888';
              ctx.strokeRect(0, y, keysWidth, noteHeight);
              
              // Note Labels on C
              if (pitch % 12 === 0) {
                  ctx.fillStyle = '#111';
                  ctx.font = 'bold 9px system-ui';
                  ctx.fillText(`C${Math.floor(pitch / 12) - 1}`, 30, y + noteHeight - 5);
              }
          } else {
              // Black key
              ctx.fillStyle = '#111';
              ctx.fillRect(0, y, keysWidth, noteHeight);
              ctx.fillStyle = '#333'; // gradient hint
              ctx.fillRect(0, y, keysWidth * 0.7, noteHeight); // slightly shorter look
              
              ctx.strokeStyle = '#000';
              ctx.strokeRect(0, y, keysWidth, noteHeight);
          }
      }

      // 3. Vertical Time Grid
      const secondsPerBeat = 0.5; // Assuming 120bpm for grid visual default
      const gridSpacing = zoomX * secondsPerBeat;
      
      for (let x = keysWidth; x < width; x += gridSpacing) {
          // Bar lines
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          
          // Subdivisions (16th notes)
          const subDiv = gridSpacing / 4;
          ctx.strokeStyle = '#252525';
          for (let s = 1; s < 4; s++) {
              const sx = x + (subDiv * s);
              if (sx < width) {
                  ctx.beginPath();
                  ctx.moveTo(sx, 0);
                  ctx.lineTo(sx, height);
                  ctx.stroke();
              }
          }
      }

      // 4. Draw Notes
      notes.forEach((note, index) => {
          const x = keysWidth + (note.start * zoomX);
          const y = (maxPitch - note.note) * noteHeight;
          const w = Math.max(4, note.duration * zoomX);
          const h = noteHeight - 1;

          const isSelected = index === selectedNoteIndex;

          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(x + 2, y + 2, w, h);

          // Note Body (Green like Logic MIDI)
          const noteGradient = ctx.createLinearGradient(x, y, x, y + h);
          if (isSelected) {
              noteGradient.addColorStop(0, '#d1fae5');
              noteGradient.addColorStop(1, '#34d399');
          } else {
              noteGradient.addColorStop(0, '#86efac'); // lighter green top
              noteGradient.addColorStop(1, '#22c55e'); // darker green bottom
          }
          
          ctx.fillStyle = noteGradient;
          
          // Rounded Rect drawing
          const radius = 3;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, radius);
          ctx.fill();
          
          // Border
          ctx.strokeStyle = isSelected ? '#fff' : '#14532d'; // dark green border
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();
          
          // Resize handle hint (right edge)
          if (w > 10) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(x + w - 4, y + 2, 2, h - 4);
          }
      });
  };

  useEffect(() => {
      draw();
  }, [notes, duration, zoomX, selectedNoteIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x < keysWidth) return;

      const clickedNoteIndex = getNoteAtPosition(x, y, notes, zoomX, noteHeight, maxPitch, keysWidth);

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
          const pitch = getPitchAtY(y, noteHeight, maxPitch);
          const time = getTimeAtX(x, keysWidth, zoomX);
          // Snap to 16th (0.125s at 120bpm approx, or just 0.125s relative grid)
          // Ideally use grid settings, defaulting to 0.25s here
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
      if (!updatedNotes[dragState.noteIndex]) return;
      
      const note = { ...updatedNotes[dragState.noteIndex] };

      if (dragState.type === 'move') {
          // Time
          const newStart = Math.max(0, dragState.initialStart + deltaSeconds);
          const snappedStart = Math.round(newStart * 16) / 16;
          note.start = snappedStart;
          
          // Pitch
          const pitchDiff = Math.round(-deltaY / noteHeight);
          const newPitch = Math.max(minPitch, Math.min(maxPitch, dragState.initialPitch + pitchDiff));
          note.note = newPitch;
      } else {
          // Resize
          const newDuration = Math.max(0.05, dragState.initialDuration + deltaSeconds);
          const snappedDuration = Math.round(newDuration * 16) / 16;
          note.duration = Math.max(0.0625, snappedDuration);
      }
      
      updatedNotes[dragState.noteIndex] = note;
      onNotesChange(updatedNotes);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setDragState(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
      <div className="flex flex-col h-full bg-[#1c1c1c]">
          <div className="flex justify-between px-3 py-1.5 bg-[#252525] border-b border-black shrink-0 items-center">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Piano Roll Editor</span>
              <div className="flex gap-2">
                  <button onClick={() => setZoomX(z => Math.max(50, z * 0.8))} className="text-zinc-400 text-xs hover:text-white bg-zinc-800 px-2 rounded">-</button>
                  <button onClick={() => setZoomX(z => Math.min(400, z * 1.2))} className="text-zinc-400 text-xs hover:text-white bg-zinc-800 px-2 rounded">+</button>
              </div>
          </div>
          <div 
            ref={containerRef} 
            className="flex-1 overflow-auto relative touch-none bg-[#1c1c1c] shadow-inner custom-scrollbar"
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
