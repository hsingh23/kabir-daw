import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import TrackInspector from './components/TrackInspector';
import { audio } from './services/audio';
import { saveAudioBlob, saveProject, getProject } from './services/db';
import { Mic, Music, LayoutGrid, Upload, Plus, Undo2, Redo2 } from 'lucide-react';

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
  effects: { reverb: 0.2, delay: 0.1 }
};

const App: React.FC = () => {
  const [view, setView] = useState<'mixer' | 'arranger'>('mixer');
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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

  // Load Project on Mount
  useEffect(() => {
      const load = async () => {
          const saved = await getProject('default-project');
          if (saved) {
              // Ensure old saves have new properties like eq
              const migrated = {
                  ...saved,
                  tracks: saved.tracks.map((t: any) => ({
                      ...t,
                      eq: t.eq || { low: 0, mid: 0, high: 0 }
                  }))
              };
              setProject(migrated);
              // Also load audio into buffers for clips
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

  // Auto-Save Project
  useEffect(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          saveProject(project);
      }, 2000) as unknown as number; // Auto-save after 2 seconds of inactivity
  }, [project]);

  const updateProject = useCallback((value: React.SetStateAction<ProjectState>) => {
      setProject(current => {
          const next = typeof value === 'function' ? (value as Function)(current) : value;
          if (next !== current) {
              setPast(prev => [...prev.slice(-19), current]);
              setFuture([]);
          }
          return next;
      });
  }, []);

  const updateTrack = (id: string, updates: Partial<Track>) => {
      updateProject(prev => ({
          ...prev,
          tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
      }));
  };

  const undo = () => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      setFuture(prev => [project, ...prev]);
      setProject(previous);
      setPast(newPast);
  };

  const redo = () => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);

      setPast(prev => [...prev, project]);
      setProject(next);
      setFuture(newFuture);
  };

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
              e.preventDefault();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future, project]);

  // Audio Engine Sync
  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.setMasterVolume(project.masterVolume);
    audio.setDelayLevel(project.effects.delay);
    audio.bpm = project.bpm;
    audio.metronomeEnabled = project.metronomeOn;
  }, [project]);

  // Playback Loop
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

  const togglePlay = () => {
    if (isRecording) {
        handleRecordToggle();
        return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play(project.clips, project.tracks, currentTime);
      setIsPlaying(true);
    }
  };

  const handleRecordToggle = async () => {
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
        } catch (e) {
            alert("Could not start recording. Check microphone permissions.");
        }
    }
  };

  const stop = () => {
    if (isRecording) {
        handleRecordToggle();
        return;
    }
    audio.stop();
    setIsPlaying(false);
    setCurrentTime(project.isLooping ? project.loopStart : 0);
  };

  const handleSeek = (time: number) => {
    if (isRecording) return;
    setCurrentTime(time);
    if (isPlaying) {
      audio.play(project.clips, project.tracks, time);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
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
  };

  const handleSplit = (clipId: string, time: number) => {
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
        name: clip.name + ' (cut)',
        fadeIn: 0.05
    };

    updateProject(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB)
    }));
    setSelectedClipId(clipB.id);
  };

  const addTrack = () => {
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
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden select-none" style={{ touchAction: 'none' }}>
      
      {/* Header */}
      <div className="h-12 bg-studio-panel border-b border-zinc-800 flex items-center justify-between px-4 z-50">
        <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">PocketStudio</h1>
        
        <div className="flex space-x-2">
            <button onClick={undo} disabled={past.length === 0} className={`p-1 rounded ${past.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                <Undo2 size={18} />
            </button>
            <button onClick={redo} disabled={future.length === 0} className={`p-1 rounded ${future.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                <Redo2 size={18} />
            </button>
        </div>

        <div className="flex space-x-4">
             <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Upload size={20} />
             </button>
             <button onClick={addTrack} className="text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Plus size={20} />
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {view === 'mixer' ? (
           <Mixer 
             project={project} 
             setProject={updateProject} 
             isPlaying={isPlaying}
             onPlayPause={togglePlay}
             onStop={stop}
             onRecord={handleRecordToggle}
           />
        ) : (
           <Arranger 
             project={project}
             setProject={updateProject}
             currentTime={currentTime}
             isPlaying={isPlaying}
             isRecording={isRecording}
             onPlayPause={togglePlay}
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
           />
        )}

        {/* Track Inspector Modal */}
        {inspectorTrackId && (
            <TrackInspector 
                track={project.tracks.find(t => t.id === inspectorTrackId)!} 
                updateTrack={updateTrack}
                onClose={() => setInspectorTrackId(null)}
            />
        )}
      </div>

      {isRecording && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full animate-pulse shadow-lg z-50 pointer-events-none font-bold text-xs tracking-wider">
              RECORDING
          </div>
      )}

      <div className="h-16 bg-studio-panel border-t border-zinc-800 flex items-center justify-around z-50 pb-safe">
        <button onClick={() => setView('mixer')} className={`flex flex-col items-center space-y-1 active:scale-95 transition-transform ${view === 'mixer' ? 'text-studio-accent' : 'text-zinc-500'}`}>
            <Mic size={24} />
            <span className="text-[10px] font-medium">Studio</span>
        </button>
        <button onClick={() => setView('arranger')} className={`flex flex-col items-center space-y-1 active:scale-95 transition-transform ${view === 'arranger' ? 'text-studio-accent' : 'text-zinc-500'}`}>
            <LayoutGrid size={24} />
            <span className="text-[10px] font-medium">Arranger</span>
        </button>
        <button className="flex flex-col items-center space-y-1 text-zinc-500 opacity-50 cursor-not-allowed">
            <Music size={24} />
            <span className="text-[10px] font-medium">Library</span>
        </button>
      </div>
    </div>
  );
};

export default App;