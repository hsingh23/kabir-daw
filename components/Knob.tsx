import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number; // 0 to 1
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

const Knob: React.FC<KnobProps> = ({ label, value, onChange, min = 0, max = 1 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  // Convert 0-1 value to degrees (-135 to 135)
  const deg = (value - min) / (max - min) * 270 - 135;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = 0.005; // Adjust sensitivity
    let newValue = startValue.current + deltaY * sensitivity * range;
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2 select-none touch-none">
      <div 
        className="relative w-16 h-16 rounded-full shadow-knob bg-gradient-to-br from-zinc-200 to-zinc-400 border border-zinc-600 cursor-ns-resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Inner metal texture effect */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-tl from-zinc-300 to-zinc-100" />
        
        {/* The rotating indicator */}
        <div 
          className="absolute inset-0 w-full h-full rounded-full"
          style={{ transform: `rotate(${deg}deg)` }}
        >
          {/* Tick mark */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-zinc-800 rounded-sm shadow-sm" />
        </div>
      </div>
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
  );
};

export default Knob;