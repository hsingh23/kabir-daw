
import React, { memo } from 'react';
import { Track, Clip, ToolMode, AutomationPoint } from '../types';
import Waveform from './Waveform';
import MidiClipView from './MidiClipView';
import { MicOff } from 'lucide-react';

interface ArrangerTrackProps {
    track: Track;
    clips: Clip[];
    trackHeight: number;
    zoom: number;
    selectedClipIds: string[];
    dragState: any; // Passed from interaction hook
    onDrop: (e: React.DragEvent, trackId: string) => void;
    onClipPointerDown: (e: React.PointerEvent, clip: Clip, mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT' | 'GAIN' | 'STRETCH') => void;
    onOpenClipInspector?: (clipId: string) => void;
    toolMode?: ToolMode;
    onAddAutomationPoint?: (trackId: string, time: number, value: number) => void;
    onOpenAutomationMenu?: (pointId: string, x: number, y: number) => void;
}

const ArrangerTrack: React.FC<ArrangerTrackProps> = memo(({
    track,
    clips,
    trackHeight,
    zoom,
    selectedClipIds,
    dragState,
    onDrop,
    onClipPointerDown,
    onOpenClipInspector,
    toolMode,
    onAddAutomationPoint,
    onOpenAutomationMenu
}) => {
    
    const timeToPixels = (t: number) => t * zoom;
    const isTrackMuted = track.muted;
    const showAutomation = toolMode === ToolMode.AUTOMATION;

    const handleAutomationClick = (e: React.PointerEvent) => {
        if (!showAutomation || !onAddAutomationPoint) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = x / zoom;
        const value = 1 - (y / trackHeight); // 0 at bottom, 1 at top
        onAddAutomationPoint(track.id, time, Math.max(0, Math.min(1, value)));
    };

    const renderAutomationPath = (points: AutomationPoint[]) => {
        if (points.length === 0) return '';
        
        const sorted = [...points].sort((a,b) => a.time - b.time);
        let d = `M ${timeToPixels(sorted[0].time)} ${trackHeight * (1 - sorted[0].value)}`;
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i];
            const p2 = sorted[i+1];
            const x1 = timeToPixels(p1.time);
            const y1 = trackHeight * (1 - p1.value);
            const x2 = timeToPixels(p2.time);
            const y2 = trackHeight * (1 - p2.value);
            
            if (p1.curve === 'step') {
                d += ` L ${x2} ${y1} L ${x2} ${y2}`;
            } else if (p1.curve === 'exponential') {
                // Approximate exponential curve using cubic bezier
                // Control points for a "swoop"
                const cx1 = x1 + (x2 - x1) * 0.5;
                const cy1 = y1; // Keep initial value longer
                const cx2 = x1 + (x2 - x1) * 0.5;
                const cy2 = y2;
                d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
            } else {
                // Linear
                d += ` L ${x2} ${y2}`;
            }
        }
        
        // Extend to end? No, just stop at last point for now.
        return d;
    };

