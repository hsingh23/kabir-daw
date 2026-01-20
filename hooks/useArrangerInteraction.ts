
import { useState, useRef } from 'react';
import { ProjectState, Clip, ToolMode } from '../types';
import { analytics } from '../services/analytics';
import { formatBars, formatTime } from '../services/utils';
import { audio } from '../services/audio';
import { useTimelineNavigation } from './useTimelineNavigation';

interface InteractionProps {
    project: ProjectState;
    updateProject: (recipe: any) => void; // Renamed from setProject for consistency
    zoom: number;
    setZoom: (z: number) => void;
    tool: ToolMode;
    snapGrid: number;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    headerWidth: number;
    trackHeight: number;
    onSelectTrack: (id: string) => void;
    onSelectClip: (ids: string[]) => void;
    selectedClipIds: string[];
    onSplit: (clipId: string, time: number) => void;
    onSeek: (time: number) => void;
    onMoveTrack?: (from: number, to: number) => void;
    multiSelectMode: boolean;
    secondsPerBeat: number;
    snapLineRef: React.RefObject<HTMLDivElement | null>;
    selectionBoxRef: React.RefObject<HTMLDivElement | null>;
    snapLabelRef: React.RefObject<HTMLDivElement | null>;
    commitTransaction: () => void;
}

