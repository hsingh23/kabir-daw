import React, { useState, useEffect } from 'react';
import { ProjectState } from '../types';
import Knob from './Knob';
import CustomFader from './Fader';
import Tanpura from './Tanpura';
import Tabla from './Tabla';
import { Play, Pause, Square, Circle, Sliders, Music2 } from 'lucide-react';

interface MixerProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onRecord: () => void;
}

const Mixer: React.FC<MixerProps> = ({ project, setProject, isPlaying, onPlayPause, onStop, onRecord }) => {
  // Initialize tab from URL or default to 'tracks'
  const [tab, setTab] = useState<'tracks' | 'instruments'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('mixerTab') as 'tracks' | 'instruments') || 'tracks';
  });

  // Sync tab changes to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'tracks') {
        url.searchParams.delete('mixerTab'); // clean URL for default
    } else {
        url.searchParams.set('mixerTab', tab);
    }
    window.history.replaceState({}, '', url);
  }, [tab]);

  const updateTrack = (id: string, updates: Partial<typeof project.tracks[0]>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  return (
    <div className="flex flex-col h-full bg-studio-bg overflow-y-auto no-scrollbar pb-24">
      
      {/* Top Effects Section */}
      <div className="p-6 bg-gradient-to-b from-zinc-800 to-studio-bg border-b border-zinc-700 shadow-xl z-20">
        <div className="flex justify-around items-center max-w-md mx-auto">
           <Knob 
            label="Reverb" 
            value={project.effects.reverb} 
            onChange={(v) => setProject(p => ({...p, effects: {...p.effects, reverb: v}}))} 
            defaultValue={0.2}
           />
           <Knob 
            label="Delay" 
            value={project.effects.delay} 
            onChange={(v) => setProject(p => ({...p, effects: {...p.effects, delay: v}}))} 
            defaultValue={0.1}
           />
           <Knob 
            label="Master" 
            value={project.masterVolume} 
            onChange={(v) => setProject(p => ({...p, masterVolume: v}))} 
            defaultValue={1.0}
           />
        </div>
      </div>

      {/* Main Display / Transport */}
      <div className="py-8 text-center space-y-4 bg-studio-bg relative">
          <h2 className="text-2xl font-light text-zinc-200 tracking-widest uppercase">Studio Mix</h2>
          
          <div className="flex items-center justify-center space-x-8">
              <button 
                onClick={onStop}
                className="w-12 h-12 rounded-full bg-zinc-800 shadow-knob flex items-center justify-center active:scale-95 transition-transform"
              >
                  <Square fill="currentColor" size={16} className="text-zinc-400" />
              </button>

              <button 
                onClick={onRecord}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-900 to-red-600 shadow-knob border-4 border-zinc-800 flex items-center justify-center active:scale-95 transition-transform"
              >
                  <Circle fill="white" size={20} className="text-white" />
              </button>

              <button 
                onClick={onPlayPause}
                className="w-12 h-12 rounded-full bg-zinc-800 shadow-knob flex items-center justify-center active:scale-95 transition-transform"
              >
                 {isPlaying ? 
                    <Pause fill="currentColor" size={18} className="text-zinc-200" /> : 
                    <Play fill="currentColor" size={18} className="text-zinc-200 ml-1" />
                 }
              </button>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-6">
          <div className="bg-zinc-900 rounded-full p-1 flex space-x-1 border border-zinc-800">
              <button 
                onClick={() => setTab('tracks')} 
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${tab === 'tracks' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Sliders size={14} /> <span>Faders</span>
              </button>
              <button 
                onClick={() => setTab('instruments')} 
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${tab === 'instruments' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Music2 size={14} /> <span>Backing</span>
              </button>
          </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 px-4 overflow-x-auto pb-8">
        {tab === 'tracks' ? (
            <div className="flex space-x-4 min-w-max px-4 justify-center">
                {project.tracks.map(track => (
                    <div key={track.id} className="flex flex-col items-center space-y-3 group p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate w-16 text-center">{track.name}</span>
                        
                        {/* Mute/Solo Buttons */}
                        <div className="flex space-x-1">
                            <button 
                                onClick={() => updateTrack(track.id, { muted: !track.muted })}
                                className={`w-6 h-6 rounded text-[10px] font-bold ${track.muted ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-zinc-800 text-zinc-400'}`}
                            >M</button>
                            <button 
                                onClick={() => updateTrack(track.id, { solo: !track.solo })}
                                className={`w-6 h-6 rounded text-[10px] font-bold ${track.solo ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-zinc-800 text-zinc-400'}`}
                            >S</button>
                        </div>

                        <CustomFader 
                            value={track.volume} 
                            onChange={(v) => updateTrack(track.id, { volume: v })} 
                            height={200}
                            defaultValue={0.8}
                        />
                        
                        <div className="w-full flex justify-center">
                            <div className="w-8 h-8 rounded shadow-md opacity-80" style={{ backgroundColor: track.color }} />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="max-w-md mx-auto space-y-6">
                <Tanpura 
                    config={project.tanpura} 
                    onChange={(cfg) => setProject(p => ({...p, tanpura: cfg}))} 
                />
                <Tabla 
                    config={project.tabla} 
                    onChange={(cfg) => setProject(p => ({...p, tabla: cfg}))} 
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default Mixer;