
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
            className="sticky top-0 h-8 bg-zinc-900/95 backdrop-blur z-30 border-b border-zinc-700 cursor-pointer text-[9px] text-zinc-500 select-none shadow-sm group/ruler"
            onPointerDown={onSeek}
            onDoubleClick={onAddMarker}
        >
            {/* Bar Numbers */}
            {Array.from({ length: totalBars }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-700 pl-1 pt-1.5 font-medium pointer-events-none" style={{ left: i * pixelsPerBar }}>
                    {i + 1}
                </div>
            ))}
            
            {/* Markers */}
            {markers.map(marker => (
                <div 
                    key={marker.id}
                    className="absolute top-0 h-8 flex items-center group z-40 hover:z-50 cursor-context-menu"
                    style={{ left: marker.time * zoom }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteMarker(marker.id, marker.text);
                    }}
                >
                    <div className="w-px h-full bg-yellow-500" />
                    <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded-sm text-[9px] font-bold shadow-sm ml-0.5 whitespace-nowrap hover:bg-yellow-400 transition-colors">
                        {marker.text}
                    </div>
                </div>
            ))}
            
            {/* Loop Region Interactive */}
            {isLooping && (
                 <>
                    <div 
                        className="absolute top-0 h-4 bg-yellow-500/20 border-x-2 border-yellow-500 z-20 cursor-move" 
                        style={{ left: loopStart * zoom, width: Math.max(1, (loopEnd - loopStart) * zoom) }}
                        onPointerDown={(e) => onLoopDragStart(e, 'MOVE')}
                    >
                        <div className="absolute inset-0 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors" />
                    </div>
                    <div 
                        className="absolute top-0 h-8 w-4 -ml-2 z-30 cursor-ew-resize group/handle" 
                        style={{ left: loopStart * zoom }}
                        onPointerDown={(e) => onLoopDragStart(e, 'START')}
                    >
                        <div className="w-0.5 h-full bg-yellow-500 mx-auto group-hover/handle:w-1 transition-all" />
                    </div>
                     <div 
                        className="absolute top-0 h-8 w-4 -ml-2 z-30 cursor-ew-resize group/handle" 
                        style={{ left: loopEnd * zoom }}
                        onPointerDown={(e) => onLoopDragStart(e, 'END')}
                    >
                        <div className="w-0.5 h-full bg-yellow-500 mx-auto group-hover/handle:w-1 transition-all" />
                    </div>
                 </>
            )}
        </div>
    );
});

export default Ruler;
