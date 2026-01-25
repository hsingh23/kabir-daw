
import React, { memo } from 'react';
import { Marker } from '../types';

interface RulerProps {
    totalBars: number;
    pixelsPerBar: number;
    zoom: number;
    markers: Marker[];
    loopStart: number;
    loopEnd: number;
    isLooping: boolean;
    onSeek: (e: React.PointerEvent) => void;
    onAddMarker: (e: React.MouseEvent) => void;
    onDeleteMarker: (id: string, text: string) => void;
    onLoopDragStart: (e: React.PointerEvent, mode: 'START' | 'END' | 'MOVE') => void;
}

const Ruler: React.FC<RulerProps> = memo(({ 
    totalBars, pixelsPerBar, zoom, markers, 
    loopStart, loopEnd, isLooping, 
    onSeek, onAddMarker, onDeleteMarker, onLoopDragStart 
}) => {
    return (
        <div 
            className="sticky top-0 h-8 bg-[#1e1e1e] border-b border-black cursor-pointer text-zinc-500 select-none shadow-md z-30 touch-none"
            onPointerDown={onSeek}
            onDoubleClick={onAddMarker}
        >
            {/* Ticks & Numbers */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: totalBars }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 flex flex-col justify-end" style={{ left: i * pixelsPerBar }}>
                        {/* Bar Number */}
                        <div className="absolute top-0.5 left-1 font-bold text-zinc-400 text-[10px]">{i + 1}</div>
                        
                        {/* Major Bar Line */}
                        <div className="absolute bottom-0 left-0 w-px h-full bg-zinc-600/30" />
                        
                        {/* Beat Lines */}
                        <div className="absolute bottom-0 left-1/4 w-px h-1.5 bg-zinc-700/50" style={{ left: pixelsPerBar * 0.25 }} />
                        <div className="absolute bottom-0 left-2/4 w-px h-2.5 bg-zinc-600/50" style={{ left: pixelsPerBar * 0.5 }} />
                        <div className="absolute bottom-0 left-3/4 w-px h-1.5 bg-zinc-700/50" style={{ left: pixelsPerBar * 0.75 }} />
                        
                        {/* Subdivisions (High Zoom) */}
                        {pixelsPerBar > 100 && (
                            <>
                                <div className="absolute bottom-0 w-px h-1 bg-zinc-800" style={{ left: pixelsPerBar * 0.125 }} />
                                <div className="absolute bottom-0 w-px h-1 bg-zinc-800" style={{ left: pixelsPerBar * 0.375 }} />
                                <div className="absolute bottom-0 w-px h-1 bg-zinc-800" style={{ left: pixelsPerBar * 0.625 }} />
                                <div className="absolute bottom-0 w-px h-1 bg-zinc-800" style={{ left: pixelsPerBar * 0.875 }} />
                            </>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Loop Region (Logic Yellow Cycle) */}
            {isLooping && (
                 <>
                    {/* Loop Bar */}
                    <div 
                        className="absolute top-0 bottom-0 bg-[#facc1515] border-x border-[#facc15] z-20 cursor-move" 
                        style={{ left: loopStart * zoom, width: Math.max(1, (loopEnd - loopStart) * zoom) }}
                        onPointerDown={(e) => onLoopDragStart(e, 'MOVE')}
                    >
                        {/* Active Loop Strip at top */}
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                    </div>
                    
                    {/* Left Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-4 -ml-2 z-30 cursor-ew-resize group/handle flex justify-center items-start" 
                        style={{ left: loopStart * zoom }}
                        onPointerDown={(e) => onLoopDragStart(e, 'START')}
                    >
                        <div className="w-px h-full bg-[#facc15]" />
                    </div>
                    
                    {/* Right Handle */}
                     <div 
                        className="absolute top-0 bottom-0 w-4 -ml-2 z-30 cursor-ew-resize group/handle flex justify-center items-start" 
                        style={{ left: loopEnd * zoom }}
                        onPointerDown={(e) => onLoopDragStart(e, 'END')}
                    >
                        <div className="w-px h-full bg-[#facc15]" />
                    </div>
                 </>
            )}

            {/* Markers */}
            {markers.map(marker => (
                <div 
                    key={marker.id}
                    className="absolute top-0 bottom-0 flex items-start z-40 hover:z-50 cursor-context-menu group"
                    style={{ left: marker.time * zoom }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteMarker(marker.id, marker.text);
                    }}
                >
                    <div className="w-px h-full bg-orange-500/50 group-hover:bg-orange-500 shadow-[0_0_2px_rgba(249,115,22,0.5)] transition-colors" />
                    <div className="absolute top-0 left-0 bg-zinc-800 border border-zinc-600 text-zinc-200 px-1.5 py-0.5 text-[9px] font-bold shadow-sm whitespace-nowrap rounded-sm">
                        {marker.text}
                    </div>
                </div>
            ))}
        </div>
    );
});

export default Ruler;
