
import React, { useState, useEffect, useRef } from 'react';

interface FaderProps {
  value: number; // 0 to 1 (Global State)
  onChange: (val: number) => void; // Called on drag (Immediate / Audio Engine)
  onChangeEnd?: (val: number) => void; // Called on release (Commit / React State)
  height?: number;
  defaultValue?: number;
}

const CustomFader: React.FC<FaderProps> = ({ value: externalValue, onChange, onChangeEnd, height = 200, defaultValue }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = useState(externalValue);
    const isDragging = useRef(false);

    useEffect(() => {
        if (!isDragging.current) {
            setLocalValue(externalValue);
        }
    }, [externalValue]);

    const calculateValue = (e: React.PointerEvent) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        // 0 at bottom, 1 at top
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        return 1 - (y / rect.height);
    }

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
        // Don't jump to value immediately on click? Standard fader behavior usually jumps or catches. 
        // Jumping is better for web touch if the handle is small.
        const val = calculateValue(e);
        setLocalValue(val);
        onChange(val); 
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const val = calculateValue(e);
        setLocalValue(val);
        onChange(val); 
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
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

    // Calculate DB marks for visual reference (approximate linear-to-log scale mapping visual)
    // 0.8 = 0dB usually in this app's logic
    const dbMarks = [
        { val: 0.9, label: '+6' },
        { val: 0.8, label: '0' },
        { val: 0.65, label: '-6' },
        { val: 0.5, label: '-12' },
        { val: 0.3, label: '-24' },
        { val: 0.1, label: '-48' }
    ];

    return (
        <div 
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(localValue * 100)}
            ref={trackRef}
            className="relative w-10 cursor-ns-resize touch-none select-none py-4 outline-none group"
            style={{ height: `${height}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
             {/* Track Background */}
             <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-2 bg-[#111] rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] border border-white/5">
                 <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-black/50" />
             </div>
             
             {/* Ticks */}
             <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
                {dbMarks.map((mark) => (
                    <div key={mark.label} className="absolute w-full flex justify-between px-0.5 items-center" style={{ bottom: `${mark.val * 100}%`, transform: 'translateY(50%)' }}>
                        <div className="w-1.5 h-px bg-zinc-600"></div>
                        <div className="w-1.5 h-px bg-zinc-600"></div>
                    </div>
                ))}
             </div>

             {/* Fader Cap */}
             <div 
                className="absolute left-1/2 -translate-x-1/2 w-8 h-12 z-10 will-change-transform"
                style={{ 
                    bottom: `${localValue * 100}%`,
                    transform: `translate(-50%, 50%)`, // Center cap on value
                    filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.5))'
                }}
             >
                {/* Silver Body */}
                <div className="w-full h-full rounded bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 border-t border-white/40 border-b border-black/60 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Concave shape illusion */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-6 bg-gradient-to-b from-transparent via-black/10 to-transparent pointer-events-none" />
                    
                    {/* Grip Lines */}
                    <div className="w-full h-px bg-black/20 mb-1" />
                    <div className="w-full h-px bg-black/20 mb-1" />
                    <div className="w-full h-px bg-black/20" />
                    
                    {/* Center Line Indicator */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-black/70 left-1/2 -translate-x-1/2" />
                    <div className="absolute top-0 bottom-0 w-px bg-white/20 left-1/2 -translate-x-1/2 ml-px" />
                </div>
             </div>
        </div>
    )
}

export default CustomFader;
