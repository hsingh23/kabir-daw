import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import Library from './components/Library';
import TrackInspector from './components/TrackInspector';
import { audio } from './services/audio';
import { saveAudioBlob, saveProject, getProject } from './services/db';
import { moveItem } from './services/utils';
import { Mic, Music, LayoutGrid, Upload, Plus, Undo2, Redo2, Download } from 'lucide-react';

const INITIAL_PROJECT: ProjectState = {
  id: 'default-project',
  bpm: 120,
  tracks: [
    { id: '1', name: 'Drums', volume: 0.8, pan: 0, muted: false, solo: false, color: '#ef4444', eq: { low: 0, mid: 0, high: 0 } },
    { id: '2', name: 'Bass', volume: 0.7, pan: 0, muted: false, solo: false, color: '#3b82f6', eq: { low: 0, mid: 0, high: 0 } },
    { id: '3', name: 'Synth', volume: 0.6, pan: 0, muted: false, solo: false, color: '#a855f7', eq: { low: 0, mid: 0, high: 0 } },
    { id: '4', name: 'Vocals', volume: 0.9, pan: 0, muted: false, solo: false, color: '#eab308', eq: { low: 0, mid: 0, high: 0 } },
  ],
  clips: [],
  loopStart: 0,
  loopEnd: 8,
  isLooping: false,
  metronomeOn: false,
  masterVolume: 1.0,
  effects: { reverb: 0.2, delay: 0.1, chorus: 0.0 },
  tanpura: {
      enabled: false,
      volume: 0.5,
      key: 'C',
      tuning: 'Pa',
      tempo: 60
  },
  tabla: {
      enabled: false,
      volume: 0.5,
      taal: 'TeenTaal',
      bpm: 100,
      key: 'C'
  }
};

