import React from 'react';

interface FaderProps {
  value: number; // 0 to 1
  onChange: (val: number) => void;
  height?: number;
}

// Re-implementing Fader with Pointer Events for true vertical behavior across all devices
const CustomFader: React.FC<FaderProps> = ({ value, onChange, height = 200 }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        // Calculate value based on Y position (bottom is 0, top is 1)
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        // Invert because Y grows downwards
        const newValue = 1 - (y / rect.height);
        onChange(newValue);
    };

    return (
        <div 
            ref={trackRef}
            className="relative w-10 cursor-pointer touch-none select-none py-2"
            style={{ height: `${height}px` }}
            onPointerDown={(e) => {
                (e.target as Element).setPointerCapture(e.pointerId);
                handlePointerMove(e);
            }}
            onPointerMove={(e) => {
                if (e.buttons === 1) handlePointerMove(e);
            }}
            onPointerUp={(e) => (e.target as Element).releasePointerCapture(e.pointerId)}
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
                className="absolute left-1/2 -translate-x-1/2 w-8 h-12 bg-gradient-to-t from-zinc-400 to-zinc-200 rounded shadow-xl border-t border-white/50 border-b border-black/50 z-10 flex items-center justify-center"
                style={{ 
                    bottom: `${value * 100}%`,
                    transform: `translate(-50%, ${value * 100}%) translateY(50%)`
                }}
             >
                <div className="w-full h-0.5 bg-black/20" />
             </div>
        </div>
    )
}

export default CustomFader;