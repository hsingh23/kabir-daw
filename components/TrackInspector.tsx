
import React from 'react';
import { Track, InstrumentConfig } from '../types';
import Knob from './Knob';
import VisualEQ from './VisualEQ';
import TrackIcon from './TrackIcon';
import { X, Trash2, Copy } from 'lucide-react';

interface TrackInspectorProps {
  track: Track;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  onDeleteTrack?: (id: string) => void;
  onDuplicateTrack?: (id: string) => void;
  onClose: () => void;
}

const TRACK_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#71717a'
];

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

// Moved PluginSlot outside to prevent recreation on every render
// Made children optional to satisfy potential TS strictness on usage sites
const PluginSlot = ({ label, active, children, onToggle }: { label: string, active: boolean, children?: React.ReactNode, onToggle?: () => void }) => (
    <div className={`mb-3 bg-[#222] border border-black rounded-lg overflow-hidden transition-all ${active ? 'opacity-100' : 'opacity-70 grayscale'}`}>
        <div className="bg-[#2a2a2a] px-3 py-1.5 border-b border-black flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
            {onToggle && (
                <button onClick={onToggle} className={`w-3 h-3 rounded-full border border-black/50 shadow-inner ${active ? 'bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'bg-[#111]'}`} />
            )}
        </div>
        <div className="p-3">
            {children}
        </div>
    </div>
);

const TrackInspector: React.FC<TrackInspectorProps> = ({ track, updateTrack, onDeleteTrack, onDuplicateTrack, onClose }) => {
  
  const updateEQ = (band: 'low' | 'mid' | 'high', value: number) => {
      updateTrack(track.id, { eq: { ...track.eq, [band]: value } });
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
      updateTrack(track.id, { sends: { reverb: 0, delay: 0, chorus: 0, ...track.sends, [type]: value } });
  };

  const updateInstrument = (updates: Partial<InstrumentConfig>) => {
      if (!track.instrument) return;
      updateTrack(track.id, { instrument: { ...track.instrument, ...updates } });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#1a1a1a] border-l border-black z-[100] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-black bg-[#252525]">
            <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-black/40 shadow-inner text-zinc-400">
                    <TrackIcon icon={track.icon} name={track.name} color={track.color} size={12} />
                </div>
                <input 
                    value={track.name}
                    onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                    className="bg-transparent text-sm font-bold text-zinc-200 outline-none w-32 placeholder-zinc-500 focus:text-white"
                    placeholder="Track Name"
                />
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            
            {/* 1. Synth Engine (Dynamic) */}
            {track.type === 'instrument' && track.instrument && (
                <PluginSlot label="Synthesizer" active={true}>
                    <div className="flex gap-1 mb-3 bg-black p-0.5 rounded-md">
                        {WAVEFORMS.map(w => (
                            <button
                                key={w}
                                onClick={() => updateInstrument({ preset: w as any })}
                                className={`flex-1 py-1 rounded text-[9px] uppercase font-bold transition-all ${track.instrument?.preset === w ? 'bg-studio-accent text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                {w.slice(0,3)}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between px-1">
                        <Knob label="Atk" value={track.instrument.attack * 2} min={0} max={1} onChange={(v) => updateInstrument({ attack: v / 2 })} size={36} />
                        <Knob label="Dec" value={track.instrument.decay * 2} min={0} max={1} onChange={(v) => updateInstrument({ decay: v / 2 })} size={36} />
                        <Knob label="Sus" value={track.instrument.sustain} min={0} max={1} onChange={(v) => updateInstrument({ sustain: v })} size={36} />
                        <Knob label="Rel" value={track.instrument.release / 2} min={0} max={1} onChange={(v) => updateInstrument({ release: v * 2 })} size={36} />
                    </div>
                </PluginSlot>
            )}

            {/* 2. Channel EQ */}
            <PluginSlot label="Channel EQ" active={true}>
                <div className="mb-3">
                    <VisualEQ 
                        low={track.eq.low}
                        mid={track.eq.mid}
                        high={track.eq.high}
                        onChangeLow={(v) => updateEQ('low', v)}
                        onChangeMid={(v) => updateEQ('mid', v)}
                        onChangeHigh={(v) => updateEQ('high', v)}
                    />
                </div>
                <div className="flex justify-between px-2">
                    <Knob label="Low" value={(track.eq.low + 12)/24} min={0} max={1} onChange={(v) => updateEQ('low', (v*24)-12)} size={40} color="#f87171" />
                    <Knob label="Mid" value={(track.eq.mid + 12)/24} min={0} max={1} onChange={(v) => updateEQ('mid', (v*24)-12)} size={40} color="#fbbf24" />
                    <Knob label="High" value={(track.eq.high + 12)/24} min={0} max={1} onChange={(v) => updateEQ('high', (v*24)-12)} size={40} color="#34d399" />
                </div>
            </PluginSlot>

            {/* 3. Compressor */}
            <PluginSlot 
                label="Compressor" 
                active={!!track.compressor?.enabled}
                onToggle={() => updateCompressor({ enabled: !track.compressor?.enabled })}
            >
                <div className="flex justify-between px-2 mb-3">
                    <Knob label="Thresh" value={(track.compressor?.threshold || -20) + 60} min={0} max={60} onChange={(v) => updateCompressor({ threshold: v - 60 })} size={36} />
                    <Knob label="Ratio" value={((track.compressor?.ratio || 4) - 1) / 19} min={0} max={1} onChange={(v) => updateCompressor({ ratio: 1 + (v * 19) })} size={36} />
                    <Knob label="Drive" value={track.distortion || 0} min={0} max={1} onChange={(v) => updateTrack(track.id, { distortion: v })} size={36} color="#f97316" />
                </div>
            </PluginSlot>

            {/* 4. Sends */}
            <div className="bg-[#222] border border-black rounded-lg p-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block px-1">Sends</span>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 bg-black/30 p-1 rounded">
                        <span className="text-[10px] text-zinc-400 w-10">Reverb</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${track.sends.reverb * 100}%` }} />
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={track.sends.reverb} onChange={(e) => updateSend('reverb', parseFloat(e.target.value))} className="w-12 h-1 opacity-0 absolute" />
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 p-1 rounded">
                        <span className="text-[10px] text-zinc-400 w-10">Delay</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${track.sends.delay * 100}%` }} />
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={track.sends.delay} onChange={(e) => updateSend('delay', parseFloat(e.target.value))} className="w-12 h-1 opacity-0 absolute" />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                <button 
                    onClick={() => onDuplicateTrack && onDuplicateTrack(track.id)}
                    className="py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700"
                >
                    <Copy size={12} /> Duplicate
                </button>
                <button 
                    onClick={() => onDeleteTrack && onDeleteTrack(track.id)}
                    className="py-2 rounded bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-500 text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700"
                >
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        </div>
    </div>
  );
};

export default TrackInspector;
