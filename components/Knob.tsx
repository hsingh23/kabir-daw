
import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number; // 0 to 1
  onChange: (val: number) => void;
  onChangeEnd?: (val: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
}

const Knob: React.FC<KnobProps> = ({ label, value: externalValue, onChange, onChangeEnd, min = 0, max = 1, defaultValue }) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const isDragging = useRef(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  // Sync with external updates (automation, undo/redo)
  useEffect(() => {
      if (!isDragging.current) {
          setLocalValue(externalValue);
      }
  }, [externalValue]);

  // Convert current local value to degrees (-135 to 135)
  const deg = (localValue - min) / (max - min) * 270 - 135;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = localValue;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = 0.005; 
    let newValue = startValue.current + deltaY * sensitivity * range;
    newValue = Math.max(min, Math.min(max, newValue));
    
    setLocalValue(newValue);
    onChange(newValue); // Transient update
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);
    if (onChangeEnd) onChangeEnd(localValue);
    else onChange(localValue);
  };

  const handleDoubleClick = () => {
      if (defaultValue !== undefined) {
          setLocalValue(defaultValue);
          onChange(defaultValue);
          if (onChangeEnd) onChangeEnd(defaultValue);
      }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2 select-none touch-none">
      <div 
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={localValue}
        className="relative w-16 h-16 rounded-full shadow-knob bg-gradient-to-br from-zinc-200 to-zinc-400 border border-zinc-600 cursor-ns-resize outline-none focus:ring-2 focus:ring-studio-accent focus:ring-offset-2 focus:ring-offset-zinc-900"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
             const range = max - min;
             const step = e.shiftKey ? range * 0.1 : range * 0.01;
             let newValue = localValue;
             if (e.key === 'ArrowUp' || e.key === 'ArrowRight') newValue = Math.min(max, localValue + step);
             if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') newValue = Math.max(min, localValue - step);
             
             if (newValue !== localValue) {
                 setLocalValue(newValue);
                 onChange(newValue);
                 if (onChangeEnd) onChangeEnd(newValue);
             }
        }}
      >
        {/* Inner metal texture effect */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-tl from-zinc-300 to-zinc-100" />
        
        {/* The rotating indicator */}
        <div 
          className="absolute inset-0 w-full h-full rounded-full will-change-transform"
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
