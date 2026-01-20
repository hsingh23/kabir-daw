
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Track } from '../types';
import CustomFader from './Fader';
import StepSequencer from './StepSequencer';
import DroneSynth from './DroneSynth';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import LevelMeter from './LevelMeter';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import MixerStrip from './MixerStrip';
import { Sliders, Music2, Activity, Plus, Mic, Piano, LayoutGrid } from 'lucide-react';
import { analytics } from '../services/analytics';
import { createTrack } from '../services/templates';
import { useProject } from '../contexts/ProjectContext';

interface MixerProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onOpenMaster: () => void;
}

const Mixer: React.FC<MixerProps> = ({ onOpenMaster }) => {
  const { project, updateProject } = useProject();
  const [tab, setTab] = useState<'tracks' | 'instruments'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('mixerTab') as 'tracks' | 'instruments') || 'tracks';
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'tracks') {
        url.searchParams.delete('mixerTab');
    } else {
        url.searchParams.set('mixerTab', tab);
    }
    window.history.replaceState({}, '', url);
  }, [tab]);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    updateProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  }, [updateProject]);

  const handleRenameTrack = useCallback((trackId: string, currentName: string) => {
      const newName = prompt('Rename Track', currentName);
      if (newName) {
          updateTrack(trackId, { name: newName });
          analytics.track('mixer_action', { action: 'rename_track', trackId });
      }
  }, [updateTrack]);

  const handleAddTrack = (type: 'audio' | 'instrument' = 'audio') => {
      const newTrack = createTrack(type, type === 'instrument' ? `Synth ${project.tracks.length + 1}` : `Audio ${project.tracks.length + 1}`);
      updateProject(prev => ({...prev, tracks: [...prev.tracks, newTrack]}));
      analytics.track('mixer_action', { action: 'add_track' });
  };

  // Determine if solo mode is active globally
  const isSoloActive = useMemo(() => project.tracks.some(t => t.solo), [project.tracks]);

  return (
    <div className="flex flex-col h-full bg-studio-bg overflow-hidden relative">
      
      {/* Mini Header / Tab Switcher */}
      <div className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center space-x-1 bg-zinc-900 rounded-md p-1 border border-zinc-800">
              <button 
                onClick={() => setTab('tracks')} 
                className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all flex items-center space-x-2 ${tab === 'tracks' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Sliders size={14} /> <span>Console</span>
              </button>
              <button 
                onClick={() => setTab('instruments')} 
                className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all flex items-center space-x-2 ${tab === 'instruments' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Music2 size={14} /> <span>Backing</span>
              </button>
          </div>
          
          {tab === 'tracks' && project.tracks.length > 0 && (
              <div className="flex gap-2">
                  <button 
                    onClick={() => handleAddTrack('audio')} 
                    className="text-zinc-400 hover:text-white flex items-center gap-2 text-xs font-bold bg-zinc-900 px-3 py-1.5 rounded-md border border-zinc-800 hover:border-zinc-600 transition-all active:scale-95"
                    title="Add Audio Track"
                  >
                      <Mic size={14} /> 
                      <span className="hidden sm:inline">Audio</span>
                  </button>
                  <button 
                    onClick={() => handleAddTrack('instrument')} 
                    className="text-zinc-400 hover:text-white flex items-center gap-2 text-xs font-bold bg-zinc-900 px-3 py-1.5 rounded-md border border-zinc-800 hover:border-zinc-600 transition-all active:scale-95"
                    title="Add Instrument Track"
                  >
                      <Piano size={14} />
                      <span className="hidden sm:inline">Synth</span>
                  </button>
              </div>
          )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {tab === 'tracks' ? (
            <div className="flex-1 flex overflow-hidden">
                {/* Scrollable Tracks Area */}
                {project.tracks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4 p-8 text-center animate-in fade-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                            <LayoutGrid size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-400">Empty Mixing Console</h3>
                            <p className="text-xs text-zinc-600 max-w-xs mx-auto">Add tracks to start mixing your project.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => handleAddTrack('audio')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-transform active:scale-95 text-xs border border-zinc-700">
                                <Mic size={14} /> Add Audio
                            </button>
                            <button onClick={() => handleAddTrack('instrument')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-transform active:scale-95 text-xs border border-zinc-700">
                                <Piano size={14} /> Add Synth
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory">
                        <div className="flex h-full min-w-max px-4 pt-4 pb-12 space-x-2">
                            {project.tracks.map(track => {
                                const isImplicitlyMuted = isSoloActive && !track.solo;
                                return (
                                    <div key={track.id} className="snap-center h-full">
                                        <MixerStrip 
                                            track={track} 
                                            updateTrack={updateTrack} 
                                            handleRenameTrack={handleRenameTrack}
                                            analytics={analytics}
                                            isImplicitlyMuted={isImplicitlyMuted}
                                        />
                                    </div>
                                );
                            })}
                            
                            {/* Spacer for adding tracks */}
                            <div className="w-20 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg m-2 opacity-50 hover:opacity-100 transition-opacity snap-center">
                                <button onClick={() => handleAddTrack('audio')} className="p-4 text-zinc-500 hover:text-white" title="Add Track">
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fixed Master Strip */}
                <div className="w-28 bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 h-full shadow-2xl z-30">
                    <div className="h-24 bg-zinc-900 border-b border-zinc-800 p-2 flex flex-col justify-between">
                        <div className="h-12 w-full bg-black rounded overflow-hidden relative">
                            <SpectrumAnalyzer height={48} color="#ef4444" />
                        </div>
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-red-500 tracking-wider">MASTER</span>
                            <button onClick={onOpenMaster} className="text-zinc-500 hover:text-white transition-colors" title="Master FX">
                                <Activity size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-3 flex justify-center relative bg-zinc-950">
                         <div className="h-full flex gap-3 z-10 py-2">
                            <CustomFader 
                                value={project.masterVolume} 
                                onChange={(v) => updateProject(p => ({...p, masterVolume: v}))} 
                                onChangeEnd={(v) => analytics.track('mixer_action', { action: 'set_master_volume', value: v })}
                                height={350}
                                defaultValue={1.0}
                            />
                            <div className="w-4 h-full">
                                <LevelMeter vertical={true} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-8">
                    {project.drone && <DroneSynth config={project.drone} onChange={(cfg) => updateProject(p => ({...p, drone: cfg}))} />}
                    {project.sequencer && <StepSequencer config={project.sequencer} onChange={(cfg) => updateProject(p => ({...p, sequencer: cfg}))} />}
                    {project.tanpura && <Tanpura config={project.tanpura} onChange={(cfg) => updateProject(p => ({...p, tanpura: cfg}))} />}
                    {project.tabla && <Tabla config={project.tabla} onChange={(cfg) => updateProject(p => ({...p, tabla: cfg}))} />}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Mixer;
