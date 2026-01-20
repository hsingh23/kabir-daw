
import { useEffect } from 'react';
import { ProjectState, Clip } from '../types';

interface UseKeyboardShortcutsProps {
    project: ProjectState;
    setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
    selectedClipIds: string[];
    setSelectedClipIds: (ids: string[]) => void;
    selectedTrackId: string | null;
    setSelectedTrackId: (id: string | null) => void;
    currentTime: number;
    isRecording: boolean;
    togglePlay: () => void;
    handleRecordToggle: () => void;
    undo: () => void;
    redo: () => void;
    setClipboard: (clips: Clip[]) => void;
    clipboard: Clip[];
    handleSplit: (clipId: string, time: number) => void;
    onSplitAtPlayhead: () => void;
    setShowShortcuts: (show: boolean) => void;
}

export const useKeyboardShortcuts = ({
    project,
    setProject,
    selectedClipIds,
    setSelectedClipIds,
    selectedTrackId,
    setSelectedTrackId,
    currentTime,
    isRecording,
    togglePlay,
    handleRecordToggle,
    undo,
    redo,
    setClipboard,
    clipboard,
    handleSplit,
    onSplitAtPlayhead,
    setShowShortcuts
}: UseKeyboardShortcutsProps) => {

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore inputs
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
              return;
            }
  
            // Shortcuts Dialog (?)
            if (e.key === '?') {
                setShowShortcuts(true); // Assuming toggle handled by parent if boolean passed or simple setter
                return;
            }
  
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                e.preventDefault();
                return;
            }
  
            // Metronome (M)
            if (e.key === 'm') {
                setProject(prev => ({ ...prev, metronomeOn: !prev.metronomeOn }));
                return;
            }
  
            // Loop Toggle (L)
            if (e.key === 'l') {
                setProject(prev => ({ ...prev, isLooping: !prev.isLooping }));
                return;
            }
  
            // Record Toggle (R)
            if (e.key === 'r') {
                handleRecordToggle();
                return;
            }
  
            // Copy (Cmd/Ctrl + C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
               if (selectedClipIds.length > 0) {
                   const clips = project.clips.filter(c => selectedClipIds.includes(c.id));
                   if (clips.length > 0) {
                       setClipboard(clips);
                       e.preventDefault();
                   }
               }
            }
  
            // Paste (Cmd/Ctrl + V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (clipboard.length > 0) {
                    const minStart = Math.min(...clipboard.map(c => c.start));
                    
                    const newClips = clipboard.map(clip => {
                        const offsetFromGroupStart = clip.start - minStart;
                        let targetTrackId = clip.trackId;
                        if (!project.tracks.find(t => t.id === targetTrackId)) {
                            targetTrackId = selectedTrackId || project.tracks[0].id;
                        }
                        if (clipboard.length === 1 && selectedTrackId) {
                            targetTrackId = selectedTrackId;
                        }
  
                        return {
                            ...clip,
                            id: crypto.randomUUID(),
                            trackId: targetTrackId,
                            start: currentTime + offsetFromGroupStart,
                            name: `${clip.name} (Copy)`,
                            speed: clip.speed || 1,
                            gain: clip.gain || 1.0
                        };
                    });
  
                    setProject(prev => ({ ...prev, clips: [...prev.clips, ...newClips] }));
                    setSelectedClipIds(newClips.map(c => c.id));
                    e.preventDefault();
                }
            }
  
            // Duplicate (Cmd/Ctrl + D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (selectedClipIds.length > 0) {
                    const clips = project.clips.filter(c => selectedClipIds.includes(c.id));
                    if (clips.length > 0) {
                        const newClips = clips.map(clip => ({
                            ...clip,
                            id: crypto.randomUUID(),
                            start: clip.start + clip.duration, // Append after
                            name: `${clip.name} (Dup)`,
                            speed: clip.speed || 1,
                            gain: clip.gain || 1.0
                        }));
                        setProject(prev => ({ ...prev, clips: [...prev.clips, ...newClips] }));
                        setSelectedClipIds(newClips.map(c => c.id));
                        e.preventDefault();
                    }
                }
            }
  
            // Split (Cmd/Ctrl + B)
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                onSplitAtPlayhead();
            }
  
            // Tab Navigation (Cycle Clips)
            if (e.key === 'Tab') {
                e.preventDefault();
                const sortedClips = [...project.clips].sort((a, b) => {
                    if (Math.abs(a.start - b.start) < 0.01) {
                        // If start time is similar, sort by track index
                        const trackIndexA = project.tracks.findIndex(t => t.id === a.trackId);
                        const trackIndexB = project.tracks.findIndex(t => t.id === b.trackId);
                        return trackIndexA - trackIndexB;
                    }
                    return a.start - b.start;
                });
  
                if (sortedClips.length === 0) return;
  
                let nextClipId;
                if (selectedClipIds.length === 0) {
                    nextClipId = sortedClips[0].id;
                } else {
                    const lastSelectedId = selectedClipIds[selectedClipIds.length - 1];
                    const currentIndex = sortedClips.findIndex(c => c.id === lastSelectedId);
                    
                    if (e.shiftKey) {
                        // Previous
                        const prevIndex = currentIndex <= 0 ? sortedClips.length - 1 : currentIndex - 1;
                        nextClipId = sortedClips[prevIndex].id;
                    } else {
                        // Next
                        const nextIndex = (currentIndex + 1) % sortedClips.length;
                        nextClipId = sortedClips[nextIndex].id;
                    }
                }
                
                setSelectedClipIds([nextClipId]);
                // Also ensure parent track is selected
                const clip = sortedClips.find(c => c.id === nextClipId);
                if (clip) setSelectedTrackId(clip.trackId);
            }
  
            // Nudge (Arrows)
            if (selectedClipIds.length > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const amount = e.shiftKey ? 0.1 : 0.01;
                const delta = e.key === 'ArrowLeft' ? -amount : amount;
                
                setProject(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => 
                        selectedClipIds.includes(c.id) 
                        ? { ...c, start: Math.max(0, c.start + delta) } 
                        : c
                    )
                }));
            }
            
            if (e.code === 'Space') {
                e.preventDefault();
                if (isRecording) {
                    handleRecordToggle();
                } else {
                    togglePlay();
                }
            }
  
            if (e.key === 'Delete' || e.key === 'Backspace') {
              if (selectedClipIds.length > 0 && !isRecording) {
                  setProject(prev => ({
                      ...prev,
                      clips: prev.clips.filter(c => !selectedClipIds.includes(c.id))
                  }));
                  setSelectedClipIds([]);
              }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [project, isRecording, togglePlay, undo, redo, selectedClipIds, handleRecordToggle, setProject, clipboard, currentTime, selectedTrackId, handleSplit, onSplitAtPlayhead, setSelectedClipIds, setSelectedTrackId, setClipboard, setShowShortcuts]); 
}
