
import React, { useRef, useState, useEffect, useMemo, memo } from 'react';
import { ProjectState, Clip, ToolMode, Track, Marker } from '../types';
import Waveform from './Waveform';
import LevelMeter from './LevelMeter';
import TrackIcon from './TrackIcon';
import Playhead from './Playhead'; // Import new component
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Activity, Mic, Music, Drum, Guitar, Keyboard, Sliders, Copy, Play, Pause, Square, Circle, Zap, GripVertical, Edit2, Music2, X, Palette, Volume2, Bookmark, CheckSquare, Maximize, AlignStartVertical, Split, Gauge, MoreVertical, Eye, Settings, Disc, Plus, ChevronDown, ChevronUp, MicOff } from 'lucide-react';
import CustomFader from './Fader';
import Knob from './Knob';

interface ArrangerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  currentTime: number; // Kept for seek/start, but Playhead handles motion
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
  selectedClipIds: string[];
  onSelectClip: (ids: string[]) => void;
  onOpenInspector: (trackId: string) => void;
  onOpenClipInspector?: (clipId: string) => void;
  onMoveTrack?: (from: number, to: number) => void;
  onRenameClip?: (clipId: string, name: string) => void;
  onColorClip?: (clipId: string, color: string) => void;
  onRenameTrack?: (trackId: string, name: string) => void;
  autoScroll?: boolean;
}

const SNAP_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: 'Bar', value: 4 },
    { label: '1/4', value: 1 },
    { label: '1/8', value: 0.5 },
    { label: '1/16', value: 0.25 },
];

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

