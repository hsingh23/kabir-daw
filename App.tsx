
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip, Marker, AssetMetadata } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import Library from './components/Library';
import TrackInspector from './components/TrackInspector';
import ClipInspector from './components/ClipInspector';
import MasterInspector from './components/MasterInspector';
import SettingsDialog from './components/SettingsDialog';
import ShortcutsDialog from './components/ShortcutsDialog';
import ExportDialog from './components/ExportDialog';
import TimeDisplay from './components/TimeDisplay';
import TempoControl from './components/TempoControl';
import StatusIndicator from './components/StatusIndicator';
import { audio } from './services/audio';
import { saveAudioBlob, saveProject, getProject, getAudioBlob } from './services/db';
import { moveItem, audioBufferToWav } from './services/utils';
import { Mic, Music, LayoutGrid, Upload, Plus, Undo2, Redo2, Download, Play, Pause, Square, Circle, Settings, Activity, ArrowRightLeft, Keyboard } from 'lucide-react';

const INITIAL_PROJECT: ProjectState = {
  id: 'default-project',
  name: 'New Project',
  bpm: 120,
  tracks: [
    { id: '1', name: 'Drums', volume: 0.8, pan: 0, muted: false, solo: false, color: '#ef4444', eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 }, sends: { reverb: 0, delay: 0, chorus: 0 } },
    { id: '2', name: 'Bass', volume: 0.7, pan: 0, muted: false, solo: false, color: '#3b82f6', eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -15, ratio: 3, attack: 0.01, release: 0.1 }, sends: { reverb: 0, delay: 0, chorus: 0 } },
    { id: '3', name: 'Synth', volume: 0.6, pan: 0, muted: false, solo: false, color: '#a855f7', eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -18, ratio: 2.5, attack: 0.05, release: 0.2 }, sends: { reverb: 0, delay: 0.2, chorus: 0.3 } },
    { id: '4', name: 'Vocals', volume: 0.9, pan: 0, muted: false, solo: false, color: '#eab308', eq: { low: 0, mid: 0, high: 0 }, compressor: { enabled: false, threshold: -22, ratio: 3, attack: 0.02, release: 0.2 }, sends: { reverb: 0.3, delay: 0.1, chorus: 0 } },
  ],
  clips: [],
  markers: [],
  loopStart: 0,
  loopEnd: 8,
  isLooping: false,
  metronomeOn: false,
  metronomeSound: 'beep',
  countIn: 0,
  masterVolume: 1.0,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: {
      threshold: -24,
      ratio: 12,
      knee: 10,
      attack: 0.05,
      release: 0.25
  },
  effects: { reverb: 0.2, delay: 0.1, chorus: 0.0 },
  tanpura: {
      enabled: false,
      volume: 0.5,
      key: 'C',
      tuning: 'Pa',
      tempo: 60,
      fineTune: 0
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
  const [clipboard, setClipboard] = useState<Clip[]>([]); 

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); 
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>('1');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]); 
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Track Inspector Modal
  const [inspectorTrackId, setInspectorTrackId] = useState<string | null>(null);
  
  // Clip Inspector Modal
  const [inspectorClipId, setInspectorClipId] = useState<string | null>(null);
  
  // Master Inspector Modal
  const [showMasterInspector, setShowMasterInspector] = useState(false);
  
  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  
  // Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Visual Metronome
  const [visualBeat, setVisualBeat] = useState(false);

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
      loadProjectState('default-project');
  }, []);

  // Auto-Save Logic
  useEffect(() => {
      if (project === INITIAL_PROJECT) return;
      
      setSaveStatus('unsaved');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          setSaveStatus('saving');
          try {
            await saveProject(project);
            setSaveStatus('saved');
          } catch (e) {
            console.error("Save failed", e);
            setSaveStatus('unsaved');
          }
      }, 2000) as unknown as number; 
  }, [project]);

  const loadProjectState = async (projectId: string) => {
    const saved = await getProject(projectId);
    if (saved) {
        // Migration for new state fields
        const migrated = {
            ...INITIAL_PROJECT,
            ...saved,
            name: saved.name || (projectId === 'default-project' ? 'New Project' : `Project ${projectId.slice(0,4)}`),
            effects: { ...INITIAL_PROJECT.effects, ...saved.effects },
            masterCompressor: { ...INITIAL_PROJECT.masterCompressor, ...saved.masterCompressor },
            masterEq: saved.masterEq || INITIAL_PROJECT.masterEq,
            markers: saved.markers || [],
            metronomeSound: saved.metronomeSound || 'beep',
            countIn: saved.countIn || 0,
            tanpura: { ...INITIAL_PROJECT.tanpura, ...saved.tanpura },
            tracks: saved.tracks.map((t: any) => ({
                ...t,
                eq: t.eq || { low: 0, mid: 0, high: 0 },
                compressor: t.compressor || { enabled: false, threshold: -15, ratio: 3, attack: 0.01, release: 0.1 },
                sends: t.sends || { reverb: 0, delay: 0, chorus: 0 }
            })),
            clips: saved.clips.map((c: any) => ({
                ...c,
                speed: c.speed || 1,
                gain: c.gain !== undefined ? c.gain : 1.0
            }))
        };
        
        // Load Audio Buffers concurrently
        const bufferPromises = migrated.clips.map(async (clip: Clip) => {
            const blob = await getAudioBlob(clip.bufferKey);
            if (blob) {
                await audio.loadAudio(clip.bufferKey, blob);
            }
        });
        
        await Promise.all(bufferPromises);
        
        // Set project AFTER buffers are ready to ensure Waveform components can find data
        setProject(migrated);
        
    } else if (projectId !== 'default-project') {
        // If loading a new ID that doesn't exist, init it
        setProject({ ...INITIAL_PROJECT, id: projectId, name: 'New Project' });
    }
  };

  const createNewProject = useCallback(async () => {
      const newId = crypto.randomUUID();
      const newProject = { ...INITIAL_PROJECT, id: newId, name: 'Untitled Project' };
      await saveProject(newProject);
      await loadProjectState(newId);
  }, []);

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

  const updateClip = useCallback((id: string, updates: Partial<Clip>) => {
      updateProject(prev => ({
          ...prev,
          clips: prev.clips.map(c => c.id === id ? { ...c, ...updates } : c)
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

  const startActualRecording = useCallback(async () => {
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
  }, [currentTime, project.clips, project.tracks]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        // Stop Recording
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
                fadeOut: 0,
                speed: 1,
                gain: 1.0
            };
            
            updateProject(prev => ({
                ...prev,
                clips: [...prev.clips, newClip]
            }));
            setSelectedClipIds([newClip.id]);
        }
    } else {
        if (!selectedTrackId) {
            alert("Select a track to record on first.");
            return;
        }
        
        // Start Recording Logic
        if (project.countIn > 0) {
            setIsCountingIn(true);
            await audio.playCountIn(project.countIn, project.bpm);
            setIsCountingIn(false);
            startActualRecording();
        } else {
            startActualRecording();
        }
    }
  }, [isRecording, selectedTrackId, recordingStartTime, currentTime, project.clips, project.tracks, updateProject, project.countIn, project.bpm, startActualRecording]);

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
        fadeIn: 0.05,
        speed: clip.speed || 1,
        gain: clip.gain || 1.0
    };

    updateProject(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB)
    }));
    setSelectedClipIds([clipB.id]);
  }, [project.clips, updateProject]);

  const handleDuplicateTrack = useCallback((trackId: string) => {
      const track = project.tracks.find(t => t.id === trackId);
      if (!track) return;

      const newTrackId = crypto.randomUUID();
      const newTrack: Track = {
          ...track,
          id: newTrackId,
          name: `${track.name} (Copy)`
      };

      // Duplicate clips
      const trackClips = project.clips.filter(c => c.trackId === trackId);
      const newClips = trackClips.map(clip => ({
          ...clip,
          id: crypto.randomUUID(),
          trackId: newTrackId
      }));

      // Insert after original track
      const trackIndex = project.tracks.findIndex(t => t.id === trackId);
      const newTracks = [...project.tracks];
      newTracks.splice(trackIndex + 1, 0, newTrack);

      updateProject(prev => ({
          ...prev,
          tracks: newTracks,
          clips: [...prev.clips, ...newClips]
      }));
      
      setSelectedTrackId(newTrackId);
      if (inspectorTrackId) setInspectorTrackId(newTrackId);

  }, [project.tracks, project.clips, updateProject, inspectorTrackId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore inputs
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
          }

          // Shortcuts Dialog (?)
          if (e.key === '?') {
              setShowShortcuts(prev => !prev);
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
              updateProject(prev => ({ ...prev, metronomeOn: !prev.metronomeOn }));
              return;
          }

          // Loop Toggle (L)
          if (e.key === 'l') {
              updateProject(prev => ({ ...prev, isLooping: !prev.isLooping }));
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

                  updateProject(prev => ({ ...prev, clips: [...prev.clips, ...newClips] }));
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
                      updateProject(prev => ({ ...prev, clips: [...prev.clips, ...newClips] }));
                      setSelectedClipIds(newClips.map(c => c.id));
                      e.preventDefault();
                  }
              }
          }

          // Split (Cmd/Ctrl + B)
          if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
              e.preventDefault();
              if (selectedClipIds.length > 0) {
                  selectedClipIds.forEach(id => handleSplit(id, currentTime));
              } else if (selectedTrackId) {
                  const clipsToSplit = project.clips.filter(c => 
                      c.trackId === selectedTrackId && 
                      c.start < currentTime && 
                      (c.start + c.duration) > currentTime
                  );
                  clipsToSplit.forEach(c => handleSplit(c.id, currentTime));
              }
          }

          // Nudge (Arrows)
          if (selectedClipIds.length > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault();
              const amount = e.shiftKey ? 0.1 : 0.01;
              const delta = e.key === 'ArrowLeft' ? -amount : amount;
              
              updateProject(prev => ({
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
                updateProject(prev => ({
                    ...prev,
                    clips: prev.clips.filter(c => !selectedClipIds.includes(c.id))
                }));
                setSelectedClipIds([]);
            }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future, project, isRecording, togglePlay, undo, redo, selectedClipIds, handleRecordToggle, updateProject, clipboard, currentTime, selectedTrackId, handleSplit]); 

  useEffect(() => {
    audio.syncTracks(project.tracks);
    audio.syncInstruments(project.tanpura, project.tabla);
    audio.setMasterVolume(project.masterVolume);
    if (project.masterCompressor) {
        audio.setMasterCompressor(
            project.masterCompressor.threshold, 
            project.masterCompressor.ratio,
            project.masterCompressor.knee,
            project.masterCompressor.attack,
            project.masterCompressor.release
        );
    }
    if (project.masterEq) {
        audio.setMasterEq(project.masterEq.low, project.masterEq.mid, project.masterEq.high);
    }
    audio.setDelayLevel(project.effects.delay);
    audio.setReverbLevel(project.effects.reverb);
    audio.setChorusLevel(project.effects.chorus);
    audio.bpm = project.bpm;
    audio.metronomeEnabled = project.metronomeOn;
    audio.metronomeSound = project.metronomeSound || 'beep';
  }, [project]);

  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        audio.scheduler();
        const time = audio.getCurrentTime();
        
        const secondsPerBeat = 60 / project.bpm;
        const timeSinceBeat = time % secondsPerBeat;
        setVisualBeat(timeSinceBeat < 0.1 && project.metronomeOn);

        if (project.isLooping && time >= project.loopEnd && !isRecording) {
            audio.play(project.clips, project.tracks, project.loopStart);
            setCurrentTime(project.loopStart);
        } else {
            setCurrentTime(time);
        }
        rafRef.current = requestAnimationFrame(loop);
      } else {
          setVisualBeat(false);
      }
    };
    if (isPlaying) {
      loop();
    } else {
      cancelAnimationFrame(rafRef.current!);
    }
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, isRecording, project.isLooping, project.loopEnd, project.loopStart, project.clips, project.tracks, project.bpm, project.metronomeOn]);

  const handlePlayPauseClick = useCallback(() => {
      audio.resumeContext();
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

  const handleExport = useCallback(async (options: { type: 'master' | 'stems' }) => {
      if (project.clips.length === 0) {
          alert("Nothing to export!");
          return;
      }
      setIsExporting(true);
      if (isPlaying) stop();
      
      try {
          if (options.type === 'master') {
              const blob = await audio.renderProject(project);
              if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project.name || 'PocketStudio_Mix'}_${new Date().toISOString().slice(0,10)}.wav`;
                  a.click();
                  URL.revokeObjectURL(url);
              }
          } else {
              // Export Stems
              for (const track of project.tracks) {
                  const stemProject = {
                      ...project,
                      tracks: project.tracks.map(t => ({
                          ...t,
                          muted: t.id !== track.id,
                          solo: false
                      }))
                  };
                  const blob = await audio.renderProject(stemProject);
                  if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${track.name}_${new Date().toISOString().slice(0,10)}.wav`;
                      a.click();
                      URL.revokeObjectURL(url);
                      await new Promise(r => setTimeout(r, 500));
                  }
              }
          }
      } catch (e) {
          console.error(e);
          alert("Export failed.");
      } finally {
          setIsExporting(false);
          setShowExport(false);
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
        fadeOut: 0,
        speed: 1,
        gain: 1.0
      };

      updateProject(prev => ({
        ...prev,
        clips: [...prev.clips, newClip]
      }));
      setSelectedClipIds([newClip.id]);
    }
  }, [selectedTrackId, project.tracks, currentTime, updateProject]);

  const addTrack = useCallback(() => {
      const newTrack: Track = {
          id: crypto.randomUUID(),
          name: `Track ${project.tracks.length + 1}`,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          eq: { low: 0, mid: 0, high: 0 },
          compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
          sends: { reverb: 0, delay: 0, chorus: 0 }
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

  const handleDeleteClip = useCallback((clipId: string) => {
      updateProject(prev => ({
          ...prev,
          clips: prev.clips.filter(c => c.id !== clipId)
      }));
      setInspectorClipId(null);
      setSelectedClipIds(prev => prev.filter(id => id !== clipId));
  }, [updateProject]);

  const handleDuplicateClip = useCallback((clipId: string) => {
      const clip = project.clips.find(c => c.id === clipId);
      if (clip) {
          const newClip = {
              ...clip,
              id: crypto.randomUUID(),
              start: clip.start + clip.duration,
              name: `${clip.name} (Dup)`
          };
          updateProject(prev => ({ ...prev, clips: [...prev.clips, newClip] }));
          setSelectedClipIds([newClip.id]);
          // Keep inspector open on original or switch? Maybe switch to new one.
          setInspectorClipId(newClip.id);
      }
  }, [project.clips, updateProject]);

  const handleProcessAudio = useCallback(async (clipId: string, type: 'reverse' | 'normalize') => {
      const clip = project.clips.find(c => c.id === clipId);
      if(!clip) return;

      try {
          const newBuffer = audio.processAudioBuffer(clip.bufferKey, type);
          const newKey = crypto.randomUUID();
          
          // Add to memory
          audio.buffers.set(newKey, newBuffer);
          
          // Persist
          const blob = audioBufferToWav(newBuffer);
          await saveAudioBlob(newKey, blob);
          
          updateProject(prev => ({
              ...prev,
              clips: prev.clips.map(c => c.id === clipId ? { 
                  ...c, 
                  bufferKey: newKey, 
                  name: `${c.name} (${type === 'reverse' ? 'Rev' : 'Norm'})` 
              } : c)
          }));
      } catch (e) {
          console.error("Audio processing failed:", e);
          alert("Failed to process audio.");
      }
  }, [project.clips, updateProject]);

  const handleRenameProject = useCallback(() => {
      const newName = prompt("Project Name:", project.name);
      if (newName) {
          updateProject(prev => ({ ...prev, name: newName }));
      }
  }, [project.name, updateProject]);

  // Handle adding asset from library
  const handleAddAssetToProject = useCallback(async (asset: AssetMetadata) => {
      try {
          const blob = await getAudioBlob(asset.id);
          if (!blob) {
              alert("Audio data not found.");
              return;
          }
          await audio.loadAudio(asset.id, blob);
          const buffer = audio.buffers.get(asset.id);
          const duration = buffer?.duration || 0;

          // Determine target track
          let targetTrackId = selectedTrackId;
          // If the asset has a specific instrument type that matches a track name, smart place it?
          // For now, just use selected or first.
          if (!targetTrackId && project.tracks.length > 0) {
              targetTrackId = project.tracks[0].id;
          }
          
          // If no tracks, create one
          if (!targetTrackId) {
              const newTrack: Track = {
                  id: crypto.randomUUID(),
                  name: asset.instrument || 'Audio',
                  volume: 0.8, pan: 0, muted: false, solo: false, color: '#4caf50',
                  eq: {low:0, mid:0, high:0}, sends: {reverb:0, delay:0, chorus:0}
              };
              updateProject(p => ({...p, tracks: [...p.tracks, newTrack]}));
              targetTrackId = newTrack.id;
          }

          // Auto-speed matching if it's a loop with known BPM
          let speed = 1;
          if (asset.type === 'loop' && asset.bpm) {
              speed = project.bpm / asset.bpm;
          }

          const newClip: Clip = {
              id: crypto.randomUUID(),
              trackId: targetTrackId,
              name: asset.name,
              start: currentTime,
              offset: 0,
              duration: duration / speed, // Adjust timeline duration based on speed
              bufferKey: asset.id,
              fadeIn: 0,
              fadeOut: 0,
              speed: speed,
              gain: 1.0
          };

          updateProject(prev => ({
              ...prev,
              clips: [...prev.clips, newClip]
          }));
          
          setSelectedClipIds([newClip.id]);
          setSelectedTrackId(targetTrackId);
          setView('arranger'); // Switch to arranger to see the new clip
          
      } catch (e) {
          console.error("Failed to add asset to project", e);
      }
  }, [selectedTrackId, project.tracks, currentTime, updateProject, project.bpm]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white font-sans overflow-hidden select-none" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="h-14 bg-studio-panel border-b border-zinc-800 flex items-center justify-between px-3 sm:px-4 z-50 shrink-0">
        
        {/* Left: Branding & History */}
        <div className="flex items-center space-x-2 sm:space-x-4 w-auto">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={handleRenameProject} title="Rename Project">
                <div className={`w-3 h-3 rounded-full ${visualBeat ? 'bg-studio-accent shadow-[0_0_10px_#ef4444]' : 'bg-zinc-700'}`} />
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent hidden md:block">
                    PocketStudio <span className="text-zinc-500 mx-1 font-light">/</span> <span className="text-white hover:text-zinc-300 transition-colors">{project.name}</span>
                </h1>
            </div>

            <StatusIndicator status={saveStatus} />

            <div className="flex space-x-0.5 border-l border-zinc-700 pl-2 sm:pl-4 hidden sm:flex">
                <button onClick={undo} disabled={past.length === 0} className={`p-1.5 rounded ${past.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                    <Undo2 size={16} />
                </button>
                <button onClick={redo} disabled={future.length === 0} className={`p-1.5 rounded ${future.length === 0 ? 'text-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
                    <Redo2 size={16} />
                </button>
            </div>
        </div>

        {/* Center: Transport Controls */}
        <div className="flex-1 flex items-center justify-center space-x-2 sm:space-x-4">
             <TimeDisplay currentTime={currentTime} bpm={project.bpm} />
             <TempoControl bpm={project.bpm} onChange={(bpm) => updateProject(p => ({ ...p, bpm }))} />

             <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-full transition-all ${autoScroll ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                title="Auto Scroll"
             >
                 <ArrowRightLeft size={14} className={autoScroll ? "" : "opacity-50"} />
             </button>

             <button 
                onClick={() => updateProject(p => ({ ...p, metronomeOn: !p.metronomeOn }))}
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-full transition-all ${project.metronomeOn ? 'bg-studio-accent text-white shadow-lg' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                title="Metronome (M)"
             >
                 <Activity size={14} />
             </button>

             <button 
                onClick={stop}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 shadow-knob flex items-center justify-center active:scale-95 transition-transform"
                title="Stop"
              >
                  <Square fill="currentColor" size={12} className="text-zinc-400" />
              </button>

              <button 
                onClick={handleRecordToggle}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-knob border-2 sm:border-4 border-zinc-800 flex items-center justify-center active:scale-95 transition-transform ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-900 hover:bg-red-800'}`}
                title="Record (R)"
              >
                  <Circle fill="white" size={14} className="text-white" />
              </button>

              <button 
                onClick={handlePlayPauseClick}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 shadow-knob flex items-center justify-center active:scale-95 transition-transform"
                title="Play/Pause (Space)"
              >
                 {isPlaying ? 
                    <Pause fill="currentColor" size={14} className="text-zinc-200" /> : 
                    <Play fill="currentColor" size={14} className="text-zinc-200 ml-0.5" />
                 }
              </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-1 sm:space-x-3 w-auto">
             <button 
                onClick={() => setShowExport(true)} 
                disabled={isExporting}
                className={`p-1.5 rounded text-zinc-400 hover:text-white transition-all flex items-center space-x-2 ${isExporting ? 'animate-pulse text-yellow-500' : ''}`}
                title="Export Mix"
             >
                <Download size={18} />
                <span className="hidden lg:inline text-xs font-bold">{isExporting ? 'Exporting...' : 'Export'}</span>
             </button>

             <div className="w-px h-6 bg-zinc-700 mx-1" />
             
             <button onClick={() => setShowShortcuts(true)} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform hidden sm:block" title="Keyboard Shortcuts (?)">
                <Keyboard size={18} />
             </button>
             <button onClick={() => setShowSettings(true)} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform" title="Settings">
                <Settings size={18} />
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Upload size={18} />
             </button>
             <button onClick={addTrack} className="p-1.5 rounded text-zinc-400 hover:text-white active:scale-90 transition-transform">
                <Plus size={18} />
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" className="hidden" />
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
             onOpenMaster={() => setShowMasterInspector(true)}
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
             selectedClipIds={selectedClipIds}
             onSelectClip={setSelectedClipIds}
             onOpenInspector={setInspectorTrackId}
             onOpenClipInspector={setInspectorClipId}
             onMoveTrack={handleMoveTrack}
             onRenameClip={handleRenameClip}
             onRenameTrack={handleRenameTrack}
             onColorClip={handleColorClip}
             autoScroll={autoScroll}
           />
        ) : (
            <Library 
                onLoadProject={loadProjectState} 
                onCreateNewProject={createNewProject}
                onAddAsset={handleAddAssetToProject}
                currentProjectId={project.id}
            />
        )}

        {inspectorTrackId && (
            <TrackInspector 
                track={project.tracks.find(t => t.id === inspectorTrackId)!} 
                updateTrack={updateTrack}
                onDeleteTrack={handleDeleteTrack}
                onDuplicateTrack={handleDuplicateTrack}
                onClose={() => setInspectorTrackId(null)}
            />
        )}

        {inspectorClipId && project.clips.find(c => c.id === inspectorClipId) && (
            <ClipInspector
                clip={project.clips.find(c => c.id === inspectorClipId)!}
                updateClip={updateClip}
                onDeleteClip={handleDeleteClip}
                onDuplicateClip={handleDuplicateClip}
                onProcessAudio={handleProcessAudio}
                onClose={() => setInspectorClipId(null)}
            />
        )}

        {showMasterInspector && (
            <MasterInspector
                project={project}
                setProject={updateProject}
                onClose={() => setShowMasterInspector(false)}
            />
        )}

        {showSettings && (
            <SettingsDialog onClose={() => setShowSettings(false)} project={project} setProject={updateProject} />
        )}

        {showShortcuts && (
            <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
        )}

        {showExport && (
            <ExportDialog 
                project={project} 
                onClose={() => setShowExport(false)} 
                isExporting={isExporting} 
                onExport={handleExport}
            />
        )}
      </div>

      {isCountingIn && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
              <div className="bg-red-600 w-32 h-32 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_50px_#ef4444]">
                  <span className="text-4xl font-bold text-white">REC</span>
              </div>
          </div>
      )}

      {isRecording && !isCountingIn && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-1 rounded-full animate-pulse shadow-lg z-50 pointer-events-none font-bold text-xs tracking-wider backdrop-blur-sm border border-red-400/50">
              RECORDING {((currentTime - recordingStartTime).toFixed(1))}s
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
