
import React, { memo } from 'react';
import { Track } from '../types';
import TrackIcon from './TrackIcon';
import LevelMeter from './LevelMeter';
import { Disc, GripVertical, Settings2, Mic, Headphones } from 'lucide-react';
import { audio } from '../services/audio';

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
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

const TrackLane: React.FC<TrackLaneProps> = memo(({ 
    track, index, trackHeight, isCompactHeader, isSelected, 
    onSelectTrack, onOpenInspector, handleTrackDragStart, updateTrack, onContextMenu
}) => {
    
    // Logic Pro inspired colors
    const bgClass = isSelected ? 'bg-[#3a3a3a]' : 'bg-[#2b2b2b]';
    const borderClass = isSelected ? 'border-zinc-600' : 'border-[#1a1a1a]';

    return (
        <div 
            className={`border-b ${borderClass} relative group transition-colors select-none flex flex-col justify-between ${bgClass}`}
            style={{ height: trackHeight }}
            onPointerDown={() => onSelectTrack(track.id)}
            onDoubleClick={() => onOpenInspector(track.id)}
            onContextMenu={(e) => {
                if(onContextMenu) {
                    e.preventDefault();
                    onContextMenu(e, track.id);
                }
            }}
        >
            {/* Color Strip (Left Edge) */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 shadow-[inset_-1px_0_2px_rgba(0,0,0,0.3)] z-10" style={{ backgroundColor: track.color }} />
            
            {/* Drag Handle Overlay */}
            <div 
                className="absolute left-0 top-0 bottom-0 w-4 cursor-grab active:cursor-grabbing z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/20"
                onPointerDown={(e) => handleTrackDragStart(e, track.id, index)}
            >
                <GripVertical size={12} className="text-white drop-shadow-md" />
            </div>

            <div className="pl-3 pr-1 py-1 flex flex-col h-full gap-0.5 relative">
                
                {/* Header Row: Icon & Name */}
                <div className="flex items-center gap-2 h-6">
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-black/40 shadow-inner border border-white/5">
                        <TrackIcon icon={track.icon} name={track.name} color={track.color} size={12} />
                    </div>
                    
                    {!isCompactHeader && (
                        <span className="font-bold text-zinc-200 truncate text-xs tracking-tight text-shadow-sm flex-1">
                            {track.name}
                        </span>
                    )}
                    
                    {/* Settings Cog (Visible on hover or compact) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenInspector(track.id);
                        }}
                        className={`p-1 rounded text-zinc-500 hover:text-white transition-opacity ${isCompactHeader ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                        <Settings2 size={12} />
                    </button>
                </div>

                {/* Controls Area */}
                {!isCompactHeader ? (
                    <>
                        {/* Volume/Pan Row */}
                        <div className="flex items-center gap-1.5 px-0.5 flex-1 min-h-0">
                            {/* Pan Knob (Tiny) */}
                            <div className="relative w-5 h-5 rounded-full bg-[#111] border border-zinc-700 shadow-inner flex items-center justify-center shrink-0">
                                <div 
                                    className="w-0.5 h-2 bg-zinc-400 rounded-full pointer-events-none transform origin-bottom"
                                    style={{ transform: `translateY(-25%) rotate(${track.pan * 45}deg)` }} 
                                />
                                <input 
                                    type="range" min={-1} max={1} step={0.01}
                                    value={track.pan}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        updateTrack(track.id, { pan: v });
                                        audio.setTrackPan(track.id, v);
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-ew-resize"
                                    title={`Pan: ${track.pan.toFixed(2)}`}
                                />
                            </div>

                            {/* Volume Slider */}
                            <div className="flex-1 relative h-5 flex items-center bg-[#151515] rounded border border-zinc-800/50 shadow-inner">
                                <div className="absolute left-0 top-0 bottom-0 bg-[#2c2c2c] opacity-50" style={{ width: `${track.volume * 100}%` }} />
                                {/* DB Ticks */}
                                <div className="absolute top-0 bottom-0 left-3/4 w-px bg-zinc-700/30" /> {/* 0dB approx */}
                                
                                <input 
                                    type="range" min={0} max={1} step={0.01}
                                    value={track.volume} 
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        updateTrack(track.id, { volume: v });
                                        audio.setTrackVolume(track.id, v);
                                    }}
                                    className="w-full h-full opacity-0 cursor-pointer absolute inset-0 z-10"
                                    title={`Volume: ${(track.volume * 100).toFixed(0)}%`}
                                />
                                {/* Fader Cap */}
                                <div 
                                    className="absolute h-full w-3 bg-gradient-to-b from-zinc-500 to-zinc-700 rounded-sm shadow-md border border-zinc-400/20 pointer-events-none" 
                                    style={{ left: `${track.volume * 100}%`, transform: 'translateX(-50%)' }} 
                                >
                                    <div className="w-px h-full bg-black/50 mx-auto" />
                                </div>
                            </div>
                        </div>

                        {/* Button Row */}
                        <div className="flex items-center gap-1 mt-auto h-5">
                            {/* Record Arm */}
                            <button 
                                className={`
                                    w-5 h-5 rounded-[2px] border flex items-center justify-center transition-all
                                    ${track.type === 'audio' ? 'hover:brightness-110 active:brightness-90' : 'opacity-50 cursor-default'}
                                    bg-[#251010] border-[#4a1a1a] text-red-600
                                `}
                                title="Record Arm (Coming Soon)"
                            >
                                <Disc size={8} fill="currentColor" />
                            </button>

                            {/* Input Monitor */}
                            {track.type === 'audio' && (
                                <button className="w-5 h-5 rounded-[2px] bg-[#251810] border border-[#4a2a1a] text-orange-600 flex items-center justify-center hover:brightness-110">
                                    <Mic size={8} />
                                </button>
                            )}

                            <div className="flex-1" />

                            {/* Mute */}
                            <button 
                                onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                                className={`
                                    w-5 h-5 rounded-[2px] font-bold text-[9px] border shadow-sm transition-all flex items-center justify-center
                                    ${track.muted 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_6px_rgba(37,99,235,0.4)]' 
                                        : 'bg-[#2a2a2a] border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-[#333]'}
                                `}
                                title="Mute"
                            >M</button>

                            {/* Solo */}
                            <button 
                                onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                                className={`
                                    w-5 h-5 rounded-[2px] font-bold text-[9px] border shadow-sm transition-all flex items-center justify-center
                                    ${track.solo 
                                        ? 'bg-yellow-500 border-yellow-400 text-black shadow-[0_0_6px_rgba(234,179,8,0.4)]' 
                                        : 'bg-[#2a2a2a] border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-[#333]'}
                                `}
                                title="Solo"
                            >S</button>
                            
                            {/* Mini Meter */}
                            <div className="h-full w-8 bg-black rounded-sm border border-zinc-800/50 p-px">
                                <LevelMeter trackId={track.id} vertical={false} />
                            </div>
                        </div>
                    </>
                ) : (
                    // Compact Mode (Vertical Stack)
                    <div className="flex flex-col items-center gap-1 mt-1">
                        <div className="flex gap-1">
                            <button 
                                onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                                className={`w-4 h-4 rounded text-[8px] font-bold border flex items-center justify-center ${track.muted ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                            >M</button>
                            <button 
                                onPointerDown={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                                className={`w-4 h-4 rounded text-[8px] font-bold border flex items-center justify-center ${track.solo ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                            >S</button>
                        </div>
                        {/* Tiny Volume Slider vertical? No space. Just meter */}
                        <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-zinc-800">
                             <div className="h-full bg-green-500" style={{ width: `${track.volume * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default TrackLane;
