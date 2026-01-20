import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectState, Track } from '../types';
import CustomFader from './Fader';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import LevelMeter from './LevelMeter';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import MixerStrip from './MixerStrip';
import { Sliders, Music2, Activity, Plus, Mic, Piano } from 'lucide-react';
import { analytics } from '../services/analytics';

interface MixerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onOpenMaster: () => void;
}

const CLIP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#71717a'
];

const Mixer: React.FC<MixerProps> = ({ project, setProject, onOpenMaster }) => {
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
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  }, [setProject]);

  const handleRenameTrack = useCallback((trackId: string, currentName: string) => {
      const newName = prompt('Rename Track', currentName);
      if (newName) {
          updateTrack(trackId, { name: newName });
          analytics.track('mixer_action', { action: 'rename_track', trackId });
      }
  }, [updateTrack]);

  const handleAddTrack = (type: 'audio' | 'instrument' = 'audio') => {
      const newTrack: Track = {
          id: crypto.randomUUID(),
          type,
          name: type === 'instrument' ? `Synth ${project.tracks.length + 1}` : `Audio ${project.tracks.length + 1}`,
          volume: 0.8, pan: 0, muted: false, solo: false, 
          color: CLIP_COLORS[project.tracks.length % CLIP_COLORS.length],
          icon: type === 'instrument' ? 'keyboard' : 'music',
          instrument: type === 'instrument' ? { type: 'synth', preset: 'sawtooth', attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.2 } : undefined,
          eq: { low: 0, mid: 0, high: 0 },
          compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
          sends: { reverb: 0, delay: 0, chorus: 0 },
          sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
      };
      setProject(prev => ({...prev, tracks: [...prev.tracks, newTrack]}));
      analytics.track('mixer_action', { action: 'add_track' });
  };

  // Determine if solo mode is active globally
  const isSoloActive = useMemo(() => project.tracks.some(t => t.solo), [project.tracks]);

  return (
    <div className="flex flex-col h-full bg-studio-bg overflow-hidden relative">
      
      {/* Mini Header / Tab Switcher */}
      <div className="h-10 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center space-x-1 bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
              <button 
                onClick={() => setTab('tracks')} 
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all flex items-center space-x-1 ${tab === 'tracks' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Sliders size={12} /> <span>Console</span>
              </button>
              <button 
                onClick={() => setTab('instruments')} 
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all flex items-center space-x-1 ${tab === 'instruments' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Music2 size={12} /> <span>Backing</span>
              </button>
          </div>
          
          {tab === 'tracks' && (
              <div className="flex gap-2">
                  <button onClick={() => handleAddTrack('audio')} className="text-zinc-500 hover:text-white flex items-center gap-1 text-[10px] font-bold bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      <Mic size={12} /> + Audio
                  </button>
                  <button onClick={() => handleAddTrack('instrument')} className="text-zinc-500 hover:text-white flex items-center gap-1 text-[10px] font-bold bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      <Piano size={12} /> + Synth
                  </button>
              </div>
          )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {tab === 'tracks' ? (
            <div className="flex-1 flex overflow-hidden">
                {/* Scrollable Tracks Area */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex h-full min-w-max px-4 pt-4 pb-12 space-x-2">
                        {project.tracks.map(track => {
                            // If solo mode is active, any track not soloed is implicitly muted
                            const isImplicitlyMuted = isSoloActive && !track.solo;
                            return (
                                <MixerStrip 
                                    key={track.id} 
                                    track={track} 
                                    updateTrack={updateTrack} 
                                    handleRenameTrack={handleRenameTrack}
                                    analytics={analytics}
                                    isImplicitlyMuted={isImplicitlyMuted}
                                />
                            );
                        })}
                        
                        {/* Spacer for adding tracks */}
                        <div className="w-20 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg m-2 opacity-50 hover:opacity-100 transition-opacity">
                            <button onClick={() => handleAddTrack('audio')} className="p-4 text-zinc-500 hover:text-white">
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Fixed Master Strip */}
                <div className="w-28 bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 h-full shadow-2xl z-30">
                    <div className="h-24 bg-zinc-900 border-b border-zinc-800 p-2 flex flex-col justify-between">
                        <div className="h-12 w-full bg-black rounded overflow-hidden relative">
                            <SpectrumAnalyzer height={48} color="#ef4444" />
                        </div>
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-red-500 tracking-wider">MASTER</span>
                            <button onClick={onOpenMaster} className="text-zinc-500 hover:text-white" title="Master FX">
                                <Activity size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-3 flex justify-center relative bg-zinc-950">
                         <div className="h-full flex gap-3 z-10 py-2">
                            <CustomFader 
                                value={project.masterVolume} 
                                onChange={(v) => setProject(p => ({...p, masterVolume: v}))} 
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
                <div className="max-w-2xl mx-auto space-y-8">
                    <Tanpura config={project.tanpura} onChange={(cfg) => setProject(p => ({...p, tanpura: cfg}))} />
                    <Tabla config={project.tabla} onChange={(cfg) => setProject(p => ({...p, tabla: cfg}))} />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Mixer;