    return (
        <div 
            className={`absolute w-full border-b border-zinc-800/50 transition-all ${
                isTrackMuted && !showAutomation ? 'opacity-50 grayscale' : ''
            }`} 
            style={{ height: trackHeight }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={(e) => onDrop(e, track.id)}
            onPointerDown={handleAutomationClick}
        >
            {/* Clips Layer */}
            <div className={`absolute inset-0 ${showAutomation ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                {clips.map(clip => {
                    const isSelected = selectedClipIds.includes(clip.id);
                    const clipGain = clip.gain ?? 1.0;
                    
                    const isStretching = dragState?.clipId === clip.id && dragState?.mode === 'STRETCH';
                    
                    return (
                        <div 
                            key={clip.id}
                            className={`absolute top-1 bottom-1 rounded-md overflow-hidden transition-all cursor-move group shadow-sm ${isSelected ? 'ring-2 ring-white z-10' : 'ring-1 ring-black/20 hover:ring-white/30'} ${clip.muted ? 'opacity-50 grayscale' : 'opacity-100'} ${isStretching ? 'bg-orange-600' : ''}`}
                            style={{ 
                                left: timeToPixels(clip.start), 
                                width: Math.max(2, timeToPixels(clip.duration)), 
                                backgroundColor: isStretching ? undefined : (clip.color || track.color || '#555'),
                                pointerEvents: showAutomation ? 'none' : 'auto'
                            }}
                            onPointerDown={(e) => {
                                const mode = e.altKey ? 'STRETCH' : 'MOVE';
                                onClipPointerDown(e, clip, mode);
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (onOpenClipInspector) onOpenClipInspector(clip.id);
                            }}
                            data-testid={`clip-${clip.name}`}
                        >
                            <div className="absolute inset-0 opacity-80 pointer-events-none bg-black/20">
                                {clip.bufferKey ? (
                                    <Waveform 
                                        bufferKey={clip.bufferKey} 
                                        color="rgba(255,255,255,0.8)" 
                                        offset={clip.offset}
                                        duration={clip.duration}
                                        fadeIn={clip.fadeIn}
                                        fadeOut={clip.fadeOut}
                                        gain={clipGain}
                                        speed={clip.speed}
                                    />
                                ) : (
                                    <MidiClipView 
                                        notes={clip.notes}
                                        duration={clip.duration}
                                        color="rgba(255,255,255,0.8)"
                                    />
                                )}
                            </div>
                            
                            <div className="absolute top-0 left-0 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-br-md pointer-events-none flex items-center gap-1 max-w-full">
                                {clip.muted && <MicOff size={8} className="text-red-400 shrink-0" />}
                                <span className="text-[9px] font-bold text-white shadow-black drop-shadow-md truncate block">{clip.name}</span>
                            </div>

                            {isSelected && !showAutomation && (
                                <>
                                    {/* Clip Handles */}
                                    {clip.bufferKey && (
                                        <>
                                            <div className="absolute left-0 right-0 h-px bg-white/50 pointer-events-none" style={{ top: `${Math.max(0, Math.min(100, (1 - (clipGain / 2.0)) * 100))}%` }} />
                                            <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white/80 rounded-full shadow-md cursor-ns-resize z-30 hover:scale-125 transition-transform flex items-center justify-center group/gain"
                                                style={{ top: `${Math.max(0, Math.min(100, (1 - (clipGain / 2.0)) * 100))}%`, marginTop: '-8px' }}
                                                onPointerDown={(e) => onClipPointerDown(e, clip, 'GAIN')}
                                                title="Clip Gain"
                                            >
                                                <div className="w-1.5 h-1.5 bg-black/50 rounded-full" />
                                            </div>
                                        </>
                                    )}
                                    <div className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20 flex items-center justify-center" onPointerDown={(e) => onClipPointerDown(e, clip, 'TRIM_START')}>
                                        <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                    </div>
                                    <div className={`absolute right-0 top-0 bottom-0 w-3 ${dragState?.mode === 'STRETCH' ? 'bg-orange-500/50' : 'bg-white/10 hover:bg-white/30'} cursor-ew-resize z-20 flex items-center justify-center`} 
                                        onPointerDown={(e) => onClipPointerDown(e, clip, e.altKey ? 'STRETCH' : 'TRIM_END')}
                                    >
                                        <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                    </div>
                                    <div className="absolute top-0 left-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-br cursor-ne-resize z-20" style={{ transform: `translateX(${timeToPixels(clip.fadeIn)}px)` }} onPointerDown={(e) => onClipPointerDown(e, clip, 'FADE_IN')} />
                                    <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-bl cursor-nw-resize z-20" style={{ transform: `translateX(-${timeToPixels(clip.fadeOut)}px)` }} onPointerDown={(e) => onClipPointerDown(e, clip, 'FADE_OUT')} />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Automation Layer */}
            {showAutomation && track.automation?.volume && track.automation.volume.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-20">
                    <svg className="w-full h-full overflow-visible">
                        <path 
                            d={renderAutomationPath(track.automation.volume)}
                            fill="none"
                            stroke="#fbbf24" // Amber-400
                            strokeWidth="2"
                            strokeOpacity="0.8"
                        />
                        {track.automation.volume.map(p => (
                            <circle 
                                key={p.id}
                                cx={timeToPixels(p.time)}
                                cy={trackHeight * (1 - p.value)}
                                r={4}
                                fill={p.curve === 'step' ? '#3b82f6' : '#fbbf24'} // Blue for step, Amber for others
                                stroke="#000"
                                strokeWidth="1"
                                className="hover:r-6 transition-all cursor-context-menu pointer-events-auto"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if(onOpenAutomationMenu) onOpenAutomationMenu(p.id, e.clientX, e.clientY);
                                }}
                            />
                        ))}
                    </svg>
                    <div className="absolute top-1 right-2 text-[9px] text-amber-400 font-bold bg-black/50 px-1 rounded pointer-events-none">
                        Volume Automation
                    </div>
                </div>
            )}
        </div>
    );
});

export default ArrangerTrack;