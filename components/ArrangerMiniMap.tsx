
import React, { useRef, useMemo } from 'react';
import { Clip } from '../types';

interface ArrangerMiniMapProps {
    clips: Clip[];
    totalDuration: number;
    visibleStartTime: number;
    visibleDuration: number;
    onScroll: (time: number) => void;
    className?: string;
}

const ArrangerMiniMap: React.FC<ArrangerMiniMapProps> = ({ 
    clips, totalDuration, visibleStartTime, visibleDuration, onScroll, className 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        // Calculate clicked time
        // x / width = time / totalDuration
        const clickTime = (x / width) * totalDuration;
        
        // Center the viewport on click
        const newStartTime = Math.max(0, clickTime - (visibleDuration / 2));
        onScroll(newStartTime);
        
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const width = rect.width;
        const clickTime = (x / width) * totalDuration;
        const newStartTime = Math.max(0, clickTime - (visibleDuration / 2));
        
        onScroll(newStartTime);
    };

    // Calculate viewport rect styles
    const viewportLeftPct = (visibleStartTime / totalDuration) * 100;
    const viewportWidthPct = Math.min(100, (visibleDuration / totalDuration) * 100);

    return (
        <div 
            ref={containerRef}
            className={`h-8 bg-zinc-900 border-b border-zinc-800 relative cursor-crosshair overflow-hidden ${className}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
        >
            {/* Clips Visual */}
            {clips.map(clip => {
                const left = (clip.start / totalDuration) * 100;
                const width = (clip.duration / totalDuration) * 100;
                return (
                    <div 
                        key={clip.id}
                        className="absolute top-1 bottom-1 rounded-sm opacity-50"
                        style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: clip.color || '#555'
                        }}
                    />
                );
            })}

            {/* Viewport Indicator */}
            <div 
                className="absolute top-0 bottom-0 border-2 border-studio-accent bg-studio-accent/10 pointer-events-none transition-all duration-75"
                style={{
                    left: `${viewportLeftPct}%`,
                    width: `${viewportWidthPct}%`
                }}
            />
        </div>
    );
};

export default ArrangerMiniMap;
