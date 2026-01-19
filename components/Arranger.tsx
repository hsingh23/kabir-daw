import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, ToolMode, Track } from '../types';
import Waveform from './Waveform';
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, GripVertical, Plus } from 'lucide-react';

interface ArrangerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onSplit: (clipId: string, time: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
}

const TRACK_HEIGHT = 96; // 6rem / h-24
const HEADER_WIDTH = 192; // 12rem / w-48 (md)

const Arranger: React.FC<ArrangerProps> = ({ 
    project, 
    setProject, 
    currentTime, 
    isPlaying, 
    onSeek, 
    onSplit,
    zoom,
    setZoom,
    selectedTrackId,
    onSelectTrack
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  
  // Interaction State
  // clipId: ID of clip being interacted with
  // mode: 'MOVE' | 'TRIM_START' | 'TRIM_END'
  // startX: Initial mouse X
  // startY: Initial mouse Y
  // original: Snapshot of clip state before drag
  const [dragState, setDragState] = useState<{
      clipId: string;
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END';
      startX: number;
      startY: number;
      original: Clip;
  } | null>(null);

  const [loopDrag, setLoopDrag] = useState<{ type: 'start' | 'end' | 'move', startX: number, originalLoopStart: number, originalLoopEnd: number } | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (isPlaying && scrollContainerRef.current) {
        const x = currentTime * zoom;
        const container = scrollContainerRef.current;
        if (x > container.scrollLeft + container.clientWidth * 0.8) {
            container.scrollLeft = x - container.clientWidth * 0.2;
        }
    }
  }, [currentTime, isPlaying, zoom]);

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setProject(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  // --- Calculations ---
  
  const getBufferDuration = (key: string) => {
      return audio.buffers.get(key)?.duration || 10;
  };

  // --- Handlers ---

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (loopDrag || dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
    const time = Math.max(0, x / zoom);
    onSeek(time);
  };

  const handleLoopMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    setLoopDrag({
      type,
      startX: e.clientX,
      originalLoopStart: project.loopStart,
      originalLoopEnd: project.loopEnd
    });
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip, mode: 'MOVE' | 'TRIM_START' | 'TRIM_END') => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    onSelectTrack(clip.trackId);

    // Tools logic overrides standard behavior
    if (tool === ToolMode.SPLIT && mode === 'MOVE') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left; 
        const splitTime = clip.start + (clickX / zoom);
        onSplit(clip.id, splitTime);
        return;
    }
    if (tool === ToolMode.ERASER) {
        setProject(prev => ({
            ...prev,
            clips: prev.clips.filter(c => c.id !== clip.id)
        }));
        return;
    }

    setDragState({
        clipId: clip.id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        original: { ...clip }
    });
  };

  const handleGlobalMove = (e: React.MouseEvent) => {
    if (dragState) {
        const deltaX = (e.clientX - dragState.startX) / zoom;
        const { original } = dragState;
        const bufferDuration = getBufferDuration(original.bufferKey);
        
        let updatedClip = { ...original };

        if (dragState.mode === 'MOVE') {
            // Horizontal Move
            let newStart = original.start + deltaX;
            // Snap
            const SNAP = 0.125; // 1/32th roughly at 120bpm
            if (!e.shiftKey) { // Shift disables snap
                newStart = Math.round(newStart / SNAP) * SNAP;
            }
            updatedClip.start = Math.max(0, newStart);

            // Vertical Move (Change Track)
            // We need to calculate offset relative to trackContainer
            if (trackContainerRef.current) {
                const rect = trackContainerRef.current.getBoundingClientRect();
                const relativeY = e.clientY - rect.top; // + scrollContainerRef.current.scrollTop if vertical scroll exists (not yet implemented)
                const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
                
                if (trackIndex >= 0 && trackIndex < project.tracks.length) {
                    updatedClip.trackId = project.tracks[trackIndex].id;
                }
            }
        } 
        else if (dragState.mode === 'TRIM_START') {
            // Dragging left edge:
            // Moving right (positive delta): start increases, duration decreases, offset increases
            // Moving left (negative delta): start decreases, duration increases, offset decreases
            
            // Limit delta so we don't go past start of file (offset) or end of clip (duration)
            // Constraint 1: offset + delta >= 0 -> delta >= -offset
            // Constraint 2: duration - delta >= 0.1 -> delta <= duration - 0.1
            
            const maxDelta = original.duration - 0.1;
            const minDelta = -original.offset;
            const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaX));

            updatedClip.start = original.start + clampedDelta;
            updatedClip.offset = original.offset + clampedDelta;
            updatedClip.duration = original.duration - clampedDelta;
        } 
        else if (dragState.mode === 'TRIM_END') {
            // Dragging right edge:
            // Moving right: duration increases
            // Moving left: duration decreases
            
            // Constraint: offset + newDuration <= bufferDuration
            // newDuration = original + delta
            // original + delta <= bufferDuration - offset -> delta <= bufferDuration - offset - original
            
            const maxDelta = bufferDuration - original.offset - original.duration;
            const minDelta = -(original.duration - 0.1);
            const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaX));

            updatedClip.duration = original.duration + clampedDelta;
        }

        setProject(prev => ({
            ...prev,
            clips: prev.clips.map(c => c.id === dragState.clipId ? updatedClip : c)
        }));
    } else if (loopDrag) {
        const deltaX = (e.clientX - loopDrag.startX) / zoom;
        const SNAP = 0.5;
        
        let newStart = loopDrag.originalLoopStart;
        let newEnd = loopDrag.originalLoopEnd;

        if (loopDrag.type === 'start') {
            newStart = Math.min(Math.max(0, newStart + deltaX), newEnd - SNAP);
        } else if (loopDrag.type === 'end') {
            newEnd = Math.max(newEnd + deltaX, newStart + SNAP);
        } else if (loopDrag.type === 'move') {
            const length = newEnd - newStart;
            newStart = Math.max(0, newStart + deltaX);
            newEnd = newStart + length;
        }
        
        newStart = Math.round(newStart / SNAP) * SNAP;
        newEnd = Math.round(newEnd / SNAP) * SNAP;

        setProject(prev => ({
            ...prev,
            loopStart: newStart,
            loopEnd: newEnd,
            isLooping: true
        }));
    }
  };

  const handleGlobalUp = () => {
    setDragState(null);
    setLoopDrag(null);
  };

  return (
    <div 
        className="flex flex-col h-full bg-studio-bg text-xs select-none"
        onMouseMove={handleGlobalMove}
        onMouseUp={handleGlobalUp}
        onMouseLeave={handleGlobalUp}
    >
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-700 bg-studio-panel flex items-center px-4 justify-between shrink-0">
         <div className="flex space-x-4">
            <div className="flex bg-zinc-800 rounded p-1 space-x-1">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded ${tool === ToolMode.POINTER ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><MousePointer size={16} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded ${tool === ToolMode.SPLIT ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><Scissors size={16} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded ${tool === ToolMode.ERASER ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><Trash2 size={16} /></button>
            </div>
            <div className="flex items-center space-x-2 bg-zinc-800 rounded p-1 px-2">
                <button onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} className={`${project.isLooping ? 'text-yellow-400' : 'text-zinc-500'}`}><Repeat size={16} /></button>
            </div>
            <div className="flex bg-zinc-800 rounded p-1 space-x-1">
                <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="p-1.5 rounded text-zinc-400 hover:text-white"><ZoomOut size={16} /></button>
                <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1.5 rounded text-zinc-400 hover:text-white"><ZoomIn size={16} /></button>
            </div>
         </div>
         <div className="text-zinc-500 font-mono">{currentTime.toFixed(2)}s</div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-36 md:w-48 bg-studio-panel border-r border-zinc-800 flex-shrink-0 z-20 shadow-xl overflow-hidden relative">
            <div className="h-8 border-b border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-500 font-medium">Tracks</div> 
            {project.tracks.map(track => (
                <div 
                    key={track.id} 
                    onClick={() => onSelectTrack(track.id)}
                    className={`border-b border-zinc-800 p-2 flex flex-col justify-center relative group cursor-pointer transition-colors ${selectedTrackId === track.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
                    style={{ height: TRACK_HEIGHT }}
                >
                    <div className={`font-bold truncate mb-1 ${selectedTrackId === track.id ? 'text-white' : 'text-zinc-400'}`}>{track.name}</div>
                    <div className="flex items-center justify-between mb-2 px-1">
                         <div className="flex space-x-1">
                             <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted })}} className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold border border-transparent ${track.muted ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>M</button>
                             <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo })}} className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold border border-transparent ${track.solo ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>S</button>
                         </div>
                    </div>
                    <div className="flex items-center space-x-2 px-1">
                        <input type="range" min="0" max="1" step="0.01" value={track.volume} onClick={(e) => e.stopPropagation()} onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedTrackId === track.id ? 'shadow-[0_0_8px_currentColor]' : ''}`} style={{ backgroundColor: track.color, color: track.color }}></div>
                </div>
            ))}
            <div className="absolute bottom-0 w-full p-2 bg-studio-panel">
                <button className="w-full py-2 text-zinc-500 hover:text-zinc-300 flex items-center justify-center space-x-1 border border-dashed border-zinc-700 rounded hover:bg-zinc-800/50" onClick={() => { /* add track */ }}>
                    <Plus size={14} /> <span>Add</span>
                </button>
            </div>
        </div>

        {/* Timeline Content */}
        <div 
            className="flex-1 overflow-x-auto overflow-y-auto relative no-scrollbar bg-zinc-900"
            ref={scrollContainerRef}
        >
             <div className="relative min-w-full" style={{ width: `${Math.max(2000, project.loopEnd * zoom + 1000)}px` }}>
                
                {/* Rulers Sticky Top */}
                <div className="sticky top-0 z-30 bg-zinc-900 shadow-sm">
                    {/* Loop Ruler */}
                    <div className="h-4 bg-zinc-950 border-b border-zinc-800 relative">
                        <div 
                            className={`absolute top-0 bottom-0 bg-yellow-400/20 border-l border-r border-yellow-400/50 ${project.isLooping ? 'opacity-100' : 'opacity-30'}`}
                            style={{ left: project.loopStart * zoom, width: Math.max(1, (project.loopEnd - project.loopStart) * zoom) }}
                        >
                            <div className="absolute inset-0 cursor-move hover:bg-yellow-400/10" onMouseDown={(e) => handleLoopMouseDown(e, 'move')} />
                            <div className="absolute left-0 top-0 bottom-0 w-4 -ml-2 cursor-ew-resize hover:bg-white/10" onMouseDown={(e) => handleLoopMouseDown(e, 'start')} />
                            <div className="absolute right-0 top-0 bottom-0 w-4 -mr-2 cursor-ew-resize hover:bg-white/10" onMouseDown={(e) => handleLoopMouseDown(e, 'end')} />
                        </div>
                    </div>
                    {/* Time Ruler */}
                    <div className="h-8 bg-zinc-800 border-b border-zinc-700 relative cursor-pointer" onClick={handleTimelineClick}>
                        {[...Array(100)].map((_, i) => (
                            <div key={i} className="absolute bottom-0 text-[10px] text-zinc-500 border-l border-zinc-600 pl-1 select-none" style={{ left: i * 5 * zoom }}>{i * 5}s</div>
                        ))}
                    </div>
                </div>

                {/* Tracks and Clips Area */}
                <div 
                    className="relative" 
                    ref={trackContainerRef}
                    style={{ height: project.tracks.length * TRACK_HEIGHT }}
                >
                    {/* Background Grid & Loop Region */}
                    <div className="absolute inset-0 z-0">
                         {project.isLooping && (
                            <div className="absolute top-0 bottom-0 bg-white/5 pointer-events-none" style={{ left: project.loopStart * zoom, width: (project.loopEnd - project.loopStart) * zoom }} />
                         )}
                         {/* Bar Lines */}
                         {[...Array(100)].map((_, i) => (
                            <div key={i} className="absolute top-0 bottom-0 border-r border-zinc-800/30" style={{ left: i * 1 * zoom }}></div>
                         ))}
                         {/* Track Dividers */}
                         {project.tracks.map((_, i) => (
                            <div key={i} className="absolute w-full border-b border-zinc-800/50" style={{ top: (i + 1) * TRACK_HEIGHT, height: 0 }}></div>
                         ))}
                    </div>

                    {/* Clips Layer */}
                    {project.clips.map(clip => {
                        const trackIndex = project.tracks.findIndex(t => t.id === clip.trackId);
                        if (trackIndex === -1) return null;
                        
                        const track = project.tracks[trackIndex];
                        const isDragging = dragState?.clipId === clip.id;
                        const bufferDuration = getBufferDuration(clip.bufferKey);
                        // Calculate waveform width: full buffer duration scaled by zoom
                        const waveformWidth = bufferDuration * zoom;
                        // Calculate left offset: shifts the waveform left to align with offset
                        const waveformLeft = -(clip.offset * zoom);

                        return (
                            <div
                                key={clip.id}
                                className={`absolute rounded-md overflow-hidden cursor-pointer group shadow-md border border-white/10 hover:border-white/30 transition-shadow ${isDragging ? 'z-50 opacity-90 ring-2 ring-white shadow-2xl' : 'z-10'}`}
                                style={{
                                    left: clip.start * zoom,
                                    width: clip.duration * zoom,
                                    top: trackIndex * TRACK_HEIGHT + 8, // +8 padding
                                    height: TRACK_HEIGHT - 16, // padding
                                    backgroundColor: track.color
                                }}
                                onMouseDown={(e) => handleClipMouseDown(e, clip, 'MOVE')}
                            >
                                {/* Header */}
                                <div className="absolute top-0 left-0 right-0 h-4 bg-black/20 text-[10px] px-2 text-white/90 truncate flex justify-between items-center select-none z-20">
                                    <span className="truncate mr-2 font-medium drop-shadow-md">{clip.name}</span>
                                    {tool === ToolMode.SPLIT && <Scissors size={10} className="text-white" />}
                                </div>
                                
                                {/* Waveform Container */}
                                <div className="absolute inset-0 top-4 z-10 overflow-hidden pointer-events-none">
                                    <div style={{ 
                                        width: waveformWidth, 
                                        height: '100%', 
                                        transform: `translateX(${waveformLeft}px)` 
                                    }}>
                                        <Waveform bufferKey={clip.bufferKey} color="rgba(255,255,255,0.9)" />
                                    </div>
                                </div>

                                {/* Trim Handles (Only visible on hover or drag) */}
                                <div 
                                    className="absolute left-0 top-0 bottom-0 w-3 bg-black/10 hover:bg-white/30 cursor-ew-resize z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => handleClipMouseDown(e, clip, 'TRIM_START')}
                                >
                                    <GripVertical size={12} className="text-white drop-shadow-md" />
                                </div>
                                <div 
                                    className="absolute right-0 top-0 bottom-0 w-3 bg-black/10 hover:bg-white/30 cursor-ew-resize z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => handleClipMouseDown(e, clip, 'TRIM_END')}
                                >
                                    <GripVertical size={12} className="text-white drop-shadow-md" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Playhead */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    style={{ left: currentTime * zoom, height: '100%' }}
                >
                    <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -translate-y-1.5 shadow-sm sticky top-7"></div>
                </div>

             </div>
        </div>
      </div>
    </div>
  );
};

export default Arranger;