import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, ToolMode, Track } from '../types';
import Waveform from './Waveform';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Activity, Mic, Music, Drum, Guitar, Keyboard, Sliders, Copy, Play, Pause, Square, Circle, Zap, GripVertical, Edit2 } from 'lucide-react';

interface ArrangerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  recordingStartTime?: number;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onSeek: (time: number) => void;
  onSplit: (clipId: string, time: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onOpenInspector: (trackId: string) => void;
  onMoveTrack?: (from: number, to: number) => void;
  onRenameClip?: (clipId: string, name: string) => void;
  onRenameTrack?: (trackId: string, name: string) => void;
}

const TRACK_HEIGHT = 120; 

const SNAP_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: 'Bar', value: 4 },
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
];

const TrackIcon = ({ name, color }: { name: string, color: string }) => {
    const n = name.toLowerCase();
    if (n.includes('drum') || n.includes('beat')) return <Drum size={16} style={{ color }} />;
    if (n.includes('bass') || n.includes('guitar')) return <Guitar size={16} style={{ color }} />;
    if (n.includes('synth') || n.includes('piano') || n.includes('key')) return <Keyboard size={16} style={{ color }} />;
    if (n.includes('voc') || n.includes('mic')) return <Mic size={16} style={{ color }} />;
    return <Music size={16} style={{ color }} />;
};