export const useArrangerInteraction = ({
    project, updateProject, zoom, setZoom, tool, snapGrid, scrollContainerRef,
    headerWidth, trackHeight, onSelectTrack, onSelectClip, selectedClipIds,
    onSplit, onSeek, onMoveTrack, multiSelectMode, secondsPerBeat,
    snapLineRef, selectionBoxRef, snapLabelRef, commitTransaction
}: InteractionProps) => {
    
    const isDraggingRef = useRef<boolean>(false);
    const cachedContainerRect = useRef<DOMRect | null>(null);

    const { handleWheel, handleTouchZoomStart, handleTouchZoomMove, handleTouchZoomEnd, activePointers } = 
        useTimelineNavigation(zoom, setZoom, scrollContainerRef);

    const [dragState, setDragState] = useState<{
        initialClips: { id: string, start: number }[]; 
        mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT' | 'GAIN' | 'STRETCH';
        startX: number;
        startY: number;
        clipId: string;
        original: Clip; 
        pointerId: number;
    } | null>(null);

    const selectionStart = useRef<{x: number, y: number} | null>(null);
    const [loopDrag, setLoopDrag] = useState<{ mode: 'START' | 'END' | 'MOVE', startX: number, initialStart: number, initialEnd: number, pointerId: number } | null>(null);
    const [trackDrag, setTrackDrag] = useState<{ id: string, startY: number, originalIndex: number, currentIndex: number, pointerId: number } | null>(null);
    const [isScrubbing, setIsScrubbing] = useState<{ active: boolean, pointerId: number | null }>({ active: false, pointerId: null });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);

    const scrollInterval = useRef<number>(0);
    
    const longPressTimer = useRef<number>(0);
    const pointerDownPos = useRef<{x: number, y: number} | null>(null);
    const snapTrackedRef = useRef<boolean>(false);

    const updateSnapLine = (time: number | null) => {
        if (!snapLineRef.current || !snapLabelRef.current) return;
        if (time === null) {
            snapLineRef.current.style.display = 'none';
            return;
        }
        const left = time * zoom;
        snapLineRef.current.style.display = 'block';
        snapLineRef.current.style.left = `${left}px`;
        const label = snapGrid > 0 ? formatBars(time, project.bpm) : formatTime(time);
        snapLabelRef.current.textContent = label;
    };

    const updateSelectionBox = (currentX: number, currentY: number) => {
        if (!selectionBoxRef.current || !selectionStart.current || !scrollContainerRef.current) return;
        
        const rect = cachedContainerRect.current || scrollContainerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const scrollTop = scrollContainerRef.current.scrollTop;

        const x1 = selectionStart.current.x;
        const y1 = selectionStart.current.y;
        const x2 = currentX;
        const y2 = currentY;

        const relX = Math.min(x1, x2) - rect.left + scrollLeft - headerWidth;
        const relY = Math.min(y1, y2) - rect.top + scrollTop;
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        selectionBoxRef.current.style.display = 'block';
        selectionBoxRef.current.style.left = `${relX}px`;
        selectionBoxRef.current.style.top = `${relY}px`;
        selectionBoxRef.current.style.width = `${width}px`;
        selectionBoxRef.current.style.height = `${height}px`;
    };

    const calculateSeekTime = (clientX: number, snap: boolean) => {
        const rect = cachedContainerRect.current || scrollContainerRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const time = Math.max(0, (clientX - rect.left + scrollLeft) / zoom); 
        if (snap && snapGrid > 0) {
            const snapSeconds = snapGrid * secondsPerBeat;
            return Math.round(time / snapSeconds) * snapSeconds;
        }
        return time;
    };

    const handleClipPointerDown = (e: React.PointerEvent, clip: Clip, mode: 'MOVE' | 'TRIM_START' | 'TRIM_END' | 'FADE_IN' | 'FADE_OUT' | 'GAIN' | 'STRETCH') => {
        if (tool === ToolMode.HAND) return;

        e.stopPropagation();
        commitTransaction(); 
        
        if (scrollContainerRef.current) {
            cachedContainerRect.current = scrollContainerRef.current.getBoundingClientRect();
        }

        isDraggingRef.current = false;
        snapTrackedRef.current = false;

        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        longPressTimer.current = window.setTimeout(() => {
            if (mode === 'MOVE') { 
                setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
                setDragState(null);
                updateSnapLine(null);
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, 500);

        if (e.button === 2) {
            e.preventDefault();
            clearTimeout(longPressTimer.current);
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
            updateProject(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== clip.id) }));
            analytics.track('clip_action', { action: 'delete', source: 'eraser_tool' });
            return;
        }

        (e.target as Element).setPointerCapture(e.pointerId);
        
        if (e.altKey && mode === 'MOVE') {
            const clipsToCloneIds = isSelected ? newSelectedIds : [clip.id];
            const newClips: Clip[] = [];
            const clipsToClone = project.clips.filter(c => clipsToCloneIds.includes(c.id));
            clipsToClone.forEach(c => {
                newClips.push({ ...c, id: crypto.randomUUID(), name: `${c.name} (Copy)` });
            });
            const updatedProject = { ...project, clips: [...project.clips, ...newClips] };
            updateProject(updatedProject);
            analytics.track('clip_action', { action: 'duplicate', count: newClips.length });
            const newIds = newClips.map(c => c.id);
            onSelectClip(newIds);
            const clickedOriginalIndex = clipsToCloneIds.indexOf(clip.id);
            const activeNewClip = newClips[clickedOriginalIndex !== -1 ? clickedOriginalIndex : 0];
            const initialClips = newClips.map(c => ({ id: c.id, start: c.start }));
            
            setDragState({
                initialClips,
                clipId: activeNewClip.id,
                mode,
                startX: e.clientX,
                startY: e.clientY,
                original: { ...activeNewClip },
                pointerId: e.pointerId
            });
            return;
        }

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
        if (tool === ToolMode.HAND) return;
        e.stopPropagation();
        e.preventDefault();
        commitTransaction();
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
        if (scrollContainerRef.current) {
            cachedContainerRect.current = scrollContainerRef.current.getBoundingClientRect();
        }

        const isZooming = handleTouchZoomStart(e);
        if (isZooming) return;

        if (!dragState && !loopDrag && !trackDrag && !isScrubbing.active && activePointers.current.size === 1) {
             if (tool === ToolMode.HAND) return;
             if (e.shiftKey || multiSelectMode || tool === ToolMode.POINTER) {
                 selectionStart.current = { x: e.clientX, y: e.clientY };
                 (e.currentTarget as Element).setPointerCapture(e.pointerId);
             }
        }
    };

    const handleGlobalPointerMove = (e: React.PointerEvent) => {
        const isZooming = handleTouchZoomMove(e);
        if (isZooming) return;

        if (pointerDownPos.current) {
            const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
            if (dist > 15) {
                clearTimeout(longPressTimer.current);
                pointerDownPos.current = null;
            }
        }

        if (dragState || loopDrag || selectionStart.current || trackDrag) {
            isDraggingRef.current = true;
            const scrollContainer = scrollContainerRef.current;
            const rect = cachedContainerRect.current;
            
            if (scrollContainer && rect) {
                const edgeThreshold = 50; 
                const relX = e.clientX - rect.left;
                let scrollSpeed = 0;
                if (relX < edgeThreshold) scrollSpeed = -10; 
                else if (relX > rect.width - edgeThreshold) scrollSpeed = 10;

                if (scrollSpeed !== 0) {
                    if (!scrollInterval.current) {
                        scrollInterval.current = window.setInterval(() => {
                            if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft += scrollSpeed;
                        }, 16);
                    }
                } else {
                    if (scrollInterval.current) {
                        clearInterval(scrollInterval.current);
                        scrollInterval.current = 0;
                    }
                }
            }
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
                updateProject(p => ({...p, loopStart: Math.max(0, start), loopEnd: Math.max(0.1, end)}));
            } else if (loopDrag.mode === 'START') {
                 let start = loopDrag.initialStart + deltaSeconds;
                 if (snapSeconds > 0) start = Math.round(start / snapSeconds) * snapSeconds;
                 updateProject(p => ({...p, loopStart: Math.min(Math.max(0, start), p.loopEnd - 0.1) }));
            } else if (loopDrag.mode === 'END') {
                 let end = loopDrag.initialEnd + deltaSeconds;
                 if (snapSeconds > 0) end = Math.round(end / snapSeconds) * snapSeconds;
                 updateProject(p => ({...p, loopEnd: Math.max(p.loopStart + 0.1, end) }));
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
                
                updateSnapLine(primaryNewStart);
                
                if (snapSeconds > 0 && !snapTrackedRef.current) {
                    analytics.track('arranger_snap_engaged');
                    snapTrackedRef.current = true;
                }

                updateProject(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => {
                        const init = dragState.initialClips.find(i => i.id === c.id);
                        if (init) {
                            let targetTrackId = c.trackId;
                            if (c.id === dragState.clipId && scrollContainerRef.current) {
                                  // Use cached rect
                                  const containerRect = cachedContainerRect.current || scrollContainerRef.current.getBoundingClientRect();
                                  const relativeY = (e.clientY - containerRect.top) + scrollContainerRef.current.scrollTop - 32; 
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
            } else if (dragState.mode === 'GAIN') {
                const deltaY = dragState.startY - e.clientY; 
                const sensitivity = 0.01;
                const newGain = Math.max(0, Math.min(2.0, (dragState.original.gain || 1.0) + deltaY * sensitivity));
                audio.setClipGain(dragState.clipId, newGain);
                updateProject(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => c.id === dragState.clipId ? { ...c, gain: newGain } : c)
                }));
            } else if (dragState.mode === 'STRETCH') {
                const { original } = dragState;
                const rawNewEnd = original.start + original.duration + deltaSeconds;
                const snappedEnd = snapSeconds > 0 ? Math.round(rawNewEnd/snapSeconds)*snapSeconds : rawNewEnd;
                const newDuration = Math.max(0.1, snappedEnd - original.start);
                const ratio = original.duration / newDuration;
                const newSpeed = (original.speed || 1) * ratio;
                updateSnapLine(snappedEnd);
                updateProject(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => c.id === dragState.clipId ? { ...c, duration: newDuration, speed: newSpeed } : c)
                }));
            } else {
               const { original } = dragState;
               let newStart = original.start, newDuration = original.duration, newOffset = original.offset;
               
               if (dragState.mode === 'TRIM_START') {
                   const rawNewStart = original.start + deltaSeconds;
                   let snappedStart = snapSeconds > 0 ? Math.round(rawNewStart/snapSeconds)*snapSeconds : rawNewStart;
                   const shift = snappedStart - original.start;
                   const potentialOffset = original.offset + (shift * (original.speed||1));
                   
                   if (potentialOffset < 0) {
                       const maxReverseShift = -(original.offset / (original.speed||1));
                       snappedStart = original.start + maxReverseShift;
                   }

                   if (shift < original.duration) {
                       newStart = snappedStart;
                       newOffset = Math.max(0, original.offset + ((newStart - original.start) * (original.speed||1)));
                       newDuration = original.duration - (newStart - original.start);
                   }
                   updateSnapLine(newStart);
               } else if (dragState.mode === 'TRIM_END') {
                   const rawNewEnd = original.start + original.duration + deltaSeconds;
                   const snappedEnd = snapSeconds > 0 ? Math.round(rawNewEnd/snapSeconds)*snapSeconds : rawNewEnd;
                   newDuration = Math.max(0.1, snappedEnd - original.start);
                   updateSnapLine(snappedEnd);
               } else if (dragState.mode === 'FADE_IN') {
                   const rawVal = Math.max(0, deltaSeconds);
                   updateProject(prev => ({...prev, clips: prev.clips.map(c => c.id === dragState.clipId ? {...c, fadeIn: Math.min(c.duration, rawVal)} : c)}));
                   return;
               } else if (dragState.mode === 'FADE_OUT') {
                   const rawVal = Math.max(0, -deltaSeconds);
                   updateProject(prev => ({...prev, clips: prev.clips.map(c => c.id === dragState.clipId ? {...c, fadeOut: Math.min(c.duration, rawVal)} : c)}));
                   return;
               }
               updateProject(prev => ({
                   ...prev,
                   clips: prev.clips.map(c => c.id === dragState.clipId ? { ...c, start: newStart, duration: newDuration, offset: newOffset } : c)
               }));
            }
        }
        
        if (selectionStart.current) {
            updateSelectionBox(e.clientX, e.clientY);
        }
    };

    const handleGlobalPointerUp = (e: React.PointerEvent) => {
        handleTouchZoomEnd(e);
        cachedContainerRect.current = null; 

        clearTimeout(longPressTimer.current);
        pointerDownPos.current = null;
        if (scrollInterval.current) {
            clearInterval(scrollInterval.current);
            scrollInterval.current = 0;
        }
        
        if (selectionStart.current && scrollContainerRef.current) {
            const rect = scrollContainerRef.current.getBoundingClientRect();
            const scrollLeft = scrollContainerRef.current.scrollLeft;
            const scrollTop = scrollContainerRef.current.scrollTop;
            const x1 = Math.min(selectionStart.current.x, e.clientX) - rect.left + scrollLeft;
            const x2 = Math.max(selectionStart.current.x, e.clientX) - rect.left + scrollLeft;
            const y1 = Math.min(selectionStart.current.y, e.clientY) - rect.top + scrollTop;
            const y2 = Math.max(selectionStart.current.y, e.clientY) - rect.top + scrollTop;
            const startTime = Math.max(0, x1 / zoom);
            const endTime = Math.max(0, x2 / zoom);
            const rulerHeight = 32;
            const trackStartY = y1 - rulerHeight;
            const trackEndY = y2 - rulerHeight;
            const startTrackIndex = Math.floor(trackStartY / trackHeight);
            const endTrackIndex = Math.floor(trackEndY / trackHeight);
            
            const selectedIds: string[] = [];
            project.tracks.forEach((track, index) => {
                if (index >= startTrackIndex && index <= endTrackIndex) {
                    const trackClips = project.clips.filter(c => c.trackId === track.id);
                    trackClips.forEach(clip => {
                        const clipEnd = clip.start + clip.duration;
                        if (clip.start < endTime && clipEnd > startTime) {
                            selectedIds.push(clip.id);
                        }
                    });
                }
            });
            if (selectedIds.length > 0 || !multiSelectMode) {
                 onSelectClip(selectedIds);
                 if (selectedIds.length > 1) analytics.track('arranger_marquee_selection', { count: selectedIds.length });
            }
        }

        setDragState(null);
        updateSnapLine(null);
        setIsScrubbing({ active: false, pointerId: null });
        setLoopDrag(null);
        setTrackDrag(null);
        selectionStart.current = null;
        if (selectionBoxRef.current) selectionBoxRef.current.style.display = 'none';
        if (e.target instanceof Element) (e.target as Element).releasePointerCapture(e.pointerId);
    };

    return {
        dragState,
        loopDrag,
        trackDrag,
        isScrubbing,
        contextMenu,
        setContextMenu,
        setIsScrubbing,
        setLoopDrag,
        handleClipPointerDown,
        handleTrackDragStart,
        handleGlobalPointerDown,
        handleGlobalPointerMove,
        handleGlobalPointerUp,
        handleWheel,
        calculateSeekTime
    };
};
