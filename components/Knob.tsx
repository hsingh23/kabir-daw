
import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number; // 0 to 1
  onChange: (val: number) => void;
  onChangeEnd?: (val: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
  size?: number;
  color?: string;
}

const Knob: React.FC<KnobProps> = ({ 
    label, value: externalValue, onChange, onChangeEnd, 
    min = 0, max = 1, defaultValue, 
    size = 48, color = '#3b82f6' 
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const isDragging = useRef(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  useEffect(() => {
      if (!isDragging.current) {
          setLocalValue(externalValue);
      }
  }, [externalValue]);

  // Degrees: -135 (min) to 135 (max)
  const angleRange = 270;
  const startAngle = -135;
  const normalizedValue = (localValue - min) / (max - min);
  const currentAngle = startAngle + (normalizedValue * angleRange);

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
    onChange(newValue);
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

  // SVG Calculation
  const center = size / 2;
  const radius = (size / 2) - 4;
  const strokeWidth = 3;
  
  // Helper to get coordinates on circle
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
      var start = polarToCartesian(x, y, radius, endAngle);
      var end = polarToCartesian(x, y, radius, startAngle);
      var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      var d = [
          "M", start.x, start.y, 
          "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
      ].join(" ");
      return d;       
  }

  // Value Arc
  const valuePath = describeArc(center, center, radius, startAngle, currentAngle);
  // Background Arc (full range)
  const bgPath = describeArc(center, center, radius, startAngle, startAngle + angleRange);

  return (
    <div className="flex flex-col items-center justify-center space-y-1 select-none touch-none group">
      <div 
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={localValue}
        className="relative cursor-ns-resize outline-none"
        style={{ width: size, height: size }}
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
        <svg width={size} height={size} className="pointer-events-none">
            {/* Track Background */}
            <path d={bgPath} fill="none" stroke="#27272a" strokeWidth={strokeWidth} strokeLinecap="round" />
            
            {/* Value Arc */}
            <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" className="filter drop-shadow-sm transition-all duration-75" />
        </svg>

        {/* Knob Body */}
        <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#18181b] shadow-lg border border-zinc-700 group-hover:border-zinc-500 transition-colors"
            style={{ width: size * 0.65, height: size * 0.65 }}
        >
             {/* Indicator Line */}
             <div 
                className="absolute top-0 left-1/2 w-0.5 h-1/2 -translate-x-1/2 origin-bottom"
                style={{ transform: `rotate(${currentAngle}deg)` }}
             >
                 <div className="w-full h-1/2 bg-white rounded-full mx-auto mt-1" />
             </div>
        </div>
      </div>
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">{label}</span>
    </div>
  );
};

export default Knob;