// Memoized Track Lane to prevent re-renders when only time changes
const TrackLane = memo(({ track, clips, zoom, trackHeight, isCompactHeader, isSelected, selectedClipIds, onSelectTrack, onOpenInspector, handleTrackDragStart, index, updateTrack, handleClipPointerDown, onOpenClipInspector }: any) => {
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

const Arranger: React.FC<ArrangerProps> = ({ 
    project, setProject, currentTime, isPlaying, isRecording, recordingStartTime = 0,
    onPlayPause, onStop, onRecord, onSeek, onSplit, zoom, setZoom,
    selectedTrackId, onSelectTrack, selectedClipIds, onSelectClip, onOpenInspector, onOpenClipInspector,
    onMoveTrack, onRenameClip, onColorClip, onRenameTrack, autoScroll = true
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeaderRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [snapGrid, setSnapGrid] = useState(1); 
  const [showBacking, setShowBacking] = useState(false);
  const [trackHeight, setTrackHeight] = useState(100);
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(220);
  
  // Multi-touch tracking
  const activePointers = useRef<Map<number, {x: number, y: number}>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialZoom = useRef<number>(50);

  const clipsByTrack = useMemo(() => {
      const map = new Map<string, Clip[]>();
      project.tracks.forEach(t => map.set(t.id, []));
      project.clips.forEach(c => {
          if (map.has(c.trackId)) {
              map.get(c.trackId)?.push(c);
          }
      });
      return map;
  }, [project.clips, project.tracks]);

  useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        if (w < 640) {
            setHeaderWidth(80); // Compact icon-only view
            setIsCompactHeader(true);
        } else if (w < 1024) {
            setHeaderWidth(160);
            setIsCompactHeader(false);
        } else {
            setHeaderWidth(220);
            setIsCompactHeader(false);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [dragState, setDragState] = useState<{
      initialClips: { id: string, start: number }[]; 
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT';
      startX: number;
      startY: number;
      clipId: string;
      original: Clip; 
      pointerId: number;
  } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  const [loopDrag, setLoopDrag] = useState<{ mode: 'START' | 'END' | 'MOVE', startX: number, initialStart: number, initialEnd: number, pointerId: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<{ active: boolean, pointerId: number | null }>({ active: false, pointerId: null });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);
  const [trackDrag, setTrackDrag] = useState<{ id: string, startY: number, originalIndex: number, currentIndex: number, pointerId: number } | null>(null);

  const secondsPerBeat = 60 / project.bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const pixelsPerBeat = zoom * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;
  const totalBars = Math.max(50, Math.ceil((project.loopEnd + 20) / secondsPerBar));
  const totalWidth = totalBars * pixelsPerBar;

  const showBeats = pixelsPerBeat > 15;
  const gridImage = showBeats 
        ? `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`
        : `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)`;
  const gridSize = showBeats ? `${pixelsPerBar}px 100%, ${pixelsPerBeat}px 100%` : `${pixelsPerBar}px 100%`;

  // REMOVED: Auto-scroll useEffect (moved to Playhead)

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
    const time = Math.max(0, (clientX - rect.left + scrollLeft) / zoom); 
    if (snap && snapGrid > 0) {
        const snapSeconds = snapGrid * secondsPerBeat;
        return Math.round(time / snapSeconds) * snapSeconds;
    }
    return time;
  };

  const handleClipPointerDown = (e: React.PointerEvent, clip: Clip, mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT') => {
      e.stopPropagation();
      if (e.button === 2) {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
          return;
      }
      onSelectTrack(clip.trackId);
      
      const isSelected = selectedClipIds.includes(clip.id);
      let newSelectedIds = [...selectedClipIds];

      if (tool === ToolMode.POINTER) {
        if (!isSelected && !(multiSelectMode || e.shiftKey)) {
            newSelectedIds = [clip.id];
            onSelectClip(newSelectedIds);
        } else if (multiSelectMode || e.shiftKey) {
            if (!isSelected) newSelectedIds.push(clip.id);
            onSelectClip(newSelectedIds);
        }
      }

      setContextMenu(null);

      if (tool === ToolMode.SPLIT && mode === 'MOVE') {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const clickX = e.clientX - rect.left; 
          let splitTime = clip.start + (clickX / zoom);
          if (!e.shiftKey && snapGrid > 0) splitTime = Math.round(splitTime / (snapGrid * secondsPerBeat)) * (snapGrid * secondsPerBeat);
          onSplit(clip.id, splitTime);
          return;
      }
      if (tool === ToolMode.ERASER) {
          setProject(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== clip.id) }));
          return;
      }

      (e.target as Element).setPointerCapture(e.pointerId);
      
      const initialClips = newSelectedIds.map(id => {
          const c = project.clips.find(pc => pc.id === id);
          return c ? { id: c.id, start: c.start } : null;
      }).filter(Boolean) as any;

      setDragState({
          initialClips,
          clipId: clip.id,
          mode,
          startX: e.clientX,
          startY: e.clientY,
          original: { ...clip },
          pointerId: e.pointerId
      });
  };

  const handleTrackDragStart = (e: React.PointerEvent, trackId: string, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setTrackDrag({
          id: trackId,
          startY: e.clientY,
          originalIndex: index,
          currentIndex: index,
          pointerId: e.pointerId
      });
  };

  const handleGlobalPointerDown = (e: React.PointerEvent) => {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      if (activePointers.current.size === 2) {
          const points = Array.from(activePointers.current.values());
          const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          initialPinchDist.current = dist;
          initialZoom.current = zoom;
      } else {
          if (!dragState && !loopDrag && !trackDrag && !isScrubbing.active && activePointers.current.size === 1) {
               if (e.shiftKey || multiSelectMode) {
                   setSelectionBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
                   (e.currentTarget as Element).setPointerCapture(e.pointerId);
               }
          }
      }
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.current.size === 2 && initialPinchDist.current) {
          const points = Array.from(activePointers.current.values());
          const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          
          if (dist > 0 && initialPinchDist.current > 0) {
              const scale = dist / initialPinchDist.current;
              const newZoom = Math.max(10, Math.min(400, initialZoom.current * scale));
              setZoom(newZoom);
          }
          return;
      }

      if (isScrubbing.active) {
          onSeek(calculateSeekTime(e.clientX, e.shiftKey));
          return;
      }
      
      if (loopDrag && loopDrag.pointerId === e.pointerId) {
          const deltaX = e.clientX - loopDrag.startX;
          const deltaSeconds = deltaX / zoom;
          const snapSeconds = (e.shiftKey ? 0 : 4) * secondsPerBeat;

          if (loopDrag.mode === 'MOVE') {
              let start = loopDrag.initialStart + deltaSeconds;
              let end = loopDrag.initialEnd + deltaSeconds;
              if (snapSeconds > 0) {
                  start = Math.round(start / snapSeconds) * snapSeconds;
                  end = start + (loopDrag.initialEnd - loopDrag.initialStart);
              }
              setProject(p => ({...p, loopStart: Math.max(0, start), loopEnd: Math.max(0.1, end)}));
          } else if (loopDrag.mode === 'START') {
               let start = loopDrag.initialStart + deltaSeconds;
               if (snapSeconds > 0) start = Math.round(start / snapSeconds) * snapSeconds;
               setProject(p => ({...p, loopStart: Math.min(Math.max(0, start), p.loopEnd - 0.1) }));
          } else if (loopDrag.mode === 'END') {
               let end = loopDrag.initialEnd + deltaSeconds;
               if (snapSeconds > 0) end = Math.round(end / snapSeconds) * snapSeconds;
               setProject(p => ({...p, loopEnd: Math.max(p.loopStart + 0.1, end) }));
          }
      }

      if (trackDrag && trackDrag.pointerId === e.pointerId) {
          const deltaY = e.clientY - trackDrag.startY;
          const moveSteps = Math.round(deltaY / trackHeight);
          const newIndex = Math.max(0, Math.min(project.tracks.length - 1, trackDrag.originalIndex + moveSteps));
          
          if (newIndex !== trackDrag.currentIndex) {
              setTrackDrag(prev => prev ? ({ ...prev, currentIndex: newIndex }) : null);
              if (onMoveTrack) {
                   onMoveTrack(trackDrag.currentIndex, newIndex);
                   setTrackDrag(prev => prev ? ({ ...prev, currentIndex: newIndex, originalIndex: newIndex, startY: prev.startY + (moveSteps * trackHeight) }) : null);
              }
          }
      }

      if (dragState && dragState.pointerId === e.pointerId) {
          const deltaX = e.clientX - dragState.startX;
          const deltaSeconds = deltaX / zoom;
          const snapSeconds = (e.shiftKey ? 0 : snapGrid) * secondsPerBeat;
          
          if (dragState.mode === 'MOVE') {
              const primaryNewStart = snapSeconds > 0 
                ? Math.round((dragState.original.start + deltaSeconds) / snapSeconds) * snapSeconds 
                : dragState.original.start + deltaSeconds;
              const diff = primaryNewStart - dragState.original.start;

              setProject(prev => ({
                  ...prev,
                  clips: prev.clips.map(c => {
                      const init = dragState.initialClips.find(i => i.id === c.id);
                      if (init) {
                          let targetTrackId = c.trackId;
                          if (c.id === dragState.clipId && scrollContainerRef.current) {
                                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                                const relativeY = (e.clientY - containerRect.top) + scrollContainerRef.current.scrollTop - 32; // 32 is ruler height
                                const trackIndex = Math.floor(relativeY / trackHeight);
                                if (trackIndex >= 0 && trackIndex < project.tracks.length) {
                                    targetTrackId = project.tracks[trackIndex].id;
                                }
                          }
                          return { ...c, start: Math.max(0, init.start + diff), trackId: targetTrackId };
                      }
                      return c;
                  })
              }));
          } else {
             const { original } = dragState;
             let newStart = original.start, newDuration = original.duration, newOffset = original.offset;
             
             if (dragState.mode === 'TRIM_START') {
                 const rawNewStart = original.start + deltaSeconds;
                 const snappedStart = snapSeconds > 0 ? Math.round(rawNewStart/snapSeconds)*snapSeconds : rawNewStart;
                 const shift = snappedStart - original.start;
                 if (shift < original.duration) {
                     newStart = snappedStart;
                     newOffset = original.offset + (shift * (original.speed||1));
                     newDuration = original.duration - shift;
                 }
             } else if (dragState.mode === 'TRIM_END') {
                 const rawNewEnd = original.start + original.duration + deltaSeconds;
                 const snappedEnd = snapSeconds > 0 ? Math.round(rawNewEnd/snapSeconds)*snapSeconds : rawNewEnd;
                 newDuration = Math.max(0.1, snappedEnd - original.start);
             } else if (dragState.mode === 'FADE_IN') {
                 const rawVal = Math.max(0, deltaSeconds);
                 setProject(prev => ({...prev, clips: prev.clips.map(c => c.id === dragState.clipId ? {...c, fadeIn: Math.min(c.duration, rawVal)} : c)}));
                 return;
             } else if (dragState.mode === 'FADE_OUT') {
                 const rawVal = Math.max(0, -deltaSeconds);
                 setProject(prev => ({...prev, clips: prev.clips.map(c => c.id === dragState.clipId ? {...c, fadeOut: Math.min(c.duration, rawVal)} : c)}));
                 return;
             }
             
             setProject(prev => ({
                 ...prev,
                 clips: prev.clips.map(c => c.id === dragState.clipId ? { ...c, start: newStart, duration: newDuration, offset: newOffset } : c)
             }));
          }
      }
      
      if (selectionBox) {
          setSelectionBox(prev => prev ? ({ ...prev, currentX: e.clientX, currentY: e.clientY }) : null);
      }
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
      activePointers.current.delete(e.pointerId);
      if (activePointers.current.size < 2) {
          initialPinchDist.current = null;
      }
      setDragState(null);
      setIsScrubbing({ active: false, pointerId: null });
      setLoopDrag(null);
      setTrackDrag(null);
      setSelectionBox(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          setZoom(Math.max(10, Math.min(400, zoom * delta)));
      }
  };

  return (
    <div 
        className="flex flex-col h-full bg-studio-bg text-xs select-none touch-none"
        onPointerDown={handleGlobalPointerDown}
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        onContextMenu={e => e.preventDefault()}
        onClick={() => setContextMenu(null)}
    >
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 bg-studio-panel flex items-center px-3 justify-between shrink-0 z-30">
         <div className="flex space-x-2 items-center">
            {/* Tool Selector */}
            <div className="flex bg-zinc-900 rounded p-0.5 space-x-0.5 shrink-0 border border-zinc-800">
                <button onClick={() => setTool(ToolMode.POINTER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.POINTER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><MousePointer size={14} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded transition-all ${tool === ToolMode.SPLIT ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Scissors size={14} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded transition-all ${tool === ToolMode.ERASER ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Trash2 size={14} /></button>
            </div>
            <div className="w-px h-5 bg-zinc-800 shrink-0 mx-1" />
            <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800">
                <Grid size={12} className="text-zinc-500" />
                <select value={snapGrid} onChange={(e) => setSnapGrid(parseFloat(e.target.value))} className="bg-transparent text-zinc-300 outline-none text-[10px] w-14 appearance-none">
                    {SNAP_OPTIONS.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <button 
                onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} 
                className={`p-1.5 rounded transition-all ${project.isLooping ? 'bg-studio-accent text-white' : 'text-zinc-500'}`}
                title="Toggle Loop"
             >
                <Repeat size={14} />
             </button>
         </div>

         <div className="flex items-center space-x-2 shrink-0">
             <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800 hidden sm:flex">
                 <ZoomOut size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.max(10, zoom * 0.8))} />
                 <span className="text-[9px] text-zinc-400 w-8 text-center">{Math.round(zoom)}%</span>
                 <ZoomIn size={12} className="text-zinc-500 cursor-pointer" onClick={() => setZoom(Math.min(400, zoom * 1.2))} />
             </div>
             <div className="flex items-center space-x-1 bg-zinc-900 rounded px-2 h-7 border border-zinc-800 hidden md:flex" title="Track Height">
                 <MoreVertical size={12} className="text-zinc-500" />
                 <input 
                    type="range" min={60} max={200} value={trackHeight} 
                    onChange={e => setTrackHeight(parseInt(e.target.value))}
                    className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                 />
             </div>
             <button onClick={() => setShowBacking(!showBacking)} className={`p-1.5 rounded transition-all ${showBacking ? 'text-studio-accent' : 'text-zinc-500'}`} title="Backing Track">
                <Music2 size={16} />
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Track Headers */}
        <div className="flex-none bg-studio-panel border-r border-zinc-800 z-20 flex flex-col shadow-xl" style={{ width: headerWidth }}>
             <div className="h-8 border-b border-zinc-800 bg-zinc-800/50 flex items-center px-3 justify-between">
                 <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TRACKS</span>
                 <button className="text-zinc-500 hover:text-white"><Plus size={12} /></button>
             </div> 
             <div className="flex-1 overflow-hidden relative">
                 <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
                    {project.tracks.map((track, idx) => (
                        <TrackLane 
                            key={track.id}
                            track={track}
                            index={idx}
                            trackHeight={trackHeight}
                            isCompactHeader={isCompactHeader}
                            isSelected={selectedTrackId === track.id}
                            onSelectTrack={onSelectTrack}
                            onOpenInspector={onOpenInspector}
                            handleTrackDragStart={handleTrackDragStart}
                            updateTrack={updateTrack}
                        />
                    ))}
                 </div>
             </div>
        </div>

        {/* Timeline Area */}
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto relative bg-zinc-950"
            onPointerDown={(e) => {
                 if (!dragState && !loopDrag && !trackDrag && !isScrubbing.active && activePointers.current.size === 1) {
                     // Empty click handling if needed
                 }
            }}
            onScroll={() => {
                if (trackHeaderRef.current) {
                    const el = trackHeaderRef.current.querySelector('div[style*="translateY"]');
                    if (el) (el as HTMLElement).style.transform = `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)`;
                }
            }}
            onWheel={handleWheel}
        >
            <div style={{ width: totalWidth, minWidth: '100%', height: project.tracks.length * trackHeight + 32 }}>
                {/* Background Grid */}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundSize: gridSize, backgroundImage: gridImage, top: 32 }} />

                {/* Ruler */}
                <div 
                    className="sticky top-0 h-8 bg-zinc-900/95 backdrop-blur z-30 border-b border-zinc-700 cursor-pointer text-[9px] text-zinc-500 select-none shadow-sm group/ruler"
                    onPointerDown={(e) => {
                        (e.target as Element).setPointerCapture(e.pointerId);
                        setIsScrubbing({ active: true, pointerId: e.pointerId });
                        onSeek(calculateSeekTime(e.clientX, e.shiftKey));
                    }}
                    onDoubleClick={(e) => {
                        const time = calculateSeekTime(e.clientX, true);
                        const newMarker = { id: crypto.randomUUID(), time, text: `Marker ${project.markers.length + 1}`, color: '#eab308' };
                        setProject(p => ({...p, markers: [...p.markers, newMarker].sort((a,b) => a.time - b.time)}));
                    }}
                >
                    {Array.from({ length: totalBars }).map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-700 pl-1 pt-1.5 font-medium pointer-events-none" style={{ left: i * pixelsPerBar }}>
                            {i + 1}
                        </div>
                    ))}
                    
                    {/* Markers */}
                    {project.markers.map(marker => (
                        <div 
                            key={marker.id}
                            className="absolute top-0 h-8 flex items-center group z-40 hover:z-50 cursor-context-menu"
                            style={{ left: marker.time * zoom }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Delete marker "${marker.text}"?`)) {
                                    setProject(p => ({...p, markers: p.markers.filter(m => m.id !== marker.id)}));
                                }
                            }}
                        >
                            <div className="w-px h-full bg-yellow-500" />
                            <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded-sm text-[9px] font-bold shadow-sm ml-0.5 whitespace-nowrap hover:bg-yellow-400 transition-colors">
                                {marker.text}
                            </div>
                        </div>
                    ))}
                    
                    {/* Loop Region Interactive */}
                    {project.isLooping && (
                         <>
                            <div 
                                className="absolute top-0 h-4 bg-yellow-500/20 border-x-2 border-yellow-500 z-20 cursor-move" 
                                style={{ left: project.loopStart * zoom, width: (project.loopEnd - project.loopStart) * zoom }}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    (e.target as Element).setPointerCapture(e.pointerId);
                                    setLoopDrag({ mode: 'MOVE', startX: e.clientX, initialStart: project.loopStart, initialEnd: project.loopEnd, pointerId: e.pointerId });
                                }}
                            >
                                <div className="absolute inset-0 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors" />
                            </div>
                            <div 
                                className="absolute top-0 h-8 w-4 -ml-2 z-30 cursor-ew-resize group/handle" 
                                style={{ left: project.loopStart * zoom }}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    (e.target as Element).setPointerCapture(e.pointerId);
                                    setLoopDrag({ mode: 'START', startX: e.clientX, initialStart: project.loopStart, initialEnd: project.loopEnd, pointerId: e.pointerId });
                                }}
                            >
                                <div className="w-0.5 h-full bg-yellow-500 mx-auto group-hover/handle:w-1 transition-all" />
                            </div>
                             <div 
                                className="absolute top-0 h-8 w-4 -ml-2 z-30 cursor-ew-resize group/handle" 
                                style={{ left: project.loopEnd * zoom }}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    (e.target as Element).setPointerCapture(e.pointerId);
                                    setLoopDrag({ mode: 'END', startX: e.clientX, initialStart: project.loopStart, initialEnd: project.loopEnd, pointerId: e.pointerId });
                                }}
                            >
                                <div className="w-0.5 h-full bg-yellow-500 mx-auto group-hover/handle:w-1 transition-all" />
                            </div>
                         </>
                    )}
                </div>

                {/* Track Lanes */}
                <div className="relative" style={{ height: project.tracks.length * trackHeight }}>
                    {project.tracks.map((track, i) => (
                         <div 
                            key={track.id} 
                            className={`absolute w-full border-b border-zinc-800/50 transition-all ${
                                (track.muted || (project.tracks.some(t => t.solo) && !track.solo)) 
                                ? 'opacity-50 grayscale' 
                                : ''
                            }`} 
                            style={{ top: i * trackHeight, height: trackHeight }}
                         >
                              {clipsByTrack.get(track.id)?.map(clip => {
                                  const isSelected = selectedClipIds.includes(clip.id);
                                  return (
                                      <div 
                                        key={clip.id}
                                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden transition-all cursor-move group shadow-sm ${isSelected ? 'ring-2 ring-white z-10' : 'ring-1 ring-black/20 hover:ring-white/30'} ${clip.muted ? 'opacity-50 grayscale' : 'opacity-100'}`}
                                        style={{ 
                                            left: clip.start * zoom, 
                                            width: clip.duration * zoom,
                                            backgroundColor: clip.color || '#555' 
                                        }}
                                        onPointerDown={(e) => handleClipPointerDown(e, clip, 'MOVE')}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenClipInspector) onOpenClipInspector(clip.id);
                                        }}
                                      >
                                          <div className="absolute inset-0 opacity-80 pointer-events-none bg-black/20">
                                               <Waveform bufferKey={clip.bufferKey} color="rgba(255,255,255,0.8)" />
                                          </div>
                                          <div className="absolute top-0 left-0 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-br-md pointer-events-none flex items-center gap-1">
                                              {clip.muted && <MicOff size={8} className="text-red-400" />}
                                              <span className="text-[9px] font-bold text-white shadow-black drop-shadow-md truncate max-w-[100px] block">{clip.name}</span>
                                          </div>
                                          {isSelected && (
                                              <>
                                                <div className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20 flex items-center justify-center" onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_START')}>
                                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                                </div>
                                                <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20 flex items-center justify-center" onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_END')}>
                                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                                </div>
                                                <div className="absolute top-0 left-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-br cursor-ne-resize z-20" style={{ transform: `translateX(${clip.fadeIn * zoom}px)` }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_IN')} />
                                                <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 hover:bg-white/40 rounded-bl cursor-nw-resize z-20" style={{ transform: `translateX(-${clip.fadeOut * zoom}px)` }} onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_OUT')} />
                                              </>
                                          )}
                                      </div>
                                  );
                              })}
                         </div>
                    ))}
                    
                    {/* Replaced absolute playhead with Optimized Component */}
                    <Playhead 
                        zoom={zoom} 
                        isPlaying={isPlaying} 
                        scrollContainerRef={scrollContainerRef}
                        staticTime={currentTime}
                    />
                </div>
            </div>
        </div>

        {selectionBox && (
            <div className="absolute bg-blue-500/10 border border-blue-400 z-50 pointer-events-none"
                 style={{
                     left: Math.min(selectionBox.startX, selectionBox.currentX) - (scrollContainerRef.current?.getBoundingClientRect().left || 0) + (scrollContainerRef.current?.scrollLeft || 0) - headerWidth,
                     top: Math.min(selectionBox.startY, selectionBox.currentY) - (scrollContainerRef.current?.getBoundingClientRect().top || 0) + (scrollContainerRef.current?.scrollTop || 0),
                     width: Math.abs(selectionBox.currentX - selectionBox.startX),
                     height: Math.abs(selectionBox.currentY - selectionBox.startY)
                 }}
            />
        )}

        {contextMenu && (
            <div 
                className="fixed bg-zinc-800 border border-zinc-700 shadow-2xl rounded-lg p-1 z-[100] min-w-[160px] animate-in zoom-in-95 duration-100"
                style={{ top: Math.min(window.innerHeight - 200, contextMenu.y), left: Math.min(window.innerWidth - 160, contextMenu.x) }}
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white rounded flex items-center gap-2"
                    onClick={() => {
                        const newName = prompt("Rename Clip");
                        if(newName && onRenameClip) onRenameClip(contextMenu.clipId, newName);
                        setContextMenu(null);
                    }}
                >
                    <Edit2 size={12} /> Rename
                </button>
                <div className="h-px bg-zinc-700 my-1" />
                <div className="px-2 py-1">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1 ml-1">Color</p>
                    <div className="flex flex-wrap gap-1">
                        {CLIP_COLORS.map(c => (
                            <button 
                                key={c} 
                                className="w-4 h-4 rounded-full border border-transparent hover:border-white" 
                                style={{ backgroundColor: c }}
                                onClick={() => {
                                    if(onColorClip) onColorClip(contextMenu.clipId, c);
                                    setContextMenu(null);
                                }}
                            />
                        ))}
                    </div>
                </div>
                <div className="h-px bg-zinc-700 my-1" />
                <button 
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2"
                    onClick={() => {
                        setProject(p => ({...p, clips: p.clips.filter(c => c.id !== contextMenu.clipId)}));
                        setContextMenu(null);
                    }}
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Arranger;
