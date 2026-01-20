
import React, { useState, useEffect, useRef } from 'react';

interface FaderProps {
  value: number; // 0 to 1 (Global State)
  onChange: (val: number) => void; // Called on drag (Immediate / Audio Engine)
  onChangeEnd?: (val: number) => void; // Called on release (Commit / React State)
  height?: number;
  defaultValue?: number;
}

const CustomFader: React.FC<FaderProps> = ({ value: externalValue, onChange, onChangeEnd, height = 200, defaultValue }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    // Local state manages the visual position immediately to avoid React render lag
    const [localValue, setLocalValue] = useState(externalValue);
    const isDragging = useRef(false);

    // Sync local state if external state changes (e.g. undo/redo, automation) ONLY when not dragging
    useEffect(() => {
        if (!isDragging.current) {
            setLocalValue(externalValue);
        }
    }, [externalValue]);

    const calculateValue = (e: React.PointerEvent) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        return 1 - (y / rect.height);
    }

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
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
        
        // Commit final value to global state / history
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
        <div 
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(localValue * 100)}
            ref={trackRef}
            className="relative w-10 cursor-pointer touch-none select-none py-2 outline-none focus:ring-2 focus:ring-blue-500/50 rounded"
            style={{ height: `${height}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
             {/* Rail */}
             <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 bg-black/40 rounded-full shadow-inner border border-white/5" />
             
             {/* Ticks */}
             <div className="absolute top-2 bottom-2 left-0 right-0 pointer-events-none flex flex-col justify-between">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="flex justify-between w-full px-0.5">
                        <div className="w-1.5 h-px bg-zinc-600/50"></div>
                        <div className="w-1.5 h-px bg-zinc-600/50"></div>
                    </div>
                ))}
             </div>

             {/* Thumb */}
             <div 
                className="absolute left-1/2 -translate-x-1/2 w-8 h-12 bg-gradient-to-t from-zinc-400 to-zinc-200 rounded shadow-xl border-t border-white/50 border-b border-black/50 z-10 flex items-center justify-center will-change-transform"
                style={{ 
                    bottom: `${localValue * 100}%`,
                    transform: `translate(-50%, ${localValue * 100}%) translateY(50%)`
                }}
             >
                <div className="w-full h-0.5 bg-black/20" />
             </div>
        </div>
    )
}

export default CustomFader;
