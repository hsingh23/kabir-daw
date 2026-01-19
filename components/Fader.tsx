import React from 'react';

interface FaderProps {
  value: number; // 0 to 1
  onChange: (val: number) => void;
  height?: number;
}

const Fader: React.FC<FaderProps> = ({ value, onChange, height = 200 }) => {
  return (
    <div className="relative w-12 flex flex-col items-center group">
      {/* Track Background */}
      <div 
        className="w-2 bg-zinc-800 rounded-full shadow-inset-track border border-zinc-700/50"
        style={{ height: `${height}px` }}
      >
        {/* Ticks */}
        <div className="absolute top-0 bottom-0 left-0 w-full flex flex-col justify-between py-2 pointer-events-none opacity-30">
          {[...Array(11)].map((_, i) => (
             <div key={i} className="w-full h-px bg-zinc-400 mx-auto w-4" />
          ))}
        </div>
      </div>

      {/* Input Slider (Invisible but clickable) */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute top-0 opacity-0 cursor-pointer w-full"
        style={{ 
            height: `${height}px`,
            // Rotate to make it vertical if supported, but here we keep it standard and rely on custom Thumb via CSS or absolute positioning
            // Standard vertical range input is tricky cross-browser.
            // Let's implement custom drag instead for true verticality.
            appearance: 'slider-vertical' as any, // Works in some browsers
            width: '40px'
        }}
        // Fallback for better touch control on mobile without slider-vertical support
        onInput={(e: any) => {
             // Hack for vertical input if needed, but we'll use a custom thumb for visuals below
        }}
      />

      {/* Custom Thumb Visuals - positioned absolutely based on value */}
      <div 
        className="absolute w-8 h-12 bg-gradient-to-b from-zinc-300 to-zinc-400 rounded shadow-lg border border-zinc-500 pointer-events-none flex items-center justify-center"
        style={{ 
            bottom: `${value * (height - 48)}px`, // 48 is approximate thumb height
            marginBottom: '0px'
        }}
      >
         <div className="w-6 h-0.5 bg-zinc-500/50" />
      </div>
    </div>
  );
};

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