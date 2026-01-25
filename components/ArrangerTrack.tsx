
import React, { memo } from 'react';
import { Track, Clip, ToolMode, AutomationPoint } from '../types';
import Waveform from './Waveform';
import MidiClipView from './MidiClipView';
import { MicOff, Repeat } from 'lucide-react';

interface ArrangerTrackProps {
    track: Track;
    clips: Clip[];
    trackHeight: number;
    zoom: number;
    selectedClipIds: string[];
    dragState: any; 
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
                const cx1 = x1 + (x2 - x1) * 0.5;
                const cy1 = y1;
                const cx2 = x1 + (x2 - x1) * 0.5;
                const cy2 = y2;
                d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
            } else {
                d += ` L ${x2} ${y2}`;
            }
        }
        return d;
    };

    return (
        <div 
            className={`absolute w-full border-b border-zinc-800/30 transition-all ${
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
                    const clipColor = clip.color || track.color || '#3b82f6';
                    
                    return (
                        <div 
                            key={clip.id}
                            className={`absolute top-[1px] bottom-[1px] cursor-move group ${isSelected ? 'z-10' : 'z-0'}`}
                            style={{ 
                                left: timeToPixels(clip.start), 
                                width: Math.max(2, timeToPixels(clip.duration)), 
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
                        >
                            {/* Region Container */}
                            <div 
                                className={`absolute inset-0 rounded-[4px] overflow-hidden transition-all border
                                    ${isSelected 
                                        ? 'border-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/20' 
                                        : 'border-black/30 shadow-sm hover:border-white/40'
                                    }
                                    ${clip.muted ? 'opacity-50' : ''}
                                `}
                                style={{ 
                                    backgroundColor: clipColor, // Base color
                                }}
                            >
                                {/* Gloss Gradient Overlay (Top shine) */}
                                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                
                                {/* Bottom Shadow Gradient */}
                                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                                {/* Waveform/MIDI Content */}
                                <div className="absolute inset-0 opacity-80 pointer-events-none mix-blend-multiply contrast-125">
                                    {clip.bufferKey ? (
                                        <Waveform 
                                            bufferKey={clip.bufferKey} 
                                            color="#111" // Dark waveform on colored background
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
                                            color="rgba(0,0,0,0.5)"
                                        />
                                    )}
                                </div>
                                
                                {/* Header Bar (Name) */}
                                <div className={`absolute top-0 left-0 right-0 h-3.5 px-1.5 flex items-center gap-1 pointer-events-none truncate z-10 ${isSelected ? 'text-white' : 'text-black/80'}`}>
                                    {clip.muted && <MicOff size={8} className="shrink-0" />}
                                    <span className="text-[9px] font-bold tracking-tight drop-shadow-md">{clip.name}</span>
                                    {isStretching && <span className="text-[8px] bg-black/50 text-white px-1 rounded">Stretch</span>}
                                </div>

                                {/* Loop Indicators (if looped visually - implied by repeating) */}
                                {/* Logic adds rounded corners to loops. Simplified here. */}
                            </div>

                            {/* Handles (Outside Clip visual) */}
                            {isSelected && !showAutomation && (
                                <>
                                    {/* Gain Line */}
                                    {clip.bufferKey && (
                                        <div className="absolute left-0 right-0 z-50 h-3 -mt-1.5 top-[50%] opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute left-0 right-0 h-px bg-white/60 pointer-events-none" style={{ top: `${(1 - Math.min(1, clipGain / 2)) * 100}%` }} />
                                            <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 rounded-full shadow-md cursor-ns-resize flex items-center justify-center border border-black/20"
                                                style={{ top: '50%', marginTop: '-8px' }}
                                                onPointerDown={(e) => onClipPointerDown(e, clip, 'GAIN')}
                                                title={`Gain: ${(clipGain*100).toFixed(0)}%`}
                                            >
                                                <div className="w-1.5 h-1.5 bg-black/80 rounded-full" />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Trim Handles */}
                                    <div className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize z-40 flex items-center justify-center group/trim -ml-1" onPointerDown={(e) => onClipPointerDown(e, clip, 'TRIM_START')}>
                                        <div className="w-1.5 h-full bg-white/0 group-hover/trim:bg-white/50 rounded-l-sm transition-colors" />
                                    </div>
                                    <div className={`absolute right-0 top-0 bottom-0 w-2.5 ${dragState?.mode === 'STRETCH' ? 'cursor-ew-resize' : 'cursor-ew-resize'} z-40 flex items-center justify-center group/trim -mr-1`} 
                                        onPointerDown={(e) => onClipPointerDown(e, clip, e.altKey ? 'STRETCH' : 'TRIM_END')}
                                    >
                                        <div className={`w-1.5 h-full transition-colors rounded-r-sm ${dragState?.mode === 'STRETCH' ? 'bg-orange-500' : 'bg-white/0 group-hover/trim:bg-white/50'}`} />
                                    </div>
                                    
                                    {/* Fade Handles (Top Corners) */}
                                    <div className="absolute top-0 left-0 w-4 h-4 cursor-ne-resize z-40 group/fade" onPointerDown={(e) => onClipPointerDown(e, clip, 'FADE_IN')}>
                                        <div className="absolute top-0 left-0 w-2.5 h-2.5 bg-white/20 border border-white/60 rounded-bl-sm group-hover/fade:bg-white/80" />
                                    </div>
                                    <div className="absolute top-0 right-0 w-4 h-4 cursor-nw-resize z-40 group/fade" onPointerDown={(e) => onClipPointerDown(e, clip, 'FADE_OUT')}>
                                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-white/20 border border-white/60 rounded-br-sm group-hover/fade:bg-white/80" />
                                    </div>
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
                            stroke="#fbbf24" 
                            strokeWidth="2"
                            strokeOpacity="0.9"
                            filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))"
                        />
                        {track.automation.volume.map(p => (
                            <circle 
                                key={p.id}
                                cx={timeToPixels(p.time)}
                                cy={trackHeight * (1 - p.value)}
                                r={4}
                                fill="#fbbf24"
                                stroke="#111"
                                strokeWidth="1.5"
                                className="hover:r-6 transition-all cursor-context-menu pointer-events-auto shadow-sm"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if(onOpenAutomationMenu) onOpenAutomationMenu(p.id, e.clientX, e.clientY);
                                }}
                            />
                        ))}
                    </svg>
                    <div className="absolute bottom-2 left-2 text-[10px] text-amber-400 font-bold bg-black/60 px-2 py-0.5 rounded-full pointer-events-none border border-amber-900/50 backdrop-blur-sm">
                        Volume Automation
                    </div>
                </div>
            )}
        </div>
    );
});

export default ArrangerTrack;
