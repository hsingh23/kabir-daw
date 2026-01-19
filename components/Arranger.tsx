
import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, ToolMode, Track, Marker } from '../types';
import Waveform from './Waveform';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import LevelMeter from './LevelMeter';
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Activity, Mic, Music, Drum, Guitar, Keyboard, Sliders, Copy, Play, Pause, Square, Circle, Zap, GripVertical, Edit2, Music2, X, Palette, Volume2, Bookmark, CheckSquare } from 'lucide-react';

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
  selectedClipIds: string[];
  onSelectClip: (ids: string[]) => void;
  onOpenInspector: (trackId: string) => void;
  onMoveTrack?: (from: number, to: number) => void;
  onRenameClip?: (clipId: string, name: string) => void;
  onColorClip?: (clipId: string, color: string) => void;
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

const CLIP_COLORS = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
];

const TrackIcon = ({ name, color }: { name: string, color: string }) => {
    const n = name.toLowerCase();
    if (n.includes('drum') || n.includes('beat')) return <Drum size={16} style={{ color }} />;
    if (n.includes('bass') || n.includes('guitar')) return <Guitar size={16} style={{ color }} />;
    if (n.includes('synth') || n.includes('piano') || n.includes('key')) return <Keyboard size={16} style={{ color }} />;
    if (n.includes('voc') || n.includes('mic')) return <Mic size={16} style={{ color }} />;
    return <Music size={16} style={{ color }} />;
};

const LoopMarkers = ({ clip, zoom }: { clip: Clip, zoom: number }) => {
    const buffer = audio.buffers.get(clip.bufferKey);
    if (!buffer) return null;
    const B = buffer.duration;
    if (B === 0) return null;
    const O = clip.offset;
    const D = clip.duration;
    
    const markers = [];
    let time = B - (O % B); 
    while (time < D) {
        markers.push(time);
        time += B;
    }
    if (markers.length === 0) return null;

    return (
        <>
            {markers.map((t, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-white/40 border-dashed z-20 pointer-events-none" style={{ left: t * zoom }}>
                     <div className="text-[8px] text-white/70 pl-0.5 pt-0.5 opacity-70"><Repeat size={8} /></div>
                </div>
            ))}
        </>
    );
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
    selectedClipIds,
    onSelectClip,
    onOpenInspector,
    onMoveTrack,
    onRenameClip,
    onColorClip,
    onRenameTrack
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolMode>(ToolMode.POINTER);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [snapGrid, setSnapGrid] = useState(1); 
  const [showBacking, setShowBacking] = useState(false);
  
  const [headerWidth, setHeaderWidth] = useState(160);
  useEffect(() => {
    const handleResize = () => setHeaderWidth(window.innerWidth < 768 ? 110 : 160);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [dragState, setDragState] = useState<{
      initialClips: { id: string, start: number }[]; // Store initial states for group drag
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT';
      startX: number;
      startY: number;
      clipId: string; // The clip being dragged primarily
      original: Clip; // The clip being dragged
      pointerId: number;
  } | null>(null);

  const [loopDrag, setLoopDrag] = useState<{ type: 'start' | 'end' | 'move', startX: number, originalLoopStart: number, originalLoopEnd: number, pointerId: number } | null>(null);
  const [markerDrag, setMarkerDrag] = useState<{ id: string, startX: number, originalTime: number, pointerId: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<{ active: boolean, pointerId: number | null }>({ active: false, pointerId: null });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);

  const [trackDrag, setTrackDrag] = useState<{ id: string, startY: number, currentIndex: number, pointerId: number } | null>(null);
  const [pinchDist, setPinchDist] = useState<number | null>(null);

  const secondsPerBeat = 60 / project.bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  
  const pixelsPerBeat = zoom * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  const maxTime = Math.max(
      project.loopEnd + 10,
      ...project.clips.map(c => c.start + c.duration),
      isRecording ? currentTime + 20 : 0, 
      (window.innerWidth / zoom) * 2
  );
  const totalBars = Math.ceil(maxTime / secondsPerBar) + 2;
  const totalWidth = totalBars * pixelsPerBar;

  const showBeats = pixelsPerBeat > 15;
  const gridImage = showBeats 
        ? `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
           linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)`
        : `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)`;
  const gridSize = showBeats
        ? `${pixelsPerBar}px 100%, ${pixelsPerBeat}px 100%`
        : `${pixelsPerBar}px 100%`;

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

  // --- Markers ---
  const handleAddMarker = (time: number) => {
      const newMarker: Marker = {
          id: crypto.randomUUID(),
          time,
          text: `Marker ${project.markers.length + 1}`,
          color: '#eab308'
      };
      setProject(prev => ({ ...prev, markers: [...prev.markers, newMarker] }));
  };

  const handleMarkerPointerDown = (e: React.PointerEvent, marker: Marker) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setMarkerDrag({
          id: marker.id,
          startX: e.clientX,
          originalTime: marker.time,
          pointerId: e.pointerId
      });
  };

  const handleMarkerDoubleClick = (e: React.MouseEvent, marker: Marker) => {
      e.stopPropagation();
      const newName = prompt('Marker Name:', marker.text);
      if (newName !== null) {
          if (newName.trim() === '') {
              // Delete
              setProject(prev => ({ ...prev, markers: prev.markers.filter(m => m.id !== marker.id) }));
          } else {
              setProject(prev => ({ ...prev, markers: prev.markers.map(m => m.id === marker.id ? { ...m, text: newName } : m) }));
          }
      }
  };

  // --- Pointer Events for Ruler ---
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.detail === 2) {
        // Double click to add marker
        handleAddMarker(calculateSeekTime(e.clientX, true));
        return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsScrubbing({ active: true, pointerId: e.pointerId });
    onSeek(calculateSeekTime(e.clientX, e.shiftKey));
  };

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

    // Selection Logic
    const isSelected = selectedClipIds.includes(clip.id);
    let newSelectedIds = [...selectedClipIds];

    if (tool === ToolMode.POINTER) {
        if (multiSelectMode || e.metaKey || e.ctrlKey || e.shiftKey) {
            if (isSelected) {
                // If dragging, don't deselect yet. Deselect on click-release if not dragged?
                // For simplicity, just keep selected for dragging.
                // If just clicking (no drag), we handle that later? 
                // Toggle logic on down:
                if (!e.ctrlKey && !e.metaKey && !multiSelectMode) {
                    // Standard click on a selected group -> keep group
                } else {
                    // Toggle
                    // If we toggle off here, dragging won't work for this clip. 
                    // Let's rely on standard OS behavior: MouseDown doesn't toggle OFF if part of selection, unless it's a dedicated toggle command.
                    // But for simple "toggle" interaction:
                    if (isSelected && (e.ctrlKey || e.metaKey || multiSelectMode)) {
                        newSelectedIds = newSelectedIds.filter(id => id !== clip.id);
                        onSelectClip(newSelectedIds);
                        return; // Don't start drag if toggling off
                    } else if (!isSelected) {
                        newSelectedIds.push(clip.id);
                        onSelectClip(newSelectedIds);
                    }
                }
            } else {
                if (e.ctrlKey || e.metaKey || multiSelectMode) {
                    newSelectedIds.push(clip.id);
                } else {
                    newSelectedIds = [clip.id];
                }
                onSelectClip(newSelectedIds);
            }
        } else {
            // Normal click
            if (!isSelected) {
                newSelectedIds = [clip.id];
                onSelectClip(newSelectedIds);
            }
            // If already selected, do nothing to selection, wait for drag.
        }
    }

    onSelectTrack(clip.trackId);
    setContextMenu(null);

    if (tool === ToolMode.SPLIT && mode === 'MOVE') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left; 
        let splitTime = clip.start + (clickX / zoom);
        if (!e.shiftKey && snapGrid > 0) {
             const snapSeconds = snapGrid * secondsPerBeat;
             splitTime = Math.round(splitTime / snapSeconds) * snapSeconds;
        }
        splitTime = Math.max(clip.start + 0.01, Math.min(clip.start + clip.duration - 0.01, splitTime));
        onSplit(clip.id, splitTime);
        return;
    }
    if (tool === ToolMode.ERASER) {
        setProject(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== clip.id) }));
        onSelectClip([]);
        return;
    }

    (e.target as Element).setPointerCapture(e.pointerId);
    
    // Prepare initial positions for all selected clips (for group move)
    const initialClips = newSelectedIds.map(id => {
        const c = project.clips.find(pc => pc.id === id);
        return c ? { id: c.id, start: c.start } : null;
    }).filter(c => c !== null) as { id: string, start: number }[];

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

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (longPressTimerRef.current && Math.abs(e.movementX) + Math.abs(e.movementY) > 5) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }

    if (isScrubbing.active && isScrubbing.pointerId === e.pointerId) {
        onSeek(calculateSeekTime(e.clientX, e.shiftKey));
        return;
    }

    if (markerDrag && markerDrag.pointerId === e.pointerId) {
        const deltaX = e.clientX - markerDrag.startX;
        const deltaSeconds = deltaX / zoom;
        let newTime = Math.max(0, markerDrag.originalTime + deltaSeconds);
        
        if (!e.shiftKey && snapGrid > 0) {
            const snapSeconds = snapGrid * secondsPerBeat;
            newTime = Math.round(newTime / snapSeconds) * snapSeconds;
        }

        setProject(prev => ({
            ...prev,
            markers: prev.markers.map(m => m.id === markerDrag.id ? { ...m, time: newTime } : m)
        }));
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
            // Calculate base delta
            let primaryNewStart = original.start + deltaSeconds;
            if (activeSnapSeconds > 0) primaryNewStart = Math.round(primaryNewStart / activeSnapSeconds) * activeSnapSeconds;
            const primaryDelta = Math.max(0, primaryNewStart) - original.start;

            // Apply delta to ALL selected clips
            setProject(prev => ({
                ...prev,
                clips: prev.clips.map(c => {
                    const init = dragState.initialClips.find(ic => ic.id === c.id);
                    if (init) {
                        let newStart = init.start + primaryDelta;
                        // Prevent negative start
                        if (newStart < 0) newStart = 0; // Simple clamp, might distort relative timing if hitting 0
                        
                        // Handle Track changing only for the PRIMARY clip being dragged (simpler UX)
                        // Or allow group track move? Complex. Let's stick to horizontal group move.
                        let targetTrackId = c.trackId;
                        if (c.id === dragState.clipId && scrollContainerRef.current) {
                             const containerRect = scrollContainerRef.current.getBoundingClientRect();
                             const scrollTop = scrollContainerRef.current.scrollTop;
                             const relativeY = (e.clientY - containerRect.top) + scrollTop - 32; 
                             const trackIndex = Math.floor(relativeY / TRACK_HEIGHT);
                             if (trackIndex >= 0 && trackIndex < project.tracks.length) {
                                 targetTrackId = project.tracks[trackIndex].id;
                             }
                        }

                        return { ...c, start: newStart, trackId: targetTrackId };
                    }
                    return c;
                })
            }));
        } 
        else {
            // Trim/Fade affects ONLY the dragged clip
            if (dragState.mode === 'TRIM_START') {
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
    if (markerDrag && markerDrag.pointerId === e.pointerId) {
        setMarkerDrag(null);
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
  
  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomDelta = -e.deltaY * 0.1;
          setZoom(Math.max(10, Math.min(400, zoom + zoomDelta)));
      }
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
          onSelectClip([]);
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

  const handleColorChange = (color: string) => {
      if (contextMenu && onColorClip) {
          onColorClip(contextMenu.clipId, color);
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
                <button onClick={() => setMultiSelectMode(!multiSelectMode)} className={`p-1.5 rounded-md transition-all ${multiSelectMode ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`} title="Multi-Select Mode"><CheckSquare size={16} /></button>
                <button onClick={() => setTool(ToolMode.SPLIT)} className={`p-1.5 rounded-md transition-all ${tool === ToolMode.SPLIT ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Scissors size={16} /></button>
                <button onClick={() => setTool(ToolMode.ERASER)} className={`p-1.5 rounded-md transition-all ${tool === ToolMode.ERASER ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Trash2 size={16} /></button>
            </div>
            
            <div className="w-px h-6 bg-zinc-800 shrink-0" />

            <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg px-2 h-8 shrink-0 border border-zinc-800">
                <Grid size={14} className="text-zinc-500" />
                <select value={snapGrid} onChange={(e) => setSnapGrid(parseFloat(e.target.value))} className="bg-transparent text-zinc-300 outline-none text-[10px] font-medium cursor-pointer w-14">
                    {SNAP_OPTIONS.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
         </div>

         <div className="flex items-center space-x-3 shrink-0">
             <button onClick={() => setShowBacking(!showBacking)} className={`flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-400 hover:text-white transition-colors ${showBacking ? 'border-studio-accent text-studio-accent' : ''}`}>
                <Music2 size={14} />
             </button>
             <button onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} className={`p-1.5 rounded-md transition-all ${project.isLooping ? 'text-yellow-400 bg-yellow-400/10' : 'text-zinc-500'}`}>
                <Repeat size={16} />
            </button>
         </div>
      </div>
      
      {showBacking && (
          <div className="absolute top-14 right-4 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <h3 className="font-bold text-sm text-zinc-200">Backing Instruments</h3>
                  <button onClick={() => setShowBacking(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
              </div>
              <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                  <Tanpura config={project.tanpura} onChange={(cfg) => setProject(p => ({...p, tanpura: cfg}))} />
                  <Tabla config={project.tabla} onChange={(cfg) => setProject(p => ({...p, tabla: cfg}))} />
              </div>
          </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-zinc-900 relative overscroll-contain"
        style={{ touchAction: 'pan-x pan-y' }}
        onWheel={handleWheel}
      >
        <div className="min-w-max relative flex flex-col" style={{ width: totalWidth + headerWidth }}>
           
            {/* 1. Sticky Top Ruler with Markers */}
            <div className="sticky top-0 z-40 flex h-10 bg-zinc-900 border-b border-zinc-800 shadow-sm">
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
                     {/* Loop Region */}
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

                     {/* Grid Numbers */}
                     {[...Array(totalBars)].map((_, i) => (
                        <div key={i} className="absolute bottom-0 text-[10px] text-zinc-500 border-l border-zinc-700 pl-1 select-none h-5 flex items-end pb-1 font-medium" style={{ left: i * pixelsPerBar }}>
                            {i + 1}
                        </div>
                     ))}

                     {/* Markers */}
                     {project.markers.map(marker => (
                         <div 
                            key={marker.id}
                            className="absolute top-0 h-full z-30 group"
                            style={{ left: marker.time * zoom }}
                            onPointerDown={(e) => handleMarkerPointerDown(e, marker)}
                            onDoubleClick={(e) => handleMarkerDoubleClick(e, marker)}
                         >
                             <div className="relative flex flex-col items-center">
                                 <Bookmark size={12} fill={marker.color} color={marker.color} className="drop-shadow-sm transform translate-y-0.5" />
                                 <span className="text-[10px] font-bold text-white bg-zinc-800/80 px-1 rounded -mt-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute top-4">{marker.text}</span>
                             </div>
                             <div className="w-px h-screen bg-white/20 absolute top-3 left-1.5 pointer-events-none" />
                         </div>
                     ))}
                     
                     {/* Playhead Cap */}
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
                        >
                             <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2 overflow-hidden">
                                    <div 
                                        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 p-0.5"
                                        onPointerDown={(e) => handleTrackDragStart(e, track.id, index)}
                                    >
                                        <GripVertical size={12} />
                                    </div>

                                    <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center shadow-inner shrink-0" style={{ color: track.color }}>
                                        <TrackIcon name={track.name} color={track.color} />
                                    </div>
                                    <span className="font-bold text-xs truncate cursor-text text-zinc-400" onDoubleClick={(e) => handleTrackNameDoubleClick(e, track.id, track.name)}>{track.name}</span>
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); onOpenInspector(track.id)}} className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 md:block hidden"><Sliders size={12} /></button>
                             </div>
                             
                             <div className="flex space-x-1 mt-auto">
                                 <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted })}} className={`flex-1 h-6 rounded text-[10px] font-bold border border-black/20 ${track.muted ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>M</button>
                                 <button onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo })}} className={`flex-1 h-6 rounded text-[10px] font-bold border border-black/20 ${track.solo ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-zinc-400'}`}>S</button>
                             </div>

                             <div className="mt-2 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                <LevelMeter trackId={track.id} vertical={false} />
                             </div>
                             
                             {headerWidth > 120 && (
                                <div className="mt-1 flex items-center space-x-2">
                                    <input type="range" min="0" max="1" step="0.01" value={track.volume} onClick={(e) => e.stopPropagation()} onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-zinc-500" />
                                </div>
                             )}
                             <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color }} />
                        </div>

                        {/* Track Lane */}
                        <div className="relative flex-1 border-b border-zinc-800/30 bg-zinc-900/20">
                            {isRecording && selectedTrackId === track.id && (
                                <div className="absolute rounded-lg overflow-hidden z-20 shadow-xl opacity-80 border-2 border-red-500 bg-red-900/40" style={{ left: recordingStartTime * zoom, width: Math.max(10, (currentTime - recordingStartTime) * zoom), top: 4, bottom: 4 }}>
                                     <div className="absolute top-2 left-2 flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] font-bold text-red-200">Recording...</span></div>
                                </div>
                            )}

                            {project.clips.filter(c => c.trackId === track.id).map(clip => {
                                const isSelected = selectedClipIds.includes(clip.id);
                                const clipColor = clip.color || track.color;
                                const isMuted = track.muted || (project.tracks.some(t => t.solo) && !track.solo);

                                return (
                                    <div
                                        key={clip.id}
                                        className={`absolute rounded-lg overflow-hidden cursor-pointer select-none touch-none transition-all ${isSelected ? 'ring-2 ring-white z-20 shadow-xl' : 'hover:brightness-110 z-10 shadow-md'} ${isMuted ? 'opacity-50 grayscale' : ''}`}
                                        style={{ left: clip.start * zoom, width: clip.duration * zoom, top: 4, bottom: 4, backgroundColor: '#18181b', borderLeft: `4px solid ${clipColor}` }}
                                        onPointerDown={(e) => handleClipPointerDown(e, clip, 'MOVE')}
                                    >
                                        <LoopMarkers clip={clip} zoom={zoom} />
                                        <div className="h-5 px-2 flex items-center justify-between text-[10px] font-bold text-white/90 truncate relative z-10" style={{ backgroundColor: clipColor }}>
                                            <span className="truncate">{clip.name}</span>
                                        </div>
                                        <div className="absolute inset-0 top-5 bottom-0 bg-black/40 pointer-events-none"><Waveform bufferKey={clip.bufferKey} color={clipColor} /></div>
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
                
                <div className="absolute top-0 bottom-0 z-30 w-px bg-red-500 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ left: headerWidth + (currentTime * zoom) }} />
            </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-6 bg-zinc-900/90 backdrop-blur-xl px-8 py-3 rounded-2xl border border-zinc-700/50 shadow-2xl">
            <button onClick={onStop} className="group"><div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-active:scale-95 transition-all shadow-inner"><Square fill="currentColor" size={12} className="text-zinc-400 group-hover:text-white" /></div></button>
            <button onClick={onRecord} className="group relative"><div className={`w-14 h-14 rounded-full flex items-center justify-center group-active:scale-95 transition-all shadow-lg border-4 border-zinc-800 ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'}`}><Circle fill="white" size={16} className="text-white" /></div></button>
            <button onClick={onPlayPause} className="group"><div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-active:scale-95 transition-all shadow-inner">{isPlaying ? <Pause fill="currentColor" size={14} className="text-zinc-200" /> : <Play fill="currentColor" size={14} className="text-zinc-200 ml-0.5" />}</div></button>
      </div>
      
      {contextMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onKeyDown={(e) => { if(e.key === 'Escape') setContextMenu(null) }} role="presentation">
            <div className="absolute bg-zinc-800 border border-zinc-700 shadow-2xl rounded-xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in-95 duration-100 py-1" style={{ left: Math.min(window.innerWidth - 170, contextMenu.x), top: Math.min(window.innerHeight - 200, contextMenu.y) }}>
                <div className="px-4 py-2 flex items-center justify-between gap-1 border-b border-zinc-700/50">
                    {CLIP_COLORS.map(color => (
                        <button key={color} onClick={(e) => { e.stopPropagation(); handleColorChange(color); }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: color }} />
                    ))}
                </div>
                <button onClick={handleDuplicate} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center space-x-2"><Copy size={14} /> <span>Duplicate</span></button>
                <div className="h-px bg-zinc-700 mx-2 my-1" />
                <button onClick={handleRename} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center space-x-2"><Edit2 size={14} /> <span>Rename</span></button>
                <div className="h-px bg-zinc-700 mx-2 my-1" />
                <button onClick={handleDelete} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700 flex items-center space-x-2"><Trash2 size={14} /> <span>Delete</span></button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Arranger;
