
import React, { memo } from 'react';
import { Track } from '../types';
import TrackIcon from './TrackIcon';
import LevelMeter from './LevelMeter';
import { Disc, GripVertical, Settings2 } from 'lucide-react';

interface TrackLaneProps {
    track: Track;
    index: number;
    trackHeight: number;
    isCompactHeader: boolean;
    isSelected: boolean;
    onSelectTrack: (id: string) => void;
    onOpenInspector: (id: string) => void;
    handleTrackDragStart: (e: React.PointerEvent, id: string, index: number) => void;
    updateTrack: (id: string, updates: Partial<Track>) => void;
}

const TrackLane: React.FC<TrackLaneProps> = memo(({ 
    track, index, trackHeight, isCompactHeader, isSelected, 
    onSelectTrack, onOpenInspector, handleTrackDragStart, updateTrack 
}) => {
    return (
        <div 
            className={`border-b border-zinc-800 relative group transition-colors select-none flex flex-col justify-center ${isSelected ? 'bg-zinc-800' : 'bg-transparent'}`}
            style={{ height: trackHeight }}
            onPointerDown={() => onSelectTrack(track.id)}
            onDoubleClick={() => onOpenInspector(track.id)}
        >
            {/* Color Strip */}
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color }} />
            
            <div className="px-2 pl-3 flex flex-col h-full py-2 justify-between relative">
                {/* Top Row: Name & Icon */}
                <div className="flex items-center space-x-2">
                    <div 
                        className="text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity absolute left-1.5 p-1 z-10"
                        onPointerDown={(e) => handleTrackDragStart(e, track.id, index)}
                    >
                        <GripVertical size={12} />
                    </div>
                    <div className="w-5 h-5 rounded bg-zinc-900 flex items-center justify-center shrink-0 ml-4">
                        <TrackIcon icon={track.icon} name={track.name} color={track.color} />
                    </div>
                    <span className={`font-bold text-zinc-200 truncate cursor-pointer hover:text-studio-accent ${isCompactHeader ? 'text-[10px]' : 'text-xs'}`}>
                        {track.name}
                    </span>
                    
                    {/* Settings Button (Visible on hover or if compact header for accessibility) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenInspector(track.id);
                        }}
                        className={`ml-auto p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-opacity ${isCompactHeader ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title="Track Settings"
                    >
                        <Settings2 size={12} />
                    </button>
                </div>

                {/* Middle Row: Controls (Hidden on compact) */}
                {!isCompactHeader && trackHeight > 80 && (
                    <div className="flex items-center space-x-2 px-1">
                        <div className="flex-1">
                            <input 
                                type="range" min={0} max={1} step={0.01}
                                value={track.volume} 
                                onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                            />
                        </div>
                        <div className="w-4 text-[9px] text-zinc-500 text-right">{Math.round(track.pan * 50)}</div>
                    </div>
                )}

                {/* Bottom Row: Buttons */}
                <div className="flex space-x-1 items-center pl-4">
                    <button 
                        className={`w-4 h-4 rounded text-[8px] font-bold border border-zinc-700 flex items-center justify-center hover:border-red-500 hover:text-red-500 text-zinc-600 transition-colors`}
                        title="Record Arm"
                    >
                        <Disc size={8} fill="currentColor" />
                    </button>
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                        className={`w-4 h-4 rounded text-[8px] font-bold border flex items-center justify-center transition-colors ${track.muted ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                    >M</button>
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                        className={`w-4 h-4 rounded text-[8px] font-bold border flex items-center justify-center transition-colors ${track.solo ? 'bg-yellow-500 border-yellow-500 text-black' : 'border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                    >S</button>
                    
                    {!isCompactHeader && (
                        <div className="ml-auto flex items-center space-x-1">
                            <LevelMeter trackId={track.id} vertical={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default TrackLane;
