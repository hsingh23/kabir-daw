
import React from 'react';
import { Track } from '../types';
import Knob from './Knob';
import VisualEQ from './VisualEQ';
import TrackIcon, { ICONS } from './TrackIcon';
import { X, Trash2, Zap, Palette, Copy, Smile } from 'lucide-react';
import CustomFader from './Fader';

interface TrackInspectorProps {
  track: Track;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  onDeleteTrack?: (id: string) => void;
  onDuplicateTrack?: (id: string) => void;
  onClose: () => void;
}

const TRACK_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#71717a', // Zinc
];

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, updateTrack, onDeleteTrack, onDuplicateTrack, onClose }) => {
  
  const updateEQ = (band: 'low' | 'mid' | 'high', value: number) => {
      updateTrack(track.id, {
          eq: {
              ...track.eq,
              [band]: value
          }
      });
  };

  const updateCompressor = (updates: Partial<NonNullable<Track['compressor']>>) => {
      updateTrack(track.id, {
          compressor: {
              enabled: false,
              threshold: -20,
              ratio: 4,
              attack: 0.01,
              release: 0.1,
              ...track.compressor,
              ...updates
          }
      });
  };

  const updateSend = (type: 'reverb' | 'delay' | 'chorus', value: number) => {
      updateTrack(track.id, {
          sends: {
              reverb: 0, delay: 0, chorus: 0,
              ...track.sends,
              [type]: value
          }
      });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 bg-studio-panel z-[100] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded flex items-center justify-center bg-zinc-900 shadow-inner">
                <TrackIcon icon={track.icon} name={track.name} color={track.color} size={20} />
             </div>
             <div>
                 <input 
                    value={track.name}
                    onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                    className="bg-transparent text-lg font-bold text-white outline-none w-full placeholder-zinc-500 focus:text-studio-accent"
                 />
                 <p className="text-xs text-zinc-400 uppercase tracking-widest">Channel Strip</p>
             </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Color Picker */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 tracking-wider flex items-center">
                        <Palette size={12} className="mr-2" /> Track Color
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {TRACK_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => updateTrack(track.id, { color })}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${track.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-zinc-500'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
              </div>

              {/* Icon Picker */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 tracking-wider flex items-center">
                        <Smile size={12} className="mr-2" /> Track Icon
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(ICONS).map(([key, Icon]) => (
                            <button
                                key={key}
                                onClick={() => updateTrack(track.id, { icon: key })}
                                className={`p-2 rounded-lg transition-all ${track.icon === key ? 'bg-zinc-700 text-white shadow-sm' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'}`}
                                title={key}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
              {/* EQ Section (Now Full Width) */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                      EQ
                  </h3>
                  
                  {/* Visualizer */}
                  <div className="mb-4">
                      <VisualEQ 
                        low={track.eq.low}
                        mid={track.eq.mid}
                        high={track.eq.high}
                        onChangeLow={(v) => updateEQ('low', v)}
                        onChangeMid={(v) => updateEQ('mid', v)}
                        onChangeHigh={(v) => updateEQ('high', v)}
                      />
                  </div>

                  <div className="flex justify-around items-center">
                      <Knob 
                        label="Low" 
                        value={(track.eq.low + 12) / 24} // map -12..12 to 0..1
                        min={0} max={1}
                        onChange={(v) => updateEQ('low', (v * 24) - 12)} 
                      />
                      <Knob 
                        label="Mid" 
                        value={(track.eq.mid + 12) / 24} 
                        min={0} max={1}
                        onChange={(v) => updateEQ('mid', (v * 24) - 12)} 
                      />
                      <Knob 
                        label="High" 
                        value={(track.eq.high + 12) / 24} 
                        min={0} max={1}
                        onChange={(v) => updateEQ('high', (v * 24) - 12)} 
                      />
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {/* Dynamics Section */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50 relative">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${track.compressor?.enabled ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-zinc-700'}`}></span>
                          Dynamics
                      </h3>
                      <button 
                         onClick={() => updateCompressor({ enabled: !track.compressor?.enabled })}
                         className={`p-1.5 rounded-md transition-colors ${track.compressor?.enabled ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-600'}`}
                      >
                          <Zap size={14} fill={track.compressor?.enabled ? "currentColor" : "none"} />
                      </button>
                  </div>
                  
                  <div className={`flex justify-around items-center transition-opacity ${track.compressor?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <Knob 
                        label="Drive" 
                        value={track.distortion || 0}
                        min={0} max={1}
                        onChange={(v) => updateTrack(track.id, { distortion: v })}
                      />
                      <Knob 
                        label="Thresh" 
                        value={((track.compressor?.threshold ?? -20) + 60) / 60} // -60 to 0
                        min={0} max={1}
                        onChange={(v) => updateCompressor({ threshold: (v * 60) - 60 })} 
                      />
                      <Knob 
                        label="Ratio" 
                        value={((track.compressor?.ratio ?? 4) - 1) / 19} // 1 to 20
                        min={0} max={1}
                        onChange={(v) => updateCompressor({ ratio: 1 + (v * 19) })} 
                      />
                  </div>
              </div>

              {/* FX Sends Section */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                      FX Sends
                  </h3>
                  <div className="flex justify-around items-center">
                      <Knob 
                        label="Reverb" 
                        value={track.sends?.reverb ?? 0}
                        min={0} max={1}
                        onChange={(v) => updateSend('reverb', v)} 
                      />
                      <Knob 
                        label="Delay" 
                        value={track.sends?.delay ?? 0}
                        min={0} max={1}
                        onChange={(v) => updateSend('delay', v)} 
                      />
                      <Knob 
                        label="Chorus" 
                        value={track.sends?.chorus ?? 0}
                        min={0} max={1}
                        onChange={(v) => updateSend('chorus', v)} 
                      />
                  </div>
              </div>
          </div>

          {/* Fader & Pan Section */}
          <div className="flex-1 flex justify-center space-x-8 items-end h-64 bg-zinc-900/30 rounded-xl border border-zinc-800 p-4">
              <div className="flex flex-col items-center space-y-4">
                  <Knob 
                    label="Pan" 
                    value={(track.pan + 1) / 2} 
                    min={0} max={1}
                    onChange={(v) => updateTrack(track.id, { pan: (v * 2) - 1 })} 
                  />
                  <div className="text-xs text-zinc-400 font-mono">{track.pan.toFixed(2)}</div>
              </div>

              <div className="h-full flex flex-col items-center space-y-4 pt-4">
                  <CustomFader 
                    value={track.volume} 
                    onChange={(v) => updateTrack(track.id, { volume: v })} 
                    height={200}
                  />
                  <div className="text-xs text-zinc-400 font-mono">{Math.round(track.volume * 100)}%</div>
              </div>
          </div>
          
          {/* Controls */}
          <div className="flex justify-center space-x-4">
                <button 
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors ${track.muted ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}
                >Mute</button>
                <button 
                    onClick={() => updateTrack(track.id, { solo: !track.solo })}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors ${track.solo ? 'bg-yellow-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}
                >Solo</button>
          </div>

          {/* Actions */}
          <div className="pt-8 border-t border-zinc-700 grid grid-cols-2 gap-4">
              {onDuplicateTrack && (
                  <button 
                      onClick={() => onDuplicateTrack(track.id)}
                      className="py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
                  >
                      <Copy size={16} />
                      <span>Duplicate</span>
                  </button>
              )}
              
              {onDeleteTrack && (
                  <button 
                      onClick={() => onDeleteTrack(track.id)}
                      className="py-3 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 flex items-center justify-center space-x-2 transition-colors"
                  >
                      <Trash2 size={16} />
                      <span>Delete</span>
                  </button>
              )}
          </div>

      </div>
    </div>
  );
};

export default TrackInspector;
