
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
    <div className="flex flex-col h-full bg-[#1a1a1a] overflow-hidden relative">
      
      {/* Mini Header / Tab Switcher */}
      <div className="h-12 border-b border-black bg-[#252525] flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
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

      <div className="flex-1 flex overflow-hidden bg-[#1e1e1e]">
        {tab === 'tracks' ? (
            <div className="flex-1 flex overflow-hidden relative">
                {/* Scrollable Tracks Area */}
                {project.tracks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4 p-8 text-center animate-in fade-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-xl">
                            <LayoutGrid size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-400">Empty Console</h3>
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
                    <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-safe pl-safe custom-scrollbar">
                        <div className="flex h-full min-w-max px-0 space-x-0">
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
                            <div className="w-24 flex flex-col items-center justify-center border-l border-r border-dashed border-zinc-800/30 bg-[#151515] snap-center shrink-0">
                                <button onClick={() => handleAddTrack('audio')} className="p-4 text-zinc-600 hover:text-zinc-400 transition-colors" title="Add Track">
                                    <Plus size={32} />
                                </button>
                            </div>
                            
                            {/* Right Spacer for Master visibility overlap */}
                            <div className="w-28 shrink-0" /> 
                        </div>
                    </div>
                )}

                {/* Fixed Master Strip Overlay (Right Side) */}
                <div className="absolute top-0 right-0 bottom-0 w-28 bg-[#181818] border-l border-black shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col shrink-0 z-30 pb-safe">
                    <div className="h-28 bg-[#202020] border-b border-black p-2 flex flex-col justify-between">
                        <div className="h-16 w-full bg-black rounded border border-white/5 overflow-hidden relative shadow-inner">
                            <SpectrumAnalyzer height={64} color="#ef4444" />
                        </div>
                        <div className="flex justify-between items-center px-1 pt-1">
                            <span className="text-[10px] font-bold text-red-500 tracking-wider">MASTER</span>
                            <button onClick={onOpenMaster} className="text-zinc-500 hover:text-white transition-colors p-1" title="Master FX">
                                <Activity size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-2 flex justify-center relative bg-[#181818]">
                         <div className="h-full flex gap-3 z-10 py-2">
                            <CustomFader 
                                value={project.masterVolume} 
                                onChange={(v) => import('../services/audio').then(({ audio }) => audio.setMasterVolume(v))} 
                                onChangeEnd={(v) => updateProject(p => ({...p, masterVolume: v}))}
                                height={320}
                                defaultValue={1.0}
                            />
                            <div className="w-4 h-full bg-black border border-white/10 rounded-sm">
                                <LevelMeter vertical={true} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto p-6 bg-[#1a1a1a]">
                <div className="max-w-4xl mx-auto space-y-8 pb-20">
                    {project.drone && <DroneSynth config={project.drone} onChange={(cfg) => updateProject(p => ({...p, drone: cfg}))} />}
                    {project.sequencer && <StepSequencer config={project.sequencer} onChange={(cfg) => updateProject(p => ({...p, sequencer: cfg}))} />}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {project.tanpura && <Tanpura config={project.tanpura} onChange={(cfg) => updateProject(p => ({...p, tanpura: cfg}))} />}
                        {project.tabla && <Tabla config={project.tabla} onChange={(cfg) => updateProject(p => ({...p, tabla: cfg}))} />}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Mixer;
