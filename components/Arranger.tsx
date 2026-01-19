import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, ToolMode, Track } from '../types';
import Waveform from './Waveform';
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, GripVertical, Plus, Grid, Activity } from 'lucide-react';

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
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

const TRACK_HEIGHT = 96; // 6rem / h-24

// Snap values in BEATS
const SNAP_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: 'Bar', value: 4 },
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
];

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
    onSelectTrack,
    selectedClipId,
    onSelectClip
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeaderContainerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  const [snapGrid, setSnapGrid] = useState(1); // Default 1 beat (1/4 note)
  
  // Interaction State
  const [dragState, setDragState] = useState<{
      clipId: string;
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END';
      startX: number;
      startY: number;
      original: Clip;
  } | null>(null);

  const [loopDrag, setLoopDrag] = useState<{ type: 'start' | 'end' | 'move', startX: number, originalLoopStart: number, originalLoopEnd: number } | null>(null);

  // --- Musical Calculations ---
  const secondsPerBeat = 60 / project.bpm;
  // 4/4 Assumption for MVP
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  
  const pixelsPerBeat = zoom * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Calculate total width based on content
  const maxTime = Math.max(
      project.loopEnd + 10,
      ...project.clips.map(c => c.start + c.duration),
      (window.innerWidth / zoom) * 2
  );
  // Round up to nearest bar
  const totalBars = Math.ceil(maxTime / secondsPerBar) + 2;
  const totalWidth = totalBars * pixelsPerBar;

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

  // Sync scroll from timeline to track headers
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (trackHeaderContainerRef.current) {
          trackHeaderContainerRef.current.scrollTop = e.currentTarget.scrollTop;
      }
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setProject(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  // --- Handlers ---
  
  const getBufferDuration = (key: string) => {
      return audio.buffers.get(key)?.duration || 10;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (loopDrag || dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
    const time = Math.max(0, x / zoom);
    
    // Optional: Snap seek to grid? For now, keep it free or use shift to snap
    let seekTime = time;
    if (e.shiftKey && snapGrid > 0) {
        const snapSeconds = snapGrid * secondsPerBeat;
        seekTime = Math.round(time / snapSeconds) * snapSeconds;
    }

    onSeek(seekTime);
  };

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget || e.target === trackContainerRef.current) {
        onSelectClip(null);
      }
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
    e.preventDefault(); 
    onSelectTrack(clip.trackId);
    onSelectClip(clip.id);

    // Tools logic
    if (tool === ToolMode.SPLIT && mode === 'MOVE') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left; 
        const splitTime = clip.start + (clickX / zoom);
        // Snap split?
        onSplit(clip.id, splitTime);
        return;
    }
    if (tool === ToolMode.ERASER) {
        setProject(prev => ({
            ...prev,
            clips: prev.clips.filter(c => c.id !== clip.id)
        }));
        onSelectClip(null);
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
        const deltaX = (e.clientX - dragState.startX);
        const deltaSeconds = deltaX / zoom;
        const { original } = dragState;
        const bufferDuration = getBufferDuration(original.bufferKey);
        
        let updatedClip = { ...original };
        const activeSnapBeats = e.shiftKey ? 0 : snapGrid; 
        const activeSnapSeconds = activeSnapBeats * secondsPerBeat;

        if (dragState.mode === 'MOVE') {
            // Horizontal Move
            let newStart = original.start + deltaSeconds;
            // Snap
            if (activeSnapSeconds > 0) {
                newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
            }
            updatedClip.start = Math.max(0, newStart);

            // Vertical Move
            if (trackContainerRef.current) {
                const rect = trackContainerRef.current.getBoundingClientRect();
                const relativeY = e.clientY - rect.top; 
                const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
                
                if (trackIndex >= 0 && trackIndex < project.tracks.length) {
                    updatedClip.trackId = project.tracks[trackIndex].id;
                }
            }
        } 
        else if (dragState.mode === 'TRIM_START') {
            let newStart = original.start + deltaSeconds;
            if (activeSnapSeconds > 0) {
                newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
            }
            // Recalculate effective delta after snap
            const effectiveDelta = newStart - original.start;

            const maxDelta = original.duration - 0.1;
            const minDelta = -original.offset;
            const clampedDelta = Math.min(maxDelta, Math.max(minDelta, effectiveDelta));

            updatedClip.start = original.start + clampedDelta;
            updatedClip.offset = original.offset + clampedDelta;
            updatedClip.duration = original.duration - clampedDelta;
        } 
        else if (dragState.mode === 'TRIM_END') {
            let newEnd = original.start + original.duration + deltaSeconds;
            if (activeSnapSeconds > 0) {
                newEnd = Math.round(newEnd / activeSnapSeconds) * activeSnapSeconds;
            }
            const newDuration = newEnd - original.start;
            
            // Constrain
            const maxDuration = bufferDuration - original.offset;
            const minDuration = 0.1;
            
            updatedClip.duration = Math.min(maxDuration, Math.max(minDuration, newDuration));
        }

        setProject(prev => ({
            ...prev,
            clips: prev.clips.map(c => c.id === dragState.clipId ? updatedClip : c)
        }));
    } else if (loopDrag) {
        const deltaX = (e.clientX - loopDrag.startX);
        const deltaSeconds = deltaX / zoom;
        // Default loop snap to Bar (4 beats) if grid is off, otherwise use grid
        const snapBeats = snapGrid === 0 ? 4 : snapGrid;
        const activeSnapSeconds = snapBeats * secondsPerBeat;
        
        let newStart = loopDrag.originalLoopStart;
        let newEnd = loopDrag.originalLoopEnd;

        if (loopDrag.type === 'start') {
            newStart = Math.min(Math.max(0, newStart + deltaSeconds), newEnd - activeSnapSeconds);
        } else if (loopDrag.type === 'end') {
            newEnd = Math.max(newEnd + deltaSeconds, newStart + activeSnapSeconds);
        } else if (loopDrag.type === 'move') {
            const length = newEnd - newStart;
            newStart = Math.max(0, newStart + deltaSeconds);
            newEnd = newStart + length;
        }
        
        // Apply Snap
        newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
        newEnd = Math.round(newEnd / activeSnapSeconds) * activeSnapSeconds;

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
      <div className="h-12 border-b border-zinc-700 bg-studio-panel flex items-center px-4 justify-between shrink-0 z-30 space-x-4 overflow-x-auto no-scrollbar">
         <div className="flex space-x-3 items-center">
            {/* Tools */}
            <div className="flex bg-zinc-800 rounded p-1 space-x-1 shrink-0">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded ${tool === ToolMode.POINTER ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><MousePointer size={16} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded ${tool === ToolMode.SPLIT ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><Scissors size={16} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded ${tool === ToolMode.ERASER ? 'bg-studio-accent text-white' : 'text-zinc-400'}`}><Trash2 size={16} /></button>
            </div>
            
            <div className="w-px h-6 bg-zinc-700 shrink-0" />

            {/* Snap Control */}
            <div className="flex items-center space-x-2 bg-zinc-800 rounded px-2 h-8 shrink-0">
                <Grid size={14} className="text-zinc-400" />
                <select 
                    value={snapGrid} 
                    onChange={(e) => setSnapGrid(parseFloat(e.target.value))}
                    className="bg-transparent text-zinc-300 outline-none text-[10px] font-medium cursor-pointer w-14"
                >
                    {SNAP_OPTIONS.map(opt => (
                        <option key={opt.label} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div className="w-px h-6 bg-zinc-700 shrink-0" />

            {/* BPM Control */}
            <div className="flex items-center space-x-1 bg-zinc-800 rounded px-2 h-8 shrink-0">
                <Activity size={14} className="text-zinc-400" />
                <input 
                    type="number" 
                    value={project.bpm} 
                    onChange={(e) => setProject(p => ({...p, bpm: parseInt(e.target.value) || 120}))}
                    className="bg-transparent text-zinc-300 outline-none text-[10px] font-medium w-8 text-center"
                />
                <span className="text-[9px] text-zinc-500">BPM</span>
            </div>

            {/* Loop Toggle */}
            <button 
                onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} 
                className={`flex items-center justify-center w-8 h-8 rounded bg-zinc-800 shrink-0 ${project.isLooping ? 'text-yellow-400' : 'text-zinc-500'}`}
            >
                <Repeat size={16} />
            </button>
         </div>

         {/* Right Side Controls */}
         <div className="flex items-center space-x-3 shrink-0">
             <div className="text-zinc-400 font-mono flex items-center bg-black/40 px-2 py-1 rounded border border-zinc-700/50">
                 {/* Musical Time Display: Bars:Beats */}
                 <span className="text-white">{Math.floor(currentTime / secondsPerBar) + 1}</span>
                 <span className="text-zinc-600 mx-0.5">.</span>
                 <span className="text-white">{Math.floor((currentTime % secondsPerBar) / secondsPerBeat) + 1}</span>
                 <span className="text-zinc-600 mx-0.5">.</span>
                 <span className="text-zinc-500 text-[10px]">{Math.floor(((currentTime % secondsPerBeat) / secondsPerBeat) * 4) + 1}</span>
             </div>
             
             {/* Zoom */}
             <div className="flex bg-zinc-800 rounded p-1 space-x-1 h-8 items-center">
                <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="p-1.5 rounded text-zinc-400 hover:text-white"><ZoomOut size={16} /></button>
                <button onClick={() => setZoom(Math.min(300, zoom + 10))} className="p-1.5 rounded text-zinc-400 hover:text-white"><ZoomIn size={16} /></button>
             </div>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (Scrolls programmatically) */}
        <div 
            className="w-36 md:w-48 bg-studio-panel border-r border-zinc-800 flex-shrink-0 z-20 shadow-xl overflow-hidden relative"
            ref={trackHeaderContainerRef}
        >
            <div className="h-8 border-b border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-500 font-medium sticky top-0 z-30 text-[10px] uppercase tracking-wider">Tracks</div> 
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
            <div className="w-full p-2 bg-studio-panel">
                <button className="w-full py-2 text-zinc-500 hover:text-zinc-300 flex items-center justify-center space-x-1 border border-dashed border-zinc-700 rounded hover:bg-zinc-800/50" onClick={() => { /* add track */ }}>
                    <Plus size={14} /> <span>Add</span>
                </button>
            </div>
            {/* Spacer */}
            <div className="h-48"></div>
        </div>

        {/* Timeline Content */}
        <div 
            className="flex-1 overflow-x-auto overflow-y-auto relative no-scrollbar bg-zinc-900"
            ref={scrollContainerRef}
            onScroll={handleScroll}
            onMouseDown={handleBackgroundMouseDown}
        >
             <div className="relative min-w-full" style={{ width: totalWidth }}>
                
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
                    {/* Musical Time Ruler */}
                    <div className="h-8 bg-zinc-800 border-b border-zinc-700 relative cursor-pointer overflow-hidden" onClick={handleTimelineClick}>
                        {[...Array(totalBars)].map((_, i) => (
                            <div key={i} className="absolute bottom-0 text-[10px] text-zinc-500 border-l border-zinc-600 pl-1 select-none h-4" style={{ left: i * pixelsPerBar }}>
                                {i + 1}
                            </div>
                        ))}
                        {/* Sub-divisions for first few bars or if zoomed in */}
                        {pixelsPerBeat > 20 && [...Array(totalBars * 4)].map((_, i) => {
                             if (i % 4 === 0) return null; // Already drawn by Bar
                             return (
                                <div key={i} className="absolute bottom-0 border-l border-zinc-700 h-2" style={{ left: i * pixelsPerBeat }} />
                             )
                        })}
                    </div>
                </div>

                {/* Tracks and Clips Area */}
                <div 
                    className="relative" 
                    ref={trackContainerRef}
                    style={{ height: project.tracks.length * TRACK_HEIGHT + 200 }} // Extra space at bottom
                >
                    {/* Background Grid & Loop Region */}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                         {project.isLooping && (
                            <div className="absolute top-0 bottom-0 bg-white/5" style={{ left: project.loopStart * zoom, width: (project.loopEnd - project.loopStart) * zoom }} />
                         )}
                         
                         {/* Bar Lines (Strong) */}
                         {[...Array(totalBars)].map((_, i) => (
                            <div key={`bar-${i}`} className="absolute top-0 bottom-0 border-r border-zinc-700/50" style={{ left: i * pixelsPerBar }}></div>
                         ))}
                         
                         {/* Beat Lines (Weak) - Only draw if not too dense */}
                         {pixelsPerBeat > 15 && [...Array(totalBars * 4)].map((_, i) => (
                            i % 4 !== 0 && (
                                <div key={`beat-${i}`} className="absolute top-0 bottom-0 border-r border-zinc-800/30" style={{ left: i * pixelsPerBeat }}></div>
                            )
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
                        const isSelected = selectedClipId === clip.id;
                        const bufferDuration = getBufferDuration(clip.bufferKey);
                        const waveformWidth = bufferDuration * zoom;
                        const waveformLeft = -(clip.offset * zoom);

                        return (
                            <div
                                key={clip.id}
                                className={`absolute rounded-md overflow-hidden cursor-pointer group transition-shadow ${
                                    isDragging ? 'z-50 opacity-90 shadow-2xl' : 'z-10 shadow-md'
                                } ${
                                    isSelected ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-zinc-900' : 'border border-white/10 hover:border-white/30'
                                }`}
                                style={{
                                    left: clip.start * zoom,
                                    width: clip.duration * zoom,
                                    top: trackIndex * TRACK_HEIGHT + 8, 
                                    height: TRACK_HEIGHT - 16,
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

                                {/* Trim Handles */}
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