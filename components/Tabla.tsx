import React from 'react';
import { TablaState } from '../types';
import Knob from './Knob';

interface TablaProps {
  config: TablaState;
  onChange: (config: TablaState) => void;
}

const TAALS = ['TeenTaal', 'Keherwa', 'Dadra'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const Tabla: React.FC<TablaProps> = ({ config, onChange }) => {
  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm">Tabla Percussion</h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-colors ${config.enabled ? 'bg-studio-accent text-white' : 'bg-zinc-800 text-zinc-500'}`}
            >
                <div className="w-3 h-3 rounded-full bg-current shadow-sm" />
            </button>
        </div>

        <div className="flex flex-col space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Taal Pattern</label>
            <div className="flex space-x-1">
                {TAALS.map(t => (
                    <button 
                        key={t}
                        onClick={() => onChange({ ...config, taal: t })}
                        className={`flex-1 py-1.5 text-[10px] rounded font-bold ${config.taal === t ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col space-y-2">
             <label className="text-[10px] text-zinc-500 font-bold uppercase">Tuning (Dayan)</label>
             <select 
                value={config.key} 
                onChange={(e) => onChange({...config, key: e.target.value})}
                className="bg-zinc-800 text-zinc-200 text-xs p-1 rounded border-none outline-none"
             >
                 {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
             </select>
        </div>

        <div className="flex justify-around pt-2">
            <Knob 
                label="BPM" 
                value={(config.bpm - 60) / 140} // Range 60-200
                min={0} max={1}
                onChange={(v) => onChange({ ...config, bpm: 60 + (v * 140) })}
            />
            <Knob 
                label="Volume" 
                value={config.volume} 
                min={0} max={1}
                onChange={(v) => onChange({ ...config, volume: v })}
            />
        </div>
        <div className="text-center text-[10px] text-zinc-500 font-mono">
            {Math.round(config.bpm)} BPM
        </div>
    </div>
  );
};

export default Tabla;