
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, Clip, AssetMetadata, MidiNote, MidiMapping } from './types';
import Mixer from './components/Mixer';
import Arranger from './components/Arranger';
import Library from './components/Library';
import ProjectsView from './components/ProjectsView';
import CommunityView from './components/CommunityView';
import TrackInspector from './components/TrackInspector';
import ClipInspector from './components/ClipInspector';
import MasterInspector from './components/MasterInspector';
import SettingsDialog from './components/SettingsDialog';
import ShortcutsDialog from './components/ShortcutsDialog';
import ExportDialog from './components/ExportDialog';
import AudioContextOverlay from './components/AudioContextOverlay'; 
import WelcomeOverlay from './components/WelcomeOverlay';
import VirtualKeyboard from './components/VirtualKeyboard';
import MetronomeIndicator from './components/MetronomeIndicator';
import TransportHeader from './components/TransportHeader';
import MainLayout, { ViewType } from './components/MainLayout';
import GlobalProgressBar from './components/GlobalProgressBar';
import AudioSync from './components/AudioSync'; 
import { ToastProvider, useToast } from './components/Toast';
import { audio } from './services/audio';
import { midi } from './services/midi';
import { saveAudioBlob, saveProject, getProject, getAudioBlob } from './services/db';
import { moveItem, audioBufferToWav } from './services/utils';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMidiRouting } from './hooks/useMidiRouting';
import { useRecordingWorkflow } from './hooks/useRecordingWorkflow'; 
import { useWakeLock } from './hooks/useWakeLock';
import { TEMPLATES, createTrack } from './services/templates';
import { analytics } from './services/analytics';
import { ProjectProvider, useProject } from './contexts/ProjectContext';

const INITIAL_PROJECT: ProjectState = {
  id: 'default-project',
  name: 'New Project',
  notes: '',
  bpm: 120,
  timeSignature: [4, 4],
  tracks: TEMPLATES['Basic Band'].tracks || [],
  clips: [],
  markers: [],
  loopStart: 0,
  loopEnd: 8,
  isLooping: false,
  metronomeOn: false,
  metronomeSound: 'beep',
  countIn: 0,
  recordingLatency: 0,
  inputMonitoring: false,
  returnToStartOnStop: true,
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
  sequencer: {
      enabled: false,
      volume: 0.8,
      tracks: [
          { name: 'Kick', sample: 'kick', steps: new Array(16).fill(false), volume: 1, muted: false },
          { name: 'Snare', sample: 'snare', steps: new Array(16).fill(false), volume: 1, muted: false },
          { name: 'HiHat', sample: 'hihat', steps: new Array(16).fill(false), volume: 0.7, muted: false }
      ]
  },
  drone: {
      enabled: false,
      volume: 0.5,
      note: 36, // C2
      oscillators: [
          { active: true, type: 'sawtooth', octave: 0, detune: 0, gain: 0.5, pan: 0 },
          { active: true, type: 'sine', octave: 1, detune: 5, gain: 0.3, pan: -0.2 },
          { active: false, type: 'square', octave: -1, detune: -5, gain: 0.3, pan: 0.2 },
          { active: false, type: 'triangle', octave: 0, detune: 700, gain: 0.2, pan: 0 }
      ]
  },
  tanpura: { enabled: false, volume: 0.5, key: 'C', tuning: 'Pa', tempo: 60, fineTune: 0 },
  tabla: { enabled: false, volume: 0.5, taal: 'teen_taal', bpm: 100, key: 'c' },
  midiMappings: []
};

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  // Using updateProject instead of setProject alias
  const { project, updateProject, undo, redo, past, future, loadProject, commitTransaction } = useProject();
  
  const [view, setView] = useState<ViewType>(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('view') as ViewType) || 'arranger';
  });

  const [clipboard, setClipboard] = useState<Clip[]>([]); 

  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(50); 
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]); 
  const [autoScroll, setAutoScroll] = useState(true);
  
  const [inspectorTrackId, setInspectorTrackId] = useState<string | null>(null);
  const [inspectorClipId, setInspectorClipId] = useState<string | null>(null);
  const [showMasterInspector, setShowMasterInspector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  
  const [isMidiLearnActive, setIsMidiLearnActive] = useState(false);
  const [pendingMidiTarget, setPendingMidiTarget] = useState<{ id: string, param: 'volume' | 'pan' } | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  
  const rafRef = useRef<number>(0);
  const saveTimeoutRef = useRef<number | null>(null);

  const { isRecording, startRecording, stopRecording, recordingNotesRef, recordingStartTime } = useRecordingWorkflow({
      project,
      updateProject: (r) => updateProject(r),
      setSelectedClipIds
  });

  useEffect(() => { 
      midi.init(); 
      const handleCC = (cc: number, value: number, channel: number) => {
          if (isMidiLearnActive && pendingMidiTarget) {
              const newMapping: MidiMapping = {
                  id: crypto.randomUUID(),
                  cc, channel, targetId: pendingMidiTarget.id, parameter: pendingMidiTarget.param as any
              };
              updateProject(prev => {
                  const filtered = prev.midiMappings?.filter(m => m.targetId !== pendingMidiTarget.id || m.parameter !== pendingMidiTarget.param) || [];
                  return { ...prev, midiMappings: [...filtered, newMapping] };
              });
              setPendingMidiTarget(null);
              showToast(`Mapped CC${cc} to ${pendingMidiTarget.param}`, 'success');
              return;
          }
          if (project.midiMappings) {
              const mapping = project.midiMappings.find(m => m.cc === cc && m.channel === channel);
              if (mapping) {
                  const normValue = value / 127;
                  if (mapping.targetId === 'master') {
                      if (mapping.parameter === 'volume') updateProject(prev => ({ ...prev, masterVolume: normValue }));
                  } else {
                      const track = project.tracks.find(t => t.id === mapping.targetId);
                      if (track) {
                          if (mapping.parameter === 'volume') {
                              updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === mapping.targetId ? { ...t, volume: normValue } : t) }));
                          } else if (mapping.parameter === 'pan') {
                              const panVal = (normValue * 2) - 1;
                              updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === mapping.targetId ? { ...t, pan: panVal } : t) }));
                          }
                      }
                  }
              }
          }
      };
      const unsubCC = midi.onControlChange(handleCC);
      return () => { unsubCC(); };
  }, [isMidiLearnActive, pendingMidiTarget, project.midiMappings, project.tracks]);

  const { onVirtualNoteOn, onVirtualNoteOff } = useMidiRouting(project, selectedTrackId, isRecording, recordingNotesRef);

  useEffect(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.replaceState({}, '', url);
  }, [view]);

  useEffect(() => { loadProjectState('default-project'); }, []);

  useEffect(() => {
      if (isPlaying || isRecording) requestWakeLock();
      else releaseWakeLock();
  }, [isPlaying, isRecording, requestWakeLock, releaseWakeLock]);

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
            setSaveStatus('unsaved');
            showToast("Failed to auto-save", 'error');
          }
      }, 2000) as unknown as number; 
  }, [project, showToast]);

  const loadProjectState = async (projectId: string) => {
    setIsLoadingProject(true);
    audio.clearBuffers();
    const saved = await getProject(projectId);
    if (saved) {
        const migratedState = { ...INITIAL_PROJECT, ...saved };
        migratedState.tracks = saved.tracks.map((t: any) => ({ ...t, type: t.type || 'audio' }));
        
        const bufferPromises = migratedState.clips.map(async (clip: Clip) => {
            if (clip.bufferKey) {
                try {
                    const blob = await getAudioBlob(clip.bufferKey);
                    if (blob) await audio.loadAudio(clip.bufferKey, blob);
                } catch (e) { console.error(`Failed to load audio for clip ${clip.name}`, e); }
            }
        });
        await Promise.all(bufferPromises);
        loadProject(migratedState);
        if (migratedState.tracks.length > 0) setSelectedTrackId(migratedState.tracks[0].id);
        analytics.track('project_loaded', { projectId: migratedState.id });
    } else if (projectId !== 'default-project') {
        loadProject({ ...INITIAL_PROJECT, id: projectId, name: 'New Project' });
    }
    setIsLoadingProject(false);
  };

  const createNewProject = useCallback(async (template: Partial<ProjectState> = {}) => {
      const newId = crypto.randomUUID();
      const newProject: ProjectState = { 
          ...INITIAL_PROJECT, 
          ...template,
          id: newId, 
          name: template.name || 'Untitled Project',
          tracks: template.tracks || INITIAL_PROJECT.tracks,
          bpm: template.bpm || INITIAL_PROJECT.bpm
      };
      await saveProject(newProject);
      await loadProjectState(newId);
      setView('arranger');
      showToast(`Created new project: ${newProject.name}`, 'info');
      analytics.track('project_created', { template: template.name || 'Empty' });
  }, [loadProject, showToast]);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
      updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  }, [updateProject]);

  const updateClip = useCallback((id: string, updates: Partial<Clip>) => {
      updateProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === id ? { ...c, ...updates } : c) }));
  }, [updateProject]);

  const togglePlay = useCallback(() => {
      setIsPlaying(prevIsPlaying => {
          if (isRecording) return prevIsPlaying;
          if (prevIsPlaying) {
              audio.pause();
              setCurrentTime(audio.getCurrentTime());
              if (project.returnToStartOnStop) setCurrentTime(project.isLooping ? project.loopStart : 0);
              analytics.track('transport_stop');
              return false;
          } else {
              analytics.track('transport_play');
              return true;
          }
      });
  }, [isRecording, project.returnToStartOnStop, project.isLooping, project.loopStart]);

  useEffect(() => {
     if (isPlaying && !audio.isPlaying) audio.play(project.clips, project.tracks, currentTime);
     else if (!isPlaying && audio.isPlaying) audio.pause();
  }, [isPlaying, currentTime, project.clips, project.tracks]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
        await stopRecording(selectedTrackId);
        setIsPlaying(false);
        const stopTime = audio.getCurrentTime();
        setCurrentTime(stopTime); 
    } else {
        let trackIdToRecord = selectedTrackId;
        if (!trackIdToRecord) {
            if (project.tracks.length > 0) {
                trackIdToRecord = project.tracks[0].id;
                setSelectedTrackId(trackIdToRecord);
                showToast(`Armed Track: ${project.tracks[0].name}`, 'info');
            } else {
                const newTrack = createTrack('audio', 'Audio 1', '#ef4444');
                updateProject(prev => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
                trackIdToRecord = newTrack.id;
                setSelectedTrackId(newTrack.id);
                showToast("Created and Armed new Audio Track", 'info');
            }
        } else {
             const t = project.tracks.find(t => t.id === trackIdToRecord);
             if (t) showToast(`Recording on ${t.name}`, 'info');
        }

        if (project.countIn > 0) {
            await audio.playCountIn(project.countIn, project.bpm);
            if(trackIdToRecord) startRecording(trackIdToRecord, currentTime);
            setIsPlaying(true);
        } else {
            if(trackIdToRecord) startRecording(trackIdToRecord, currentTime);
            setIsPlaying(true);
        }
    }
  }, [isRecording, selectedTrackId, currentTime, project.tracks, project.countIn, project.bpm, startRecording, stopRecording, updateProject, showToast]);

  const handleSplit = useCallback((clipId: string, time: number) => {
    const clip = project.clips.find(c => c.id === clipId);
    if (!clip || time <= clip.start || time >= clip.start + clip.duration) return;
    const splitOffset = time - clip.start;
    
    const clipA: Clip = { ...clip, duration: splitOffset, fadeOut: 0.05 };
    const clipB: Clip = { ...clip, id: crypto.randomUUID(), start: time, offset: clip.offset + splitOffset, duration: clip.duration - splitOffset, name: `${clip.name} (cut)`, fadeIn: 0.05 };

    if (clip.notes) {
        const notesA = clip.notes.filter(n => n.start < splitOffset);
        const notesB = clip.notes.filter(n => (n.start + n.duration) > splitOffset).map(n => ({ ...n, start: n.start - splitOffset }));
        clipA.notes = notesA; clipB.notes = notesB; clipB.offset = 0; 
        clipA.loopLength = clipA.duration; clipB.loopLength = clipB.duration;
    }
    updateProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? clipA : c).concat(clipB) }));
    setSelectedClipIds([clipB.id]);
    analytics.track('arranger_clip_split');
  }, [project.clips, updateProject]);

  const handleSplitAtPlayhead = useCallback(() => {
      let splitCount = 0;
      if (selectedClipIds.length > 0) selectedClipIds.forEach(id => { handleSplit(id, currentTime); splitCount++; });
      else if (selectedTrackId) {
          const clipsToSplit = project.clips.filter(c => c.trackId === selectedTrackId && c.start < currentTime && (c.start + c.duration) > currentTime);
          clipsToSplit.forEach(c => { handleSplit(c.id, currentTime); splitCount++; });
      }
      if (splitCount > 0) showToast("Split clip(s)", 'info');
  }, [selectedClipIds, selectedTrackId, currentTime, project.clips, handleSplit, showToast]);

  const handleDuplicateTrack = useCallback((trackId: string) => {
      const track = project.tracks.find(t => t.id === trackId);
      if (!track) return;
      const newTrackId = crypto.randomUUID();
      const newTrack: Track = { ...track, id: newTrackId, name: `${track.name} (Copy)` };
      const newClips = project.clips.filter(c => c.trackId === trackId).map(c => ({ ...c, id: crypto.randomUUID(), trackId: newTrackId }));
      const trackIndex = project.tracks.findIndex(t => t.id === trackId);
      const newTracks = [...project.tracks];
      newTracks.splice(trackIndex + 1, 0, newTrack);
      updateProject(prev => ({ ...prev, tracks: newTracks, clips: [...prev.clips, ...newClips] }));
      setSelectedTrackId(newTrackId);
      if (inspectorTrackId) setInspectorTrackId(newTrackId);
      showToast("Track duplicated", 'success');
  }, [project.tracks, project.clips, updateProject, inspectorTrackId, showToast]);

  const clearSolo = useCallback(() => updateProject(prev => ({ ...prev, tracks: prev.tracks.map(t => ({ ...t, solo: false })) })), [updateProject]);

  const handleSeek = useCallback((time: number) => {
    if (isRecording) return;
    setCurrentTime(time);
    if (isPlaying) audio.play(project.clips, project.tracks, time);
  }, [isRecording, isPlaying, project.clips, project.tracks]);

  const handleQuantize = useCallback(() => {
      if (selectedClipIds.length === 0) return;
      const grid = 0.25 * (60 / project.bpm);
      commitTransaction();
      updateProject(prev => ({ 
          ...prev, 
          clips: prev.clips.map(c => { 
              if (selectedClipIds.includes(c.id)) { 
                  const qStart = Math.round(c.start / grid) * grid; 
                  let notes = c.notes;
                  if (notes) {
                      notes = notes.map(n => ({
                          ...n, start: Math.round(n.start / grid) * grid, duration: Math.max(grid, Math.round(n.duration / grid) * grid)
                      }));
                  }
                  return { ...c, start: qStart, notes }; 
              } 
              return c; 
          }) 
      }));
      showToast("Quantized clips", 'success');
  }, [selectedClipIds, project.bpm, updateProject, commitTransaction, showToast]);

  useKeyboardShortcuts({
      project, setProject: updateProject, selectedClipIds, setSelectedClipIds, selectedTrackId, setSelectedTrackId, currentTime, isRecording, togglePlay, handleRecordToggle, undo, redo, clipboard, setClipboard, handleSplit, onSplitAtPlayhead: handleSplitAtPlayhead, setShowShortcuts, onSeek: handleSeek, onQuantize: handleQuantize
  });

  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        // Changed method name to processSchedule
        audio.processSchedule(project.tracks, project.clips);
        const time = audio.getCurrentTime();
        if (project.isLooping && time >= project.loopEnd && !isRecording) {
            audio.play(project.clips, project.tracks, project.loopStart);
            setCurrentTime(project.loopStart);
        } 
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    if (isPlaying) loop();
    else cancelAnimationFrame(rafRef.current!);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, isRecording, project.isLooping, project.loopEnd, project.loopStart, project.clips, project.tracks, project.bpm, project.metronomeOn]);

  const handlePlayPauseClick = useCallback(() => {
      audio.resumeContext();
      if (isRecording) { handleRecordToggle(); return; }
      togglePlay();
  }, [isRecording, handleRecordToggle, togglePlay]);

  const stop = useCallback(() => {
    if (isRecording) { handleRecordToggle(); return; }
    audio.stop();
    setIsPlaying(false);
    if (project.returnToStartOnStop) setCurrentTime(project.isLooping ? project.loopStart : 0);
    else setCurrentTime(audio.getCurrentTime());
    analytics.track('transport_stop');
  }, [isRecording, handleRecordToggle, project.isLooping, project.loopStart, project.returnToStartOnStop]);

  const handleExport = useCallback(async (options: { type: 'master' | 'stems' }) => {
      if (project.clips.length === 0) { showToast("Nothing to export!", 'error'); return; }
      setIsExporting(true);
      analytics.track('export_started', { type: options.type });
      if (isPlaying) stop();
      try {
          if (options.type === 'master') {
              const blob = await audio.renderProject(project);
              if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `${project.name || 'Mix'}_${new Date().toISOString().slice(0,10)}.wav`; a.click(); URL.revokeObjectURL(url);
                  showToast("Export complete!", 'success');
              }
          } else {
              for (const track of project.tracks) {
                  const stemProject = { ...project, tracks: project.tracks.map(t => ({ ...t, muted: t.id !== track.id, solo: false })) };
                  const blob = await audio.renderProject(stemProject);
                  if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `${project.name}_${track.name}_Stem.wav`; a.click(); URL.revokeObjectURL(url);
                  }
              }
              showToast("Stems exported!", 'success');
          }
          analytics.track('export_completed');
      } catch (e) {
          console.error("Export failed", e);
          showToast("Export failed. See console.", 'error');
      } finally {
          setIsExporting(false);
          setShowExport(false);
      }
  }, [project, isPlaying, stop, showToast]);

  const handleProcessAudio = useCallback(async (clipId: string, type: 'reverse' | 'normalize') => {
      const clip = project.clips.find(c => c.id === clipId);
      if (!clip || !clip.bufferKey) return;
      try {
          const newBuffer = audio.processAudioBuffer(clip.bufferKey, type);
          const newKey = crypto.randomUUID();
          const wav = await audioBufferToWav(newBuffer);
          await saveAudioBlob(newKey, wav);
          audio.buffers.set(newKey, newBuffer);
          updateProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, bufferKey: newKey, name: `${c.name} (${type})` } : c) }));
          showToast(`Audio ${type}d`, 'success');
          analytics.track('clip_action', { action: type });
      } catch (e) { showToast("Audio processing failed.", 'error'); }
  }, [project.clips, updateProject, showToast]);

  const handleDropAsset = async (trackId: string, time: number, asset: AssetMetadata) => {
      const blob = await getAudioBlob(asset.id);
      if (blob) {
          await audio.loadAudio(asset.id, blob);
          const buffer = audio.buffers.get(asset.id);
          const newClip: Clip = { id: crypto.randomUUID(), trackId, name: asset.name, start: time, offset: 0, duration: buffer?.duration || 10, bufferKey: asset.id, fadeIn: 0, fadeOut: 0, speed: 1, gain: 1 };
          updateProject(prev => ({...prev, clips: [...prev.clips, newClip]}));
      }
  };

  const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
  const inspectorTrack = project.tracks.find(t => t.id === inspectorTrackId);
  const inspectorClip = project.clips.find(c => c.id === inspectorClipId);

  return (
    <MainLayout view={view} setView={setView} isRecording={isRecording}>
      <AudioContextOverlay />
      <WelcomeOverlay />
      <AudioSync />
      <GlobalProgressBar isLoading={isLoadingProject} isExporting={isExporting} />
      
      <TransportHeader 
          isPlaying={isPlaying}
          isRecording={isRecording}
          hasSolo={project.tracks.some(t => t.solo)}
          saveStatus={saveStatus}
          isMidiLearnActive={isMidiLearnActive}
          showKeyboard={showKeyboard}
          isInstrumentTrackSelected={selectedTrack?.type === 'instrument'}
          stop={stop} togglePlay={handlePlayPauseClick} toggleRecord={handleRecordToggle}
          clearSolo={clearSolo}
          toggleMetronome={() => updateProject(p => ({ ...p, metronomeOn: !p.metronomeOn }))}
          updateBpm={(bpm) => updateProject(p => ({...p, bpm}))}
          setShowKeyboard={setShowKeyboard} setShowSettings={setShowSettings} setShowExport={setShowExport}
          currentTime={currentTime}
      />

      <div className="flex-1 overflow-hidden relative">
          <div className="flex-1 overflow-hidden relative flex flex-col h-full">
              {view === 'projects' && (
                  <ProjectsView 
                      currentProjectId={project.id}
                      onLoadProject={(id) => { loadProjectState(id); setView('arranger'); }}
                      onCreateNewProject={createNewProject}
                  />
              )}
              {view === 'mixer' && (
                  <Mixer 
                    isPlaying={isPlaying} onPlayPause={handlePlayPauseClick} onStop={stop} onRecord={handleRecordToggle}
                    onOpenMaster={() => setShowMasterInspector(true)}
                  />
              )}
              {view === 'arranger' && (
                  <Arranger 
                    currentTime={currentTime} isPlaying={isPlaying} isRecording={isRecording} recordingStartTime={recordingStartTime}
                    onPlayPause={handlePlayPauseClick} onStop={stop} onRecord={handleRecordToggle} onSeek={handleSeek} onSplit={handleSplit} onSplitAtPlayhead={handleSplitAtPlayhead}
                    zoom={zoom} setZoom={setZoom}
                    selectedTrackId={selectedTrackId} onSelectTrack={setSelectedTrackId} selectedClipIds={selectedClipIds} onSelectClip={setSelectedClipIds}
                    onOpenInspector={setInspectorTrackId} onOpenClipInspector={setInspectorClipId}
                    onMoveTrack={(from, to) => updateProject(p => ({...p, tracks: moveItem(p.tracks, from, to)}))}
                    onRenameClip={(id, name) => updateClip(id, { name })} onColorClip={(id, color) => updateClip(id, { color })} onRenameTrack={(id, name) => updateTrack(id, { name })}
                    autoScroll={autoScroll} onDropAsset={handleDropAsset} commitTransaction={commitTransaction}
                  />
              )}
              {view === 'library' && (
                  <div className="h-full">
                      <Library currentProjectId={project.id} onLoadProject={loadProjectState} onCreateNewProject={createNewProject} onAddAsset={(asset) => handleDropAsset(selectedTrackId || project.tracks[0]?.id, currentTime, asset)} variant="full" />
                  </div>
              )}
              {view === 'community' && <CommunityView />}
              <MetronomeIndicator isPlaying={isPlaying} metronomeOn={project.metronomeOn} bpm={project.bpm} />
          </div>
      </div>

      {showKeyboard && selectedTrack?.type === 'instrument' && selectedTrack.instrument && (
          <VirtualKeyboard trackId={selectedTrack.id} config={selectedTrack.instrument} onClose={() => setShowKeyboard(false)} onNoteOn={onVirtualNoteOn} onNoteOff={onVirtualNoteOff} />
      )}

      {inspectorTrack && <TrackInspector track={inspectorTrack} updateTrack={updateTrack} onClose={() => setInspectorTrackId(null)} onDeleteTrack={(id) => { if (confirm("Delete track?")) { updateProject(prev => ({...prev, tracks: prev.tracks.filter(t => t.id !== id), clips: prev.clips.filter(c => c.trackId !== id)})); setInspectorTrackId(null); showToast("Track deleted", 'info'); }}} onDuplicateTrack={handleDuplicateTrack} />}
      {inspectorClip && <ClipInspector clip={inspectorClip} updateClip={updateClip} onClose={() => setInspectorClipId(null)} onDeleteClip={(id) => { updateProject(prev => ({...prev, clips: prev.clips.filter(c => c.id !== id)})); setInspectorClipId(null); showToast("Clip deleted", 'info'); }} onDuplicateClip={(id) => { const c = project.clips.find(clip => clip.id === id); if(c) { updateProject(prev => ({...prev, clips: [...prev.clips, {...c, id: crypto.randomUUID(), start: c.start + c.duration, name: `${c.name} (Copy)`}]})); showToast("Clip duplicated", 'success'); }}} onProcessAudio={handleProcessAudio} />}
      
      {showMasterInspector && <MasterInspector onClose={() => setShowMasterInspector(false)} />}
      
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} isMidiLearnActive={isMidiLearnActive} setMidiLearnActive={setIsMidiLearnActive} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} onExport={handleExport} isExporting={isExporting} project={project} />}
    </MainLayout>
  );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <ProjectProvider initialProject={INITIAL_PROJECT}>
                <AppContent />
            </ProjectProvider>
        </ToastProvider>
    );
};

export default App;