const Arranger: React.FC<ArrangerProps> = ({ 
    project, 
    setProject, 
    currentTime, 
    isPlaying,
    isRecording,
    recordingStartTime = 0,
    onPlayPause,
    onStop,
    onRecord, 
    onSeek, 
    onSplit,
    zoom,
    setZoom,
    selectedTrackId,
    onSelectTrack,
    selectedClipId,
    onSelectClip,
    onOpenInspector,
    onMoveTrack,
    onRenameClip,
    onRenameTrack
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  const [snapGrid, setSnapGrid] = useState(1); 
  
  // Responsive Header Logic
  const [headerWidth, setHeaderWidth] = useState(160);
  useEffect(() => {
    const handleResize = () => setHeaderWidth(window.innerWidth < 768 ? 110 : 160);
    handleResize(); // Init
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Interaction State
  const [dragState, setDragState] = useState<{
      clipId: string;
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT';
      startX: number;
      startY: number;
      original: Clip;
      pointerId: number;
  } | null>(null);

  const [loopDrag, setLoopDrag] = useState<{ type: 'start' | 'end' | 'move', startX: number, originalLoopStart: number, originalLoopEnd: number, pointerId: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<{ active: boolean, pointerId: number | null }>({ active: false, pointerId: null });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);

  // Track Dragging State
  const [trackDrag, setTrackDrag] = useState<{ id: string, startY: number, currentIndex: number, pointerId: number } | null>(null);

  // Pinch Zoom State
  const [pinchDist, setPinchDist] = useState<number | null>(null);

  // --- Musical Calculations ---
  const secondsPerBeat = 60 / project.bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  
  const pixelsPerBeat = zoom * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Render more space if recording to allow infinite scrolling feel
  const maxTime = Math.max(
      project.loopEnd + 10,
      ...project.clips.map(c => c.start + c.duration),
      isRecording ? currentTime + 20 : 0, 
      (window.innerWidth / zoom) * 2
  );
  const totalBars = Math.ceil(maxTime / secondsPerBar) + 2;
  const totalWidth = totalBars * pixelsPerBar;

  // Grid Visualization Logic
  const showBeats = pixelsPerBeat > 15;
  const gridImage = showBeats 
        ? `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
           linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`
        : `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)`;
  const gridSize = showBeats
        ? `${pixelsPerBar}px 100%, ${pixelsPerBeat}px 100%`
        : `${pixelsPerBar}px 100%`;

  // Auto-scroll during playback
  useEffect(() => {
    if ((isPlaying || isRecording) && scrollContainerRef.current) {
        const playheadX = (currentTime * zoom) + headerWidth;
        const container = scrollContainerRef.current;
        const threshold = isRecording ? 0.8 : 0.9;
        
        if (playheadX > container.scrollLeft + container.clientWidth * threshold) {
            container.scrollLeft = playheadX - headerWidth - (container.clientWidth * 0.1);
        }
    }
  }, [currentTime, isPlaying, isRecording, zoom, headerWidth]);

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setProject(prev => ({
        ...prev,
        tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const calculateSeekTime = (clientX: number, snap: boolean) => {
    const rect = scrollContainerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    const contentX = clientX - rect.left + scrollLeft;
    const timelineX = contentX - headerWidth;
    const time = Math.max(0, timelineX / zoom);
    
    if (snap && snapGrid > 0) {
        const snapSeconds = snapGrid * secondsPerBeat;
        return Math.round(time / snapSeconds) * snapSeconds;
    }
    return time;
  };

  // --- Pointer Events for Ruler ---
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsScrubbing({ active: true, pointerId: e.pointerId });
    onSeek(calculateSeekTime(e.clientX, e.shiftKey));
  };

  // --- Pointer Events for Loop ---
  const handleLoopPointerDown = (e: React.PointerEvent, type: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setLoopDrag({
      type,
      startX: e.clientX,
      originalLoopStart: project.loopStart,
      originalLoopEnd: project.loopEnd,
      pointerId: e.pointerId
    });
  };

  // --- Pointer Events for Track Dragging ---
  const handleTrackDragStart = (e: React.PointerEvent, trackId: string, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setTrackDrag({
        id: trackId,
        startY: e.clientY,
        currentIndex: index,
        pointerId: e.pointerId
    });
  };

  // --- Pointer Events for Clips ---
  const handleClipPointerDown = (e: React.PointerEvent, clip: Clip, mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT') => {
    e.stopPropagation();
    
    if (e.button === 2) {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
        return;
    }

    if (e.pointerType === 'touch') {
        isLongPressRef.current = false;
        longPressTimerRef.current = window.setTimeout(() => {
            isLongPressRef.current = true;
            setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
            setDragState(null);
        }, 600);
    }

    onSelectTrack(clip.trackId);
    onSelectClip(clip.id);
    setContextMenu(null);

    if (tool === ToolMode.SPLIT && mode === 'MOVE') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left; 
        const splitTime = clip.start + (clickX / zoom);
        onSplit(clip.id, splitTime);
        return;
    }
    if (tool === ToolMode.ERASER) {
        setProject(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== clip.id) }));
        onSelectClip(null);
        return;
    }

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragState({
        clipId: clip.id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        original: { ...clip },
        pointerId: e.pointerId
    });
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (longPressTimerRef.current && Math.abs(e.movementX) + Math.abs(e.movementY) > 5) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }

    if (isScrubbing.active && isScrubbing.pointerId === e.pointerId) {
        onSeek(calculateSeekTime(e.clientX, e.shiftKey));
        return;
    }

    if (trackDrag && trackDrag.pointerId === e.pointerId && onMoveTrack) {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;
        const rect = scrollContainer.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;
        const relativeY = (e.clientY - rect.top) + scrollTop - 32;
        const newIndex = Math.max(0, Math.min(project.tracks.length - 1, Math.floor(relativeY / TRACK_HEIGHT)));
        
        if (newIndex !== trackDrag.currentIndex) {
            onMoveTrack(trackDrag.currentIndex, newIndex);
            setTrackDrag(prev => prev ? ({ ...prev, currentIndex: newIndex }) : null);
        }
        return;
    }

    if (isLongPressRef.current) return;

    if (dragState && dragState.pointerId === e.pointerId) {
        const deltaX = (e.clientX - dragState.startX);
        const deltaSeconds = deltaX / zoom;
        const { original } = dragState;
        
        let updatedClip = { ...original };
        const activeSnapBeats = e.shiftKey ? 0 : snapGrid; 
        const activeSnapSeconds = activeSnapBeats * secondsPerBeat;

        if (dragState.mode === 'MOVE') {
            let newStart = original.start + deltaSeconds;
            if (activeSnapSeconds > 0) newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
            updatedClip.start = Math.max(0, newStart);

            if (scrollContainerRef.current) {
                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                const scrollTop = scrollContainerRef.current.scrollTop;
                const relativeY = (e.clientY - containerRect.top) + scrollTop - 32; 
                
                const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
                if (trackIndex >= 0 && trackIndex < project.tracks.length) {
                    updatedClip.trackId = project.tracks[trackIndex].id;
                }
            }
        } 
        else if (dragState.mode === 'TRIM_START') {
            let newStart = original.start + deltaSeconds;
            if (activeSnapSeconds > 0) newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
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
            if (activeSnapSeconds > 0) newEnd = Math.round(newEnd / activeSnapSeconds) * activeSnapSeconds;
            const newDuration = newEnd - original.start;
            updatedClip.duration = Math.max(0.1, newDuration);
        }
        else if (dragState.mode === 'FADE_IN') {
             updatedClip.fadeIn = Math.max(0, Math.min(original.duration - original.fadeOut, original.fadeIn + deltaSeconds));
        }
        else if (dragState.mode === 'FADE_OUT') {
             updatedClip.fadeOut = Math.max(0, Math.min(original.duration - original.fadeIn, original.fadeOut - deltaSeconds));
        }

        setProject(prev => ({
            ...prev,
            clips: prev.clips.map(c => c.id === dragState.clipId ? updatedClip : c)
        }));
    } 
    
    if (loopDrag && loopDrag.pointerId === e.pointerId) {
        const deltaX = (e.clientX - loopDrag.startX);
        const deltaSeconds = deltaX / zoom;
        const snapBeats = e.shiftKey ? 0 : snapGrid; 
        const activeSnapSeconds = snapBeats * secondsPerBeat;
        
        let newStart = loopDrag.originalLoopStart;
        let newEnd = loopDrag.originalLoopEnd;

        if (loopDrag.type === 'start') {
            newStart = Math.min(Math.max(0, newStart + deltaSeconds), newEnd - (activeSnapSeconds || 0.1));
        } else if (loopDrag.type === 'end') {
            newEnd = Math.max(newEnd + deltaSeconds, newStart + (activeSnapSeconds || 0.1));
        } else if (loopDrag.type === 'move') {
            const length = newEnd - newStart;
            newStart = Math.max(0, newStart + deltaSeconds);
            newEnd = newStart + length;
        }
        
        if (activeSnapSeconds > 0) {
            newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
            newEnd = Math.round(newEnd / activeSnapSeconds) * activeSnapSeconds;
        }

        setProject(prev => ({
            ...prev,
            loopStart: newStart,
            loopEnd: newEnd,
            isLooping: true
        }));
    }
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }

    if (dragState && dragState.pointerId === e.pointerId) {
        setDragState(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
    if (loopDrag && loopDrag.pointerId === e.pointerId) {
        setLoopDrag(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
    if (trackDrag && trackDrag.pointerId === e.pointerId) {
        setTrackDrag(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
    if (isScrubbing.active && isScrubbing.pointerId === e.pointerId) {
        setIsScrubbing({ active: false, pointerId: null });
        (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          
          if (pinchDist !== null) {
              const delta = dist - pinchDist;
              const zoomFactor = delta * 0.5;
              setZoom(Math.max(10, Math.min(400, zoom + zoomFactor)));
          }
          setPinchDist(dist);
      }
  };

  const onTouchEnd = () => {
    setPinchDist(null);
  };

  const handleRename = () => {
      if (contextMenu && onRenameClip) {
          const clip = project.clips.find(c => c.id === contextMenu.clipId);
          if (clip) {
              const name = prompt("Rename clip:", clip.name);
              if (name) onRenameClip(clip.id, name);
          }
          setContextMenu(null);
      }
  };

  const handleDelete = () => {
      if (contextMenu) {
          setProject(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== contextMenu.clipId) }));
          setContextMenu(null);
      }
  };

  const handleDuplicate = () => {
      if (contextMenu) {
        const clip = project.clips.find(c => c.id === contextMenu.clipId);
        if (clip) {
            const newClip = { ...clip, id: crypto.randomUUID(), start: clip.start + clip.duration, name: `${clip.name} copy` };
            setProject(prev => ({ ...prev, clips: [...prev.clips, newClip] }));
        }
        setContextMenu(null);
      }
  };

  const handleTrackNameDoubleClick = (e: React.MouseEvent, trackId: string, currentName: string) => {
    e.stopPropagation();
    if (onRenameTrack) {
        const newName = prompt("Rename track:", currentName);
        if (newName) {
            onRenameTrack(trackId, newName);
        }
    }
  };

  return (
    <div 
        role="application"
        className="flex flex-col h-full bg-studio-bg text-xs select-none"
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      {/* Toolbar */}
      <div className="h-12 border-b border-zinc-800 bg-studio-panel flex items-center px-4 justify-between shrink-0 z-30 space-x-4 overflow-x-auto no-scrollbar shadow-lg">
         <div className="flex space-x-3 items-center">
            <div className="flex bg-zinc-900 rounded-lg p-1 space-x-1 shrink-0 border border-zinc-800">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded-md transition-all ${tool === ToolMode.POINTER ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><MousePointer size={16} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded-md transition-all ${tool === ToolMode.SPLIT ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Scissors size={16} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded-md transition-all ${tool === ToolMode.ERASER ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Trash2 size={16} /></button>
            </div>
            
            <div className="w-px h-6 bg-zinc-800 shrink-0" />

            <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg px-2 h-8 shrink-0 border border-zinc-800">
                <button 
                    onClick={() => setProject(p => ({...p, metronomeOn: !p.metronomeOn}))} 
                    className={`p-1 rounded transition-colors ${project.metronomeOn ? 'text-studio-accent' : 'text-zinc-500'}`}
                >
                    <Zap size={14} fill={project.metronomeOn ? "currentColor" : "none"} />
                </button>
                <div className="w-px h-4 bg-zinc-800" />
                <Grid size={14} className="text-zinc-500" />
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

            <div className="flex items-center space-x-1 bg-zinc-900 rounded-lg px-2 h-8 shrink-0 border border-zinc-800">
                <Activity size={14} className="text-zinc-500" />
                <input 
                    type="number" 
                    value={project.bpm} 
                    onChange={(e) => setProject(p => ({...p, bpm: parseInt(e.target.value, 10) || 120}))}
                    className="bg-transparent text-zinc-300 outline-none text-[10px] font-medium w-8 text-center"
                />
            </div>
         </div>

         <div className="flex items-center space-x-3 shrink-0">
             <div className="flex items-center space-x-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                 <button onClick={() => setZoom(Math.max(10, zoom * 0.8))} className="p-1 text-zinc-400 hover:text-white"><ZoomOut size={14} /></button>
                 <button onClick={() => setZoom(Math.min(400, zoom * 1.2))} className="p-1 text-zinc-400 hover:text-white"><ZoomIn size={14} /></button>
             </div>

             <div className="text-zinc-400 font-mono flex items-center bg-black/40 px-3 py-1.5 rounded-md border border-zinc-800/50 shadow-inner">
                 <span className="text-white font-bold">{Math.floor(currentTime / secondsPerBar) + 1}</span>
                 <span className="text-zinc-600 mx-1">.</span>
                 <span className="text-white">{Math.floor((currentTime % secondsPerBar) / secondsPerBeat) + 1}</span>
             </div>
             <button onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} className={`p-1.5 rounded-md transition-all ${project.isLooping ? 'text-yellow-400 bg-yellow-400/10' : 'text-zinc-500'}`}>
                <Repeat size={16} />
            </button>
         </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-zinc-900 relative overscroll-contain"
        style={{ touchAction: 'pan-x pan-y' }} 
      >
        <div className="min-w-max relative flex flex-col" style={{ width: totalWidth + headerWidth }}>
           
            {/* 1. Sticky Top Ruler */}
            <div className="sticky top-0 z-40 flex h-8 bg-zinc-900 border-b border-zinc-800 shadow-sm">
                <div 
                    className="sticky left-0 z-50 bg-studio-panel border-r border-zinc-800 shrink-0 flex items-center justify-center border-b border-zinc-800 shadow-md" 
                    style={{ width: headerWidth }}
                >
                    <span className="text-[10px] font-bold text-zinc-600 tracking-widest">TRACKS</span>
                </div>

                <div 
                    className="relative flex-1 bg-zinc-900 cursor-pointer touch-none group"
                    onPointerDown={handleRulerPointerDown}
                >
                     <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: 0, right: 0 }}>
                        <div 
                            className={`absolute top-0 h-full bg-yellow-400/10 border-l border-r border-yellow-400/40 ${project.isLooping ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                            style={{ left: project.loopStart * zoom, width: Math.max(1, (project.loopEnd - project.loopStart) * zoom) }}
                        >
                             <div className="absolute inset-0 cursor-grab active:cursor-grabbing" onPointerDown={(e) => handleLoopPointerDown(e, 'move')} />
                             <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400/50" onPointerDown={(e) => handleLoopPointerDown(e, 'start')} />
                             <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-400/50" onPointerDown={(e) => handleLoopPointerDown(e, 'end')} />
                        </div>
                     </div>

                     {[...Array(totalBars)].map((_, i) => (
                        <div key={i} className="absolute bottom-0 text-[10px] text-zinc-500 border-l border-zinc-700 pl-1 select-none h-4 flex items-end pb-0.5 font-medium" style={{ left: i * pixelsPerBar }}>
                            {i + 1}
                        </div>
                     ))}
                     
                     {/* Playhead Cap (In Ruler) */}
                     <div 
                        className="absolute top-0 h-full z-50 pointer-events-none flex flex-col items-center justify-end pb-1"
                        style={{ left: currentTime * zoom, transform: 'translateX(-50%)' }}
                     >
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 drop-shadow-md" />
                     </div>
                </div>
            </div>

            {/* 2. Tracks Container */}
            <div className="relative">
                <div 
                    className="absolute inset-0 z-0 pointer-events-none" 
                    style={{
                        left: headerWidth,
                        backgroundImage: gridImage,
                        backgroundSize: gridSize
                    }} 
                />

                {project.tracks.map((track, index) => (
                    <div key={track.id} className="flex relative z-10 group" style={{ height: TRACK_HEIGHT }}>
                        
                        {/* Sticky Track Header */}
                        <div 
                            role="button"
                            tabIndex={0}
                            className={`sticky left-0 z-30 bg-studio-panel border-r border-zinc-800 border-b border-zinc-800/50 shrink-0 flex flex-col p-2 relative transition-colors ${selectedTrackId === track.id ? 'bg-zinc-800' : ''}`}
                            style={{ width: headerWidth }}
                            onClick={() => onSelectTrack(track.id)}
                            onDoubleClick={() => onOpenInspector(track.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    onSelectTrack(track.id);
                                }
                            }}
                        >
                             <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2 overflow-hidden">
                                    {/* Drag Handle */}
                                    <div 
                                        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 p-0.5"
                                        onPointerDown={(e) => handleTrackDragStart(e, track.id, index)}
                                    >
                                        <GripVertical size={12} />
                                    </div>

                                    <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center shadow-inner shrink-0" style={{ color: track.color }}>
                                        <TrackIcon name={track.name} color={track.color} />
                                    </div>
                                    <span 
                                        className={`font-bold text-xs truncate cursor-text ${selectedTrackId === track.id ? 'text-white' : 'text-zinc-400'}`}
                                        onDoubleClick={(e) => handleTrackNameDoubleClick(e, track.id, track.name)}
                                    >
                                        {track.name}
                                    </span>
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); onOpenInspector(track.id)}} className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 md:block hidden">
                                    <Sliders size={12} />
                                </button>
                             </div>
                             
                             <div className="flex space-x-1 mt-auto">
                                 <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted })}} className={`flex-1 h-6 rounded text-[10px] font-bold border border-black/20 ${track.muted ? 'bg-red-500 text-white shadow-red-500/20 shadow-lg' : 'bg-zinc-700 text-zinc-400'}`}>M</button>
                                 <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo })}} className={`flex-1 h-6 rounded text-[10px] font-bold border border-black/20 ${track.solo ? 'bg-yellow-400 text-black shadow-yellow-400/20 shadow-lg' : 'bg-zinc-700 text-zinc-400'}`}>S</button>
                             </div>
                             
                             {headerWidth > 120 && (
                                <div className="mt-2 flex items-center space-x-2">
                                    <input 
                                        type="range" min="0" max="1" step="0.01" 
                                        value={track.volume} 
                                        onClick={(e) => e.stopPropagation()} 
                                        onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })} 
                                        className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-zinc-500" 
                                    />
                                </div>
                             )}

                             <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color }} />
                        </div>

                        {/* Track Lane */}
                        <div className="relative flex-1 border-b border-zinc-800/30 bg-zinc-900/20">
                            {isRecording && selectedTrackId === track.id && (
                                <div 
                                    className="absolute rounded-lg overflow-hidden z-20 shadow-xl opacity-80 border-2 border-red-500 bg-red-900/40"
                                    style={{
                                        left: recordingStartTime * zoom,
                                        width: Math.max(10, (currentTime - recordingStartTime) * zoom),
                                        top: 4,
                                        bottom: 4,
                                    }}
                                >
                                     <div className="absolute top-2 left-2 flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-red-200">Recording...</span>
                                     </div>
                                </div>
                            )}

                            {project.clips.filter(c => c.trackId === track.id).map(clip => {
                                const isSelected = selectedClipId === clip.id;
                                return (
                                    <div
                                        key={clip.id}
                                        className={`absolute rounded-lg overflow-hidden cursor-pointer select-none touch-none transition-shadow ${
                                            isSelected ? 'ring-2 ring-white z-20 shadow-xl' : 'hover:brightness-110 z-10 shadow-md'
                                        }`}
                                        style={{
                                            left: clip.start * zoom,
                                            width: clip.duration * zoom,
                                            top: 4,
                                            bottom: 4,
                                            backgroundColor: '#18181b',
                                            borderLeft: `4px solid ${track.color}`
                                        }}
                                        onPointerDown={(e) => handleClipPointerDown(e, clip, 'MOVE')}
                                    >
                                        <div 
                                            className="h-5 px-2 flex items-center justify-between text-[10px] font-bold text-white/90 truncate"
                                            style={{ backgroundColor: track.color }}
                                        >
                                            <span className="truncate">{clip.name}</span>
                                        </div>

                                        <div className="absolute inset-0 top-5 bottom-0 bg-black/40 pointer-events-none">
                                            <Waveform bufferKey={clip.bufferKey} color={track.color} />
                                        </div>
                                        
                                        <svg className="absolute inset-0 pointer-events-none z-20 opacity-50" width="100%" height="100%" preserveAspectRatio="none">
                                            <title>Clip Fades</title>
                                            {clip.fadeIn > 0 && <path d={`M 0 100 L ${clip.fadeIn * zoom} 0 L 0 0 Z`} fill="black" />}
                                            {clip.fadeOut > 0 && <path d={`M ${clip.duration * zoom} 100 L ${(clip.duration - clip.fadeOut) * zoom} 0 L ${clip.duration * zoom} 0 Z`} fill="black" />}
                                        </svg>

                                        <div className={`absolute inset-y-0 left-0 w-6 -ml-3 cursor-w-resize z-30 hover:bg-white/5 ${isSelected ? 'block' : 'hidden group-hover:block'}`} onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_START')} />
                                        <div className={`absolute inset-y-0 right-0 w-6 -mr-3 cursor-e-resize z-30 hover:bg-white/5 ${isSelected ? 'block' : 'hidden group-hover:block'}`} onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_END')} />
                                        
                                        <div className={`absolute top-0 w-4 h-4 -ml-2 bg-white border border-black rounded-full cursor-ew-resize z-40 shadow-sm ${isSelected ? 'opacity-100' : 'opacity-0'}`} style={{ left: clip.fadeIn * zoom }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_IN')} />
                                        <div className={`absolute top-0 w-4 h-4 -mr-2 bg-white border border-black rounded-full cursor-ew-resize z-40 shadow-sm ${isSelected ? 'opacity-100' : 'opacity-0'}`} style={{ right: clip.fadeOut * zoom }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_OUT')} />

                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
                
                {/* Playhead Line (No Head, follows scroll) */}
                <div 
                    className="absolute top-0 bottom-0 z-30 w-px bg-red-500 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                    style={{ left: headerWidth + (currentTime * zoom) }}
                >
                     {/* Simplified to just line */}
                </div>
            </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-6 bg-zinc-900/90 backdrop-blur-xl px-8 py-3 rounded-2xl border border-zinc-700/50 shadow-2xl">
            <button onClick={onStop} className="group">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-active:scale-95 transition-all shadow-inner">
                    <Square fill="currentColor" size={12} className="text-zinc-400 group-hover:text-white" />
                </div>
            </button>
            <button onClick={onRecord} className="group relative">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center group-active:scale-95 transition-all shadow-lg border-4 border-zinc-800 ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'}`}>
                    <Circle fill="white" size={16} className="text-white" />
                </div>
            </button>
            <button onClick={onPlayPause} className="group">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-active:scale-95 transition-all shadow-inner">
                     {isPlaying ? <Pause fill="currentColor" size={14} className="text-zinc-200" /> : <Play fill="currentColor" size={14} className="text-zinc-200 ml-0.5" />}
                </div>
            </button>
      </div>
      
      {contextMenu && (
        <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setContextMenu(null)}
            onKeyDown={(e) => { if(e.key === 'Escape') setContextMenu(null) }}
            role="presentation"
        >
            <div className="absolute bg-zinc-800 border border-zinc-700 shadow-2xl rounded-xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in-95 duration-100 py-1"
                style={{ left: Math.min(window.innerWidth - 170, contextMenu.x), top: Math.min(window.innerHeight - 200, contextMenu.y) }}>
                <button onClick={handleDuplicate} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center space-x-2">
                    <Copy size={14} /> <span>Duplicate</span>
                </button>
                <div className="h-px bg-zinc-700 mx-2 my-1" />
                <button onClick={handleRename} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center space-x-2">
                    <Edit2 size={14} /> <span>Rename</span>
                </button>
                <div className="h-px bg-zinc-700 mx-2 my-1" />
                <button onClick={handleDelete} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700 flex items-center space-x-2">
                    <Trash2 size={14} /> <span>Delete</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Arranger;