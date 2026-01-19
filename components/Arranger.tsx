
import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, ToolMode, Track, Marker } from '../types';
import Waveform from './Waveform';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import LevelMeter from './LevelMeter';
import { audio } from '../services/audio';
import { Scissors, MousePointer, Trash2, Repeat, ZoomIn, ZoomOut, Grid, Activity, Mic, Music, Drum, Guitar, Keyboard, Sliders, Copy, Play, Pause, Square, Circle, Zap, GripVertical, Edit2, Music2, X, Palette, Volume2, Bookmark, CheckSquare, Maximize, AlignStartVertical, Split, Gauge, MoreVertical } from 'lucide-react';

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
    
    const speed = clip.speed || 1;
    const effectiveBufferDuration = buffer.duration / speed;
    
    if (effectiveBufferDuration === 0) return null;
    
    const O = clip.offset; // offset in buffer seconds
    // effective offset in timeline seconds
    const effectiveOffset = O / speed;
    
    const D = clip.duration; // Timeline duration
    
    const markers = [];
    // Calculate first loop point relative to clip start
    let k = Math.ceil(effectiveOffset / effectiveBufferDuration);
    if (k * effectiveBufferDuration - effectiveOffset <= 0.001) k++; 
    
    let time = k * effectiveBufferDuration - effectiveOffset;
    
    while (time < D) {
        markers.push(time);
        time += effectiveBufferDuration;
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
  const trackHeaderRef = useRef<HTMLDivElement>(null);

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
      initialClips: { id: string, start: number }[]; 
      mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT';
      startX: number;
      startY: number;
      clipId: string;
      original: Clip; 
      pointerId: number;
  } | null>(null);

  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  
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
    const timelineX = contentX - headerWidth; // Actually header is separate now, layout logic changed
    // Wait, in the layout below, scrollContainer is the right pane.
    // So clientX - rect.left + scrollLeft is correct coordinate in pixels inside timeline.
    // But header is outside scrollContainer in X axis.
    // So time = (contentX) / zoom
    const time = Math.max(0, (clientX - rect.left + scrollLeft) / zoom);
    
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

  // --- Background Interaction (Marquee) ---
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
      // Only start marquee if Shift is held OR Multi-Select mode is active
      if (multiSelectMode || e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          setSelectionBox({
              startX: e.clientX,
              startY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY
          });
          
          // If not shift, clear previous selection to start new group
          if (!e.shiftKey) {
              onSelectClip([]);
          }
      }
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
               // Toggle logic
               if (isSelected && (e.ctrlKey || e.metaKey || multiSelectMode)) {
                   // If toggling off, we do it immediately but return to avoid drag
                   newSelectedIds = newSelectedIds.filter(id => id !== clip.id);
                   onSelectClip(newSelectedIds);
                   return; 
               } 
            } else {
               newSelectedIds.push(clip.id);
               onSelectClip(newSelectedIds);
            }
        } else {
            // Normal click
            if (!isSelected) {
                newSelectedIds = [clip.id];
                onSelectClip(newSelectedIds);
            }
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

    if (selectionBox) {
        setSelectionBox(prev => prev ? ({ ...prev, currentX: e.clientX, currentY: e.clientY }) : null);
        return;
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
        const rect = scrollContainer.getBoundingClientRect(); // Using container rect for logic
        // But headers are in separate container. 
        // We can approximate by Y position on screen.
        const relativeY = (e.clientY - rect.top) + scrollContainer.scrollTop - 32; // -32 for ruler
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
            let primaryNewStart = original.start + deltaSeconds;
            if (activeSnapSeconds > 0) primaryNewStart = Math.round(primaryNewStart / activeSnapSeconds) * activeSnapSeconds;
            const primaryDelta = Math.max(0, primaryNewStart) - original.start;

            setProject(prev => ({
                ...prev,
                clips: prev.clips.map(c => {
                    const init = dragState.initialClips.find(ic => ic.id === c.id);
                    if (init) {
                        let newStart = init.start + primaryDelta;
                        if (newStart < 0) newStart = 0; 
                        
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
            if (dragState.mode === 'TRIM_START') {
                let newStart = original.start + deltaSeconds;
                if (activeSnapSeconds > 0) newStart = Math.round(newStart / activeSnapSeconds) * activeSnapSeconds;
                const effectiveDelta = newStart - original.start;
                const maxDelta = original.duration - 0.1;
                const minDelta = -original.offset;
                const clampedDelta = Math.min(maxDelta, Math.max(minDelta, effectiveDelta));
                
                const speed = original.speed || 1;
                const bufferDelta = clampedDelta * speed;

                updatedClip.start = original.start + clampedDelta;
                updatedClip.offset = original.offset + bufferDelta;
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

    if (selectionBox) {
        const rect = scrollContainerRef.current?.getBoundingClientRect();
        if (rect) {
            const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
            const scrollTop = scrollContainerRef.current?.scrollTop || 0;
            
            // Adjust coordinates because headerWidth is outside scroll container
            // In handleBackgroundPointerDown, startX was clientX. 
            // We need to convert clientX to timeline X (time * zoom).
            // contentX = clientX - rect.left + scrollLeft.
            
            const x1 = Math.min(selectionBox.startX, selectionBox.currentX) - rect.left + scrollLeft;
            const x2 = Math.max(selectionBox.startX, selectionBox.currentX) - rect.left + scrollLeft;
            const y1 = Math.min(selectionBox.startY, selectionBox.currentY) - rect.top + scrollTop;
            const y2 = Math.max(selectionBox.startY, selectionBox.currentY) - rect.top + scrollTop;
            
            const t1 = x1 / zoom;
            const t2 = x2 / zoom;
            
            const intersectIds = project.clips.filter(clip => {
                const clipEnd = clip.start + clip.duration;
                const timeOverlap = Math.max(0, Math.min(clipEnd, t2) - Math.max(clip.start, t1)) > 0;
                
                if (!timeOverlap) return false;

                const trackIndex = project.tracks.findIndex(t => t.id === clip.trackId);
                if (trackIndex === -1) return false;
                
                const trackTop = trackIndex * TRACK_HEIGHT;
                const trackBottom = trackTop + TRACK_HEIGHT;
                
                const yOverlap = Math.max(0, Math.min(trackBottom, y2) - Math.max(trackTop, y1)) > 0;
                return yOverlap;
            }).map(c => c.id);
            
            const finalSelection = e.shiftKey ? [...new Set([...selectedClipIds, ...intersectIds])] : intersectIds;
            onSelectClip(finalSelection);
        }
        setSelectionBox(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
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
  
  const handleQuantize = () => {
      if (contextMenu) {
          const clip = project.clips.find(c => c.id === contextMenu.clipId);
          if (clip) {
              const snap = snapGrid > 0 ? snapGrid : 1;
              const secondsPerGrid = (60 / project.bpm) * snap;
              const newStart = Math.round(clip.start / secondsPerGrid) * secondsPerGrid;
              setProject(prev => ({
                  ...prev,
                  clips: prev.clips.map(c => c.id === clip.id ? { ...c, start: newStart } : c)
              }));
          }
          setContextMenu(null);
      }
  };

  const handleChangeSpeed = () => {
      if (contextMenu) {
          const clip = project.clips.find(c => c.id === contextMenu.clipId);
          if (clip) {
              const currentSpeed = clip.speed || 1;
              const newSpeedStr = prompt("Playback Speed (e.g. 0.5, 1, 1.5, 2):", currentSpeed.toString());
              if (newSpeedStr !== null) {
                  const newSpeed = parseFloat(newSpeedStr);
                  if (!isNaN(newSpeed) && newSpeed > 0) {
                      setProject(prev => ({
                          ...prev,
                          clips: prev.clips.map(c => c.id === clip.id ? { ...c, speed: newSpeed } : c)
                      }));
                  }
              }
          }
          setContextMenu(null);
      }
  };

  const handleSplitContextMenu = () => {
      if (contextMenu) {
          const container = scrollContainerRef.current;
          if (container) {
              const rect = container.getBoundingClientRect();
              const scrollLeft = container.scrollLeft;
              // X in container
              const clickX = contextMenu.x - rect.left + scrollLeft;
              const time = Math.max(0, clickX / zoom);
              onSplit(contextMenu.clipId, time);
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
  
  const zoomToFit = () => {
      if (project.clips.length === 0) return;
      const end = Math.max(...project.clips.map(c => c.start + c.duration), project.loopEnd);
      if (end === 0) return;
      
      const containerWidth = window.innerWidth - headerWidth - 40; 
      const newZoom = containerWidth / end;
      setZoom(Math.max(10, Math.min(400, newZoom)));
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
             <button onClick={zoomToFit} className="p-1.5 rounded-md text-zinc-500 hover:text-white transition-all bg-zinc-900 border border-zinc-800" title="Zoom to Fit">
                 <Maximize size={14} />
             </button>
             <button onClick={() => setShowBacking(!showBacking)} className={`flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-400 hover:text-white transition-colors ${showBacking ? 'border-studio-accent text-studio-accent' : ''}`}>
                <Music2 size={14} />
             </button>
             <button onClick={() => setProject(p => ({...p, isLooping: !p.isLooping}))} className={`p-1.5 rounded-md transition-all ${project.isLooping ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <Repeat size={16} />
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Track Headers (Left Pane) */}
        <div 
             ref={trackHeaderRef}
             className="flex-none bg-zinc-900 border-r border-zinc-800 z-20 flex flex-col" 
             style={{ width: headerWidth }}
        >
             <div className="h-8 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
                 <span className="text-[10px] text-zinc-500 font-bold">TRACKS</span>
             </div> 
             <div className="flex-1 overflow-hidden relative">
                 <div style={{ transform: `translateY(-${scrollContainerRef.current?.scrollTop || 0}px)` }}>
                    {project.tracks.map((track, i) => (
                        <div 
                            key={track.id} 
                            className={`border-b border-zinc-800 relative group transition-colors select-none ${selectedTrackId === track.id ? 'bg-zinc-800' : 'bg-transparent'}`}
                            style={{ height: TRACK_HEIGHT }}
                            onPointerDown={(e) => {
                                onSelectTrack(track.id);
                                if (e.target === e.currentTarget) {
                                    // Drag reorder logic could start here if clicking empty space
                                }
                            }}
                            onDoubleClick={() => onOpenInspector(track.id)}
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: track.color }} />
                            <div className="p-2 pl-3 flex flex-col h-full justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="cursor-grab text-zinc-600 hover:text-zinc-400" onPointerDown={(e) => handleTrackDragStart(e, track.id, i)}>
                                        <GripVertical size={14} />
                                    </div>
                                    <TrackIcon name={track.name} color={track.color} />
                                    <span 
                                        className="font-bold text-zinc-300 truncate w-20 cursor-text"
                                        onDoubleClick={(e) => handleTrackNameDoubleClick(e, track.id, track.name)}
                                    >
                                        {track.name}
                                    </span>
                                </div>
                                <div className="flex space-x-1">
                                    <div className={`text-[9px] px-1 rounded ${track.muted ? 'bg-red-900 text-red-300' : 'bg-zinc-800 text-zinc-500'}`}>M</div>
                                    <div className={`text-[9px] px-1 rounded ${track.solo ? 'bg-yellow-900 text-yellow-300' : 'bg-zinc-800 text-zinc-500'}`}>S</div>
                                    <div className="text-[9px] text-zinc-500 ml-auto">{Math.round(track.volume * 100)}%</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Ghost track for drag */}
                    {trackDrag && (
                        <div 
                            className="absolute left-0 right-0 bg-studio-accent/20 border-t-2 border-studio-accent pointer-events-none z-50"
                            style={{ height: TRACK_HEIGHT, top: trackDrag.currentIndex * TRACK_HEIGHT }}
                        />
                    )}
                 </div>
             </div>
        </div>

        {/* Timeline (Right Pane) */}
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-auto relative bg-zinc-950/50"
            onPointerDown={handleBackgroundPointerDown}
            onWheel={handleWheel}
            onScroll={() => {
                if (trackHeaderRef.current) {
                    // Force update for sync scrolling if needed, or rely on state
                    // Here we rely on React re-render of transform or we can directly manipulate DOM for perf
                    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
                    // Directly manipulating header container for perf
                    const container = trackHeaderRef.current.querySelector('div[style*="translateY"]');
                    if (container) (container as HTMLElement).style.transform = `translateY(-${scrollTop}px)`;
                }
            }}
        >
            <div style={{ width: totalWidth, minWidth: '100%', height: project.tracks.length * TRACK_HEIGHT + 32 }}>
                {/* Grid */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                        backgroundSize: gridSize, 
                        backgroundImage: gridImage,
                        top: 32 // below ruler
                    }} 
                />

                {/* Ruler */}
                <div 
                    className="sticky top-0 h-8 bg-zinc-900/90 backdrop-blur z-20 border-b border-zinc-700 cursor-pointer text-[10px] text-zinc-500 select-none"
                    onPointerDown={handleRulerPointerDown}
                >
                    {Array.from({ length: totalBars }).map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-700 pl-1 pt-1" style={{ left: i * pixelsPerBar }}>
                            {i + 1}
                        </div>
                    ))}
                    
                    {/* Markers */}
                    {project.markers.map(marker => (
                        <div 
                            key={marker.id}
                            className="absolute top-0 h-8 flex items-center group z-30"
                            style={{ left: marker.time * zoom }}
                            onPointerDown={(e) => handleMarkerPointerDown(e, marker)}
                            onDoubleClick={(e) => handleMarkerDoubleClick(e, marker)}
                        >
                            <div className="w-0.5 h-full bg-yellow-500/50 group-hover:bg-yellow-500" />
                            <div className="bg-yellow-500/20 px-1 rounded text-yellow-500 font-bold truncate max-w-[100px] border border-yellow-500/50 text-[9px]">
                                {marker.text}
                            </div>
                        </div>
                    ))}

                    {/* Loop Bracket */}
                    {project.isLooping && (
                        <>
                            <div 
                                className="absolute top-0 h-4 bg-zinc-400/30 border-l-2 border-zinc-400 cursor-ew-resize z-40"
                                style={{ left: project.loopStart * zoom, width: (project.loopEnd - project.loopStart) * zoom }}
                                onPointerDown={(e) => handleLoopPointerDown(e, 'move')}
                            >
                                <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                            </div>
                            <div 
                                className="absolute top-0 h-8 w-4 -ml-2 cursor-ew-resize z-50 group flex justify-center"
                                style={{ left: project.loopStart * zoom }}
                                onPointerDown={(e) => handleLoopPointerDown(e, 'start')}
                            >
                                <div className="w-0.5 h-full bg-blue-400 group-hover:bg-blue-300" />
                            </div>
                            <div 
                                className="absolute top-0 h-8 w-4 -ml-2 cursor-ew-resize z-50 group flex justify-center"
                                style={{ left: project.loopEnd * zoom }}
                                onPointerDown={(e) => handleLoopPointerDown(e, 'end')}
                            >
                                <div className="w-0.5 h-full bg-blue-400 group-hover:bg-blue-300" />
                            </div>
                        </>
                    )}
                </div>

                {/* Tracks Area */}
                <div className="relative" style={{ height: project.tracks.length * TRACK_HEIGHT }}>
                    {project.tracks.map((track, i) => (
                         <div key={track.id} className="absolute w-full border-b border-zinc-800/30" style={{ top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }}>
                              {project.clips.filter(c => c.trackId === track.id).map(clip => {
                                  const isSelected = selectedClipIds.includes(clip.id);
                                  return (
                                      <div 
                                        key={clip.id}
                                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden border transition-colors ${isSelected ? 'border-white ring-1 ring-white z-10' : 'border-black/20 hover:border-white/50'}`}
                                        style={{ 
                                            left: clip.start * zoom, 
                                            width: clip.duration * zoom,
                                            backgroundColor: clip.color || CLIP_COLORS[Math.abs(clip.name.length) % CLIP_COLORS.length] 
                                        }}
                                        onPointerDown={(e) => handleClipPointerDown(e, clip, 'MOVE')}
                                      >
                                          {/* Waveform Background */}
                                          <div className="absolute inset-0 opacity-40 pointer-events-none">
                                               <Waveform bufferKey={clip.bufferKey} color="#000" />
                                          </div>
                                          
                                          {/* Clip Info */}
                                          <div className="absolute inset-0 p-1 flex flex-col justify-between pointer-events-none">
                                              <span className="text-[10px] font-bold text-black/70 truncate shadow-sm">{clip.name}</span>
                                          </div>
                                          
                                          {/* Loop Indicators */}
                                          <LoopMarkers clip={clip} zoom={zoom} />

                                          {/* Resize Handles */}
                                          {isSelected && (
                                              <>
                                                <div 
                                                    className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/20 z-20"
                                                    onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_START')}
                                                />
                                                <div 
                                                    className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/20 z-20"
                                                    onPointerDown={(e) => handleClipPointerDown(e, clip, 'TRIM_END')}
                                                />
                                                {/* Fade Handles */}
                                                <div 
                                                    className="absolute top-0 left-0 w-4 h-4 bg-white/50 rounded-br cursor-ne-resize z-20 opacity-0 group-hover:opacity-100"
                                                    style={{ transform: `translateX(${clip.fadeIn * zoom}px)` }}
                                                    onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_IN')}
                                                />
                                                <div 
                                                    className="absolute top-0 right-0 w-4 h-4 bg-white/50 rounded-bl cursor-nw-resize z-20 opacity-0 group-hover:opacity-100"
                                                    style={{ transform: `translateX(-${clip.fadeOut * zoom}px)` }}
                                                    onPointerDown={(e) => handleClipPointerDown(e, clip, 'FADE_OUT')}
                                                />
                                              </>
                                          )}
                                      </div>
                                  );
                              })}
                         </div>
                    ))}
                    
                    {/* Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                        style={{ left: currentTime * zoom }}
                    >
                         <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45 shadow-sm" />
                    </div>

                    {/* Backing Instruments Visual Overlay (Optional) */}
                    {showBacking && (
                         <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 pointer-events-none border-t border-white/10 flex items-center justify-center">
                             <span className="text-[9px] text-white/50 tracking-widest uppercase">Backing Track Active</span>
                         </div>
                    )}
                </div>
            </div>
        </div>

        {/* Floating Context Menu */}
        {contextMenu && (
             <div 
                className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px] flex flex-col"
                style={{ left: contextMenu.x, top: contextMenu.y }}
             >
                 <button onClick={handleRename} className="px-4 py-2 text-left hover:bg-zinc-700 flex items-center space-x-2"><Edit2 size={14} /> <span>Rename</span></button>
                 <button onClick={handleDuplicate} className="px-4 py-2 text-left hover:bg-zinc-700 flex items-center space-x-2"><Copy size={14} /> <span>Duplicate</span></button>
                 <button onClick={handleSplitContextMenu} className="px-4 py-2 text-left hover:bg-zinc-700 flex items-center space-x-2"><Split size={14} /> <span>Split</span></button>
                 <button onClick={handleQuantize} className="px-4 py-2 text-left hover:bg-zinc-700 flex items-center space-x-2"><AlignStartVertical size={14} /> <span>Quantize</span></button>
                 <button onClick={handleChangeSpeed} className="px-4 py-2 text-left hover:bg-zinc-700 flex items-center space-x-2"><Gauge size={14} /> <span>Speed</span></button>
                 
                 <div className="border-t border-zinc-700 my-1" />
                 
                 <div className="px-4 py-2 flex flex-wrap gap-1">
                     {CLIP_COLORS.map(c => (
                         <button 
                            key={c} 
                            className="w-4 h-4 rounded-full border border-black/20" 
                            style={{ backgroundColor: c }}
                            onClick={() => handleColorChange(c)}
                         />
                     ))}
                 </div>
                 
                 <div className="border-t border-zinc-700 my-1" />
                 
                 <button onClick={handleDelete} className="px-4 py-2 text-left hover:bg-red-900/50 text-red-400 flex items-center space-x-2"><Trash2 size={14} /> <span>Delete</span></button>
             </div>
        )}
        
        {/* Selection Box */}
        {selectionBox && (
            <div 
                className="absolute border border-blue-400 bg-blue-400/10 pointer-events-none z-50"
                style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX) - (scrollContainerRef.current?.getBoundingClientRect().left || 0) + (scrollContainerRef.current?.scrollLeft || 0) - headerWidth,
                    top: Math.min(selectionBox.startY, selectionBox.currentY) - (scrollContainerRef.current?.getBoundingClientRect().top || 0) + (scrollContainerRef.current?.scrollTop || 0),
                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                    height: Math.abs(selectionBox.currentY - selectionBox.startY)
                }}
            />
        )}

      </div>
    </div>
  );
};

export default Arranger;