const App: React.FC = () => {
  // URL State Initialization
  const [view, setView] = useState<'mixer' | 'arranger' | 'library'>(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('view') as 'mixer' | 'arranger' | 'library') || 'mixer';
  });

  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); 
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('1');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  
  // Track Inspector Modal
  const [inspectorTrackId, setInspectorTrackId] = useState<string | null>(null);

  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Sync URL State
  useEffect(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.replaceState({}, '', url);
  }, [view]);

  // Load Project on Mount
  useEffect(() => {
      const load = async () => {
          const saved = await getProject('default-project');
          if (saved) {
              // Migration for new state fields
              const migrated = {
                  ...INITIAL_PROJECT,
                  ...saved,
                  effects: { ...INITIAL_PROJECT.effects, ...saved.effects },
                  tracks: saved.tracks.map((t: any) => ({
                      ...t,
                      eq: t.eq || { low: 0, mid: 0, high: 0 }
                  }))
              };
              setProject(migrated);
              for (const clip of migrated.clips) {
                  const blob = await import('./services/db').then(m => m.getAudioBlob(clip.bufferKey));
                  if (blob) {
                      await audio.loadAudio(clip.bufferKey, blob);
                  }
              }
          }
      };
      load();
  }, []);

  useEffect(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          saveProject(project);
      }, 2000) as unknown as number; 
  }, [project]);

  const updateProject = useCallback((value: React.SetStateAction<ProjectState>) => {
      setProject(current => {
          const next = typeof value === 'function' ? (value as (prev: ProjectState) => ProjectState)(current) : value;
          if (next !== current) {
              setPast(prev => [...prev.slice(-19), current]);
              setFuture([]);
          }
          return next;
      });
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
      updateProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
      }));
  }, [updateProject]);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      setFuture(prev => [project, ...prev]);
      setProject(previous);
      setPast(newPast);
  }, [past, project]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      setPast(prev => [...prev, project]);
      setProject(next);
      setFuture(newFuture);
  }, [future, project]);

  const togglePlay = useCallback(() => {
      setIsPlaying(prevIsPlaying => {
          if (isRecording) {
             return prevIsPlaying;
          }
          if (prevIsPlaying) {
              audio.pause();
              return false;
          } else {
              return true;
          }
      });
  }, [isRecording]);

  useEffect(() => {
     if (isPlaying && !audio.isPlaying) {
         audio.play(project.clips, project.tracks, currentTime);
     } else if (!isPlaying && audio.isPlaying) {
         audio.pause();
     }
  }, [isPlaying, currentTime, project.clips, project.tracks]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        audio.stop(); 
        const blob = await audio.stopRecording();
        setIsPlaying(false);
        setIsRecording(false);
        
        if (blob && selectedTrackId) {
            const key = crypto.randomUUID();
            await saveAudioBlob(key, blob);
            await audio.loadAudio(key, blob);
            
            const newClip: Clip = {
                id: crypto.randomUUID(),
                trackId: selectedTrackId,
                name: `Rec ${new Date().toLocaleTimeString()}`,
                start: recordingStartTime,
                offset: 0,
                duration: (await audio.loadAudio(key, blob)).duration,
                bufferKey: key,
                fadeIn: 0,
                fadeOut: 0
            };
            
            updateProject(prev => ({
                ...prev,
                clips: [...prev.clips, newClip]
            }));
            setSelectedClipId(newClip.id);
        }
    } else {
        if (!selectedTrackId) {
            alert("Select a track to record on first.");
            return;
        }
        try {
            await audio.startRecording();
            const startTime = currentTime;
            setRecordingStartTime(startTime);
            audio.play(project.clips, project.tracks, startTime);
            setIsPlaying(true);
            setIsRecording(true);
        } catch (_e) {
            alert("Could not start recording. Check microphone permissions.");
        }
    }
  }, [isRecording, selectedTrackId, recordingStartTime, currentTime, project.clips, project.tracks, updateProject]);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore inputs
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
          }

          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
              e.preventDefault();
              return;
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
            if (selectedClipId && !isRecording) {
                updateProject(prev => ({
                    ...prev,
                    clips: prev.clips.filter(c => c.id !== selectedClipId)
                }));
                setSelectedClipId(null);
            }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future, project, isRecording, togglePlay, undo, redo, selectedClipId, handleRecordToggle, updateProject]); 

  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.syncInstruments(project.tanpura, project.tabla);
    audio.setMasterVolume(project.masterVolume);
    audio.setDelayLevel(project.effects.delay);
    audio.setReverbLevel(project.effects.reverb);
    audio.setChorusLevel(project.effects.chorus);
    audio.bpm = project.bpm;
    audio.metronomeEnabled = project.metronomeOn;
  }, [project]);

  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        audio.scheduler();
        const time = audio.getCurrentTime();
        if (project.isLooping && time >= project.loopEnd && !isRecording) {
            audio.play(project.clips, project.tracks, project.loopStart);
            setCurrentTime(project.loopStart);
        } else {
            setCurrentTime(time);
        }
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    if (isPlaying) {
      loop();
    } else {
      cancelAnimationFrame(rafRef.current!);
    }
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, isRecording, project.isLooping, project.loopEnd, project.loopStart, project.clips, project.tracks]);

  const handlePlayPauseClick = useCallback(() => {
      if (isRecording) {
          handleRecordToggle();
          return;
      }
      togglePlay();
  }, [isRecording, handleRecordToggle, togglePlay]);

  const stop = useCallback(() => {
    if (isRecording) {
        handleRecordToggle();
        return;
    }
    audio.stop();
    setIsPlaying(false);
    setCurrentTime(project.isLooping ? project.loopStart : 0);
  }, [isRecording, handleRecordToggle, project.isLooping, project.loopStart]);

  const handleSeek = useCallback((time: number) => {
    if (isRecording) return;
    setCurrentTime(time);
    if (isPlaying) {
      audio.play(project.clips, project.tracks, time);
    }
  }, [isRecording, isPlaying, project.clips, project.tracks]);

  const handleExport = useCallback(async () => {
      if (project.clips.length === 0) {
          alert("Nothing to export!");
          return;
      }
      setIsExporting(true);
      if (isPlaying) stop();
      
      try {
          const blob = await audio.renderProject(project);
          if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `PocketStudio_Mix_${new Date().toISOString().slice(0,10)}.wav`;
              a.click();
              URL.revokeObjectURL(url);
          }
      } catch (e) {
          console.error(e);
          alert("Export failed.");
      } finally {
          setIsExporting(false);
      }
  }, [project, isPlaying, stop]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const key = crypto.randomUUID();
      
      await saveAudioBlob(key, file);
      await audio.loadAudio(key, file);

      const targetTrackId = selectedTrackId || project.tracks[0].id;
      const newClip: Clip = {
        id: crypto.randomUUID(),
        trackId: targetTrackId,
        name: file.name,
        start: currentTime,
        offset: 0,
        duration: audio.buffers.get(key)?.duration || 5, 
        bufferKey: key,
        fadeIn: 0,
        fadeOut: 0
      };

      updateProject(prev => ({
        ...prev,
        clips: [...prev.clips, newClip]
      }));
      setSelectedClipId(newClip.id);
    }
  }, [selectedTrackId, project.tracks, currentTime, updateProject]);

  const handleSplit = useCallback((clipId: string, time: number) => {
    const clip = project.clips.find(c => c.id === clipId);
    if (!clip) return;
    if (time <= clip.start || time >= clip.start + clip.duration) return;

    const splitOffset = time - clip.start;
    
    const clipA: Clip = {
        ...clip,
        duration: splitOffset,
        fadeOut: 0.05 
    };

    const clipB: Clip = {
        ...clip,
        id: crypto.randomUUID(),
        start: time,
        offset: clip.offset + splitOffset,
        duration: clip.duration - splitOffset,
        name: `${clip.name} (cut)`,
        fadeIn: 0.05
    };

    updateProject(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB)
    }));
    setSelectedClipId(clipB.id);
  }, [project.clips, updateProject]);

  const addTrack = useCallback(() => {
      const newTrack: Track = {
          id: crypto.randomUUID(),
          name: `Track ${project.tracks.length + 1}`,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          eq: { low: 0, mid: 0, high: 0 }
      };
      updateProject(prev => ({...prev, tracks: [...prev.tracks, newTrack]}));
      setSelectedTrackId(newTrack.id);
  }, [project.tracks.length, updateProject]);

  const handleMoveTrack = useCallback((fromIndex: number, toIndex: number) => {
      updateProject(prev => ({
          ...prev,
          tracks: moveItem(prev.tracks, fromIndex, toIndex)
      }));
  }, [updateProject]);

  const handleRenameClip = useCallback((clipId: string, newName: string) => {
      updateProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => c.id === clipId ? { ...c, name: newName } : c)
      }));
  }, [updateProject]);

  const handleColorClip = useCallback((clipId: string, newColor: string) => {
      updateProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => c.id === clipId ? { ...c, color: newColor } : c)
      }));
  }, [updateProject]);

  const handleRenameTrack = useCallback((trackId: string, newName: string) => {
      updateProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === trackId ? { ...t, name: newName } : t)
      }));
  }, [updateProject]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    if (confirm('Delete track and all its clips?')) {
        updateProject(prev => ({
            ...prev,
            tracks: prev.tracks.filter(t => t.id !== trackId),
            clips: prev.clips.filter(c => c.trackId !== trackId)
        }));
        setInspectorTrackId(null);
        if (selectedTrackId === trackId) setSelectedTrackId(null);
    }
  }, [updateProject, selectedTrackId]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white font-sans overflow-hidden select-none" style={{ touchAction: 'none' }}>
      
      {/* Header */}
      <div className="h-12 bg-studio-panel border-b border-zinc-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-4">
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent hidden sm:block">PocketStudio</h1>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent sm:hidden">PS</h1>
            
            <div className="flex space-x-1 border-l border-zinc-700 pl-4">
                <button onClick={undo} disabled={past.length === 0} className={`p-1.5 rounded ${past.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                    <Undo2 size={16} />
                </button>
                <button onClick={redo} disabled={future.length === 0} className={`p-1.5 rounded ${future.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                    <Redo2 size={16} />
                </button>
            </div>
        </div>

        <div className="flex space-x-3 items-center">
             <button 
                onClick={handleExport} 
                disabled={isExporting}
                className={`p-1.5 rounded text-zinc-400 hover:text-white transition-all flex items-center space-x-2 ${isExporting ? 'animate-pulse text-yellow-500' : ''}`}
                title="Export Mix"
             >
                <Download size={18} />
                {isExporting && <span className="text-xs font-bold text-yellow-500">Exporting...</span>}
             </button>

             <div className="w-px h-6 bg-zinc-700" />
             
             <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Upload size={18} />
             </button>
             <button onClick={addTrack} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Plus size={18} />
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {view === 'mixer' ? (
           <Mixer 
             project={project} 
             setProject={updateProject} 
             isPlaying={isPlaying}
             onPlayPause={handlePlayPauseClick}
             onStop={stop}
             onRecord={handleRecordToggle}
           />
        ) : view === 'arranger' ? (
           <Arranger 
             project={project}
             setProject={updateProject}
             currentTime={currentTime}
             isPlaying={isPlaying}
             isRecording={isRecording}
             recordingStartTime={recordingStartTime}
             onPlayPause={handlePlayPauseClick}
             onStop={stop}
             onRecord={handleRecordToggle}
             onSeek={handleSeek}
             onSplit={handleSplit}
             zoom={zoom}
             setZoom={setZoom}
             selectedTrackId={selectedTrackId}
             onSelectTrack={setSelectedTrackId}
             selectedClipId={selectedClipId}
             onSelectClip={setSelectedClipId}
             onOpenInspector={setInspectorTrackId}
             onMoveTrack={handleMoveTrack}
             onRenameClip={handleRenameClip}
             onRenameTrack={handleRenameTrack}
             onColorClip={handleColorClip}
           />
        ) : (
            <Library />
        )}

        {inspectorTrackId && (
            <TrackInspector 
                track={project.tracks.find(t => t.id === inspectorTrackId)!} 
                updateTrack={updateTrack}
                onDeleteTrack={handleDeleteTrack}
                onClose={() => setInspectorTrackId(null)}
            />
        )}
      </div>

      {isRecording && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full animate-pulse shadow-lg z-50 pointer-events-none font-bold text-xs tracking-wider">
              RECORDING
          </div>
      )}

      <div className="h-16 bg-studio-panel border-t border-zinc-800 flex items-center justify-around z-50 pb-safe shrink-0">
        <button onClick={() => setView('mixer')} className={`flex flex-col items-center space-y-1 active:scale-95 transition-transform ${view === 'mixer' ? 'text-studio-accent' : 'text-zinc-500'}`}>
            <Mic size={24} />
            <span className="text-[10px] font-medium">Studio</span>
        </button>
        <button onClick={() => setView('arranger')} className={`flex flex-col items-center space-y-1 active:scale-95 transition-transform ${view === 'arranger' ? 'text-studio-accent' : 'text-zinc-500'}`}>
            <LayoutGrid size={24} />
            <span className="text-[10px] font-medium">Arranger</span>
        </button>
        <button onClick={() => setView('library')} className={`flex flex-col items-center space-y-1 active:scale-95 transition-transform ${view === 'library' ? 'text-studio-accent' : 'text-zinc-500'}`}>
            <Music size={24} />
            <span className="text-[10px] font-medium">Library</span>
        </button>
      </div>
    </div>
  );
};

export default App;