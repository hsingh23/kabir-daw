import React from 'react';
import { Track, InstrumentConfig } from '../types';
import Knob from './Knob';
import VisualEQ from './VisualEQ';
import TrackIcon, { ICONS } from './TrackIcon';
import { X, Trash2, Zap, Palette, Copy, Smile, Waves, RotateCcw } from 'lucide-react';
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

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, updateTrack, onDeleteTrack, onDuplicateTrack, onClose }) => {
  
  const updateEQ = (band: 'low' | 'mid' | 'high', value: number) => {
      updateTrack(track.id, {
          eq: {
              ...track.eq,
              [band]: value
          }
      });
  };

  const resetEQ = () => {
      updateTrack(track.id, {
          eq: { low: 0, mid: 0, high: 0 }
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

  const resetCompressor = () => {
      updateTrack(track.id, {
          compressor: {
              enabled: track.compressor?.enabled || false,
              threshold: -20,
              ratio: 4,
              attack: 0.01,
              release: 0.1
          },
          distortion: 0
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

  const togglePreFader = (type: 'reverbPre' | 'delayPre' | 'chorusPre') => {
      updateTrack(track.id, {
          sendConfig: {
              reverbPre: false, delayPre: false, chorusPre: false,
              ...track.sendConfig,
              [type]: !track.sendConfig?.[type]
          }
      });
  };

  const updateInstrument = (updates: Partial<InstrumentConfig>) => {
      if (!track.instrument) return;
      updateTrack(track.id, {
          instrument: {
              ...track.instrument,
              ...updates
          }
      });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 bg-studio-panel z-[100] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded flex items-center justify-center bg-zinc-900 shadow-inner text-zinc-400">
                    <TrackIcon icon={track.icon} name={track.name} color={track.color} />
                </div>
                <div className="flex-1 min-w-0">
                    <input 
                        value={track.name}
                        onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                        className="bg-transparent text-lg font-bold text-white outline-none w-full placeholder-zinc-500"
                        placeholder="Track Name"
                    />
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">Channel Strip</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
            
            {/* 1. Track Color & Icon */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                    <Palette size={12} className="mr-2" /> Appearance
                </h3>
                <div className="flex flex-wrap gap-2">
                    {TRACK_COLORS.map(c => (
                        <button 
                            key={c}
                            onClick={() => updateTrack(track.id, { color: c })}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${track.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-zinc-500'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>

            {/* 2. Instrument Settings (if applicable) */}
            {track.type === 'instrument' && track.instrument && (
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                        <Smile size={12} className="mr-2" /> Synth Engine
                    </h3>
                    <div className="flex gap-2 mb-4 bg-zinc-950 p-1 rounded-lg w-max">
                        {WAVEFORMS.map(w => (
                            <button
                                key={w}
                                onClick={() => updateInstrument({ preset: w as any })}
                                className={`px-3 py-1.5 rounded text-[10px] uppercase font-bold transition-colors ${track.instrument?.preset === w ? 'bg-studio-accent text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-around">
                        <Knob label="Attack" value={track.instrument.attack * 2} min={0} max={1} onChange={(v) => updateInstrument({ attack: v / 2 })} />
                        <Knob label="Decay" value={track.instrument.decay * 2} min={0} max={1} onChange={(v) => updateInstrument({ decay: v / 2 })} />
                        <Knob label="Sustain" value={track.instrument.sustain} min={0} max={1} onChange={(v) => updateInstrument({ sustain: v })} />
                        <Knob label="Release" value={track.instrument.release / 2} min={0} max={1} onChange={(v) => updateInstrument({ release: v * 2 })} />
                    </div>
                </div>
            )}

            {/* 3. EQ */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                        <Waves size={12} className="mr-2" /> Equalizer
                    </h3>
                    <button onClick={resetEQ} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white" title="Reset EQ">
                        <RotateCcw size={12} />
                    </button>
                </div>
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
                <div className="flex justify-around">
                    <Knob label="Low" value={(track.eq.low + 12)/24} min={0} max={1} onChange={(v) => updateEQ('low', (v*24)-12)} />
                    <Knob label="Mid" value={(track.eq.mid + 12)/24} min={0} max={1} onChange={(v) => updateEQ('mid', (v*24)-12)} />
                    <Knob label="High" value={(track.eq.high + 12)/24} min={0} max={1} onChange={(v) => updateEQ('high', (v*24)-12)} />
                </div>
            </div>

            {/* 4. Dynamics (Compressor + Distortion) */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                        <Zap size={12} className="mr-2" /> Dynamics
                    </h3>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => updateCompressor({ enabled: !track.compressor?.enabled })}
                            className={`w-8 h-4 rounded-full transition-colors ${track.compressor?.enabled ? 'bg-studio-accent' : 'bg-zinc-700'}`}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${track.compressor?.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>
                
                <div className={`transition-opacity duration-200 ${track.compressor?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="flex justify-around mb-6">
                        <Knob label="Thresh" value={(track.compressor?.threshold || -20) + 60} min={0} max={60} onChange={(v) => updateCompressor({ threshold: v - 60 })} />
                        <Knob label="Ratio" value={((track.compressor?.ratio || 4) - 1) / 19} min={0} max={1} onChange={(v) => updateCompressor({ ratio: 1 + (v * 19) })} />
                        <Knob label="Attack" value={(track.compressor?.attack || 0.01) * 10} min={0} max={1} onChange={(v) => updateCompressor({ attack: v / 10 })} />
                    </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 mt-4">
                    <div className="flex items-center gap-4">
                        <Knob label="Distortion" value={track.distortion || 0} min={0} max={1} onChange={(v) => updateTrack(track.id, { distortion: v })} />
                        <div className="flex-1">
                            <p className="text-[10px] text-zinc-500 mb-1">Saturation</p>
                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${(track.distortion || 0) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Sends */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                    <Waves size={12} className="mr-2" /> FX Sends
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center gap-2">
                        <Knob label="Reverb" value={track.sends.reverb} min={0} max={1} onChange={(v) => updateSend('reverb', v)} />
                        <button onClick={() => togglePreFader('reverbPre')} className={`text-[9px] px-1.5 py-0.5 rounded border ${track.sendConfig.reverbPre ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'border-zinc-700 text-zinc-500'}`}>
                            {track.sendConfig.reverbPre ? 'PRE' : 'POST'}
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Knob label="Delay" value={track.sends.delay} min={0} max={1} onChange={(v) => updateSend('delay', v)} />
                        <button onClick={() => togglePreFader('delayPre')} className={`text-[9px] px-1.5 py-0.5 rounded border ${track.sendConfig.delayPre ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'border-zinc-700 text-zinc-500'}`}>
                            {track.sendConfig.delayPre ? 'PRE' : 'POST'}
                        </button>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Knob label="Chorus" value={track.sends.chorus} min={0} max={1} onChange={(v) => updateSend('chorus', v)} />
                        <button onClick={() => togglePreFader('chorusPre')} className={`text-[9px] px-1.5 py-0.5 rounded border ${track.sendConfig.chorusPre ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'border-zinc-700 text-zinc-500'}`}>
                            {track.sendConfig.chorusPre ? 'PRE' : 'POST'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                    onClick={() => onDuplicateTrack && onDuplicateTrack(track.id)}
                    className="py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center space-x-2 transition-colors border border-zinc-700"
                >
                    <Copy size={16} />
                    <span>Duplicate</span>
                </button>
                <button 
                    onClick={() => onDeleteTrack && onDeleteTrack(track.id)}
                    className="py-3 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold text-sm flex items-center justify-center space-x-2 transition-colors border border-red-900/30"
                >
                    <Trash2 size={16} />
                    <span>Delete</span>
                </button>
            </div>

            <div className="h-4" /> {/* Spacer */}
        </div>

        {/* Floating Mute/Solo/Fader strip at bottom */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-700 flex items-center space-x-4">
             <div className="flex items-center gap-2">
                 <button 
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`w-10 h-10 rounded-lg font-bold border transition-all ${track.muted ? 'bg-red-500 border-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                 >
                     M
                 </button>
                 <button 
                    onClick={() => updateTrack(track.id, { solo: !track.solo })}
                    className={`w-10 h-10 rounded-lg font-bold border transition-all ${track.solo ? 'bg-yellow-500 border-yellow-600 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700'}`}
                 >
                     S
                 </button>
             </div>
             <div className="flex-1">
                 <div className="flex justify-between text-xs text-zinc-500 mb-1 font-mono">
                     <span>VOL</span>
                     <span>{Math.round(track.volume * 100)}%</span>
                 </div>
                 <input 
                    type="range" min={0} max={1} step={0.01}
                    value={track.volume}
                    onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                 />
             </div>
             <div className="w-20">
                 <div className="flex justify-between text-xs text-zinc-500 mb-1 font-mono">
                     <span>PAN</span>
                     <span>{Math.round(track.pan * 50)}</span>
                 </div>
                 <input 
                    type="range" min={-1} max={1} step={0.01}
                    value={track.pan}
                    onChange={(e) => updateTrack(track.id, { pan: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500"
                 />
             </div>
        </div>
    </div>
  );
};

export default TrackInspector;