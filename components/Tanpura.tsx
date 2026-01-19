import React from 'react';
import { TanpuraState } from '../types';
import Knob from './Knob';

interface TanpuraProps {
  config: TanpuraState;
  onChange: (config: TanpuraState) => void;
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const Tanpura: React.FC<TanpuraProps> = ({ config, onChange }) => {
  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm">Tanpura Drone</h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-colors ${config.enabled ? 'bg-studio-accent text-white' : 'bg-zinc-800 text-zinc-500'}`}
            >
                <div className="w-3 h-3 rounded-full bg-current shadow-sm" />
            </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Key</label>
                <div className="flex flex-wrap gap-1">
                    {KEYS.map(k => (
                        <button 
                            key={k}
                            onClick={() => onChange({ ...config, key: k })}
                            className={`w-6 h-6 text-[10px] rounded font-bold ${config.key === k ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                            {k}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">First String</label>
                <div className="flex space-x-1">
                    {['Pa', 'Ma', 'Ni'].map(t => (
                        <button 
                            key={t}
                            onClick={() => onChange({ ...config, tuning: t as any })}
                            className={`flex-1 py-1 text-[10px] rounded font-bold ${config.tuning === t ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex justify-around pt-2">
            <Knob 
                label="Tempo" 
                value={(config.tempo - 30) / 90} // Range 30-120
                min={0} max={1}
                onChange={(v) => onChange({ ...config, tempo: 30 + (v * 90) })}
            />
            <Knob 
                label="Volume" 
                value={config.volume} 
                min={0} max={1}
                onChange={(v) => onChange({ ...config, volume: v })}
            />
        </div>
        <div className="text-center text-[10px] text-zinc-500 font-mono">
            {Math.round(config.tempo)} BPM
        </div>
    </div>
  );
};

export default Tanpura;