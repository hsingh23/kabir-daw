
import React, { useEffect, useState } from 'react';
import Knob from './Knob';
import { audio } from '../services/audio';
import { Loader2 } from 'lucide-react';

interface TablaState {
  enabled: boolean;
  volume: number;
  taal: string;
  bpm: number;
  key: string;
}

interface TablaProps {
  config: TablaState;
  onChange: (config: TablaState) => void;
}

// Configuration from requirements
const TAAL_GROUPS: Record<string, string[]> = {
    high: ['teen_taal', 'roopak', 'ektaal', 'bhajani'], // 80-200
    low: ['dadra', 'jhaptaal', 'kehrwa'] // 80-150
};

const ALL_TAALS = [...TAAL_GROUPS.high, ...TAAL_GROUPS.low];

const KEYS = [
    "c", "c_sharp", "d", "d_sharp", "e", "f", 
    "f_sharp", "g", "g_sharp", "a", "a_sharp", "b"
];

const formatKey = (k: string) => k.replace('_sharp', '#').toUpperCase();
const formatTaal = (t: string) => t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const Tabla: React.FC<TablaProps> = ({ config, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);

  // Determine valid BPM range based on selected taal
  const isHighRange = TAAL_GROUPS.high.includes(config.taal);
  const minBpm = 80;
  const maxBpm = isHighRange ? 200 : 150;

  // Validate and snap BPM on mount/change
  useEffect(() => {
      let newBpm = config.bpm;
      
      // Clamp
      if (newBpm < minBpm) newBpm = minBpm;
      if (newBpm > maxBpm) newBpm = maxBpm;
      
      // Snap to 5
      const remainder = newBpm % 5;
      if (remainder !== 0) {
          newBpm = newBpm - remainder + (remainder >= 2.5 ? 5 : 0);
      }
      
      // Ensure we don't exceed bounds after snap
      if (newBpm > maxBpm) newBpm = maxBpm;
      if (newBpm < minBpm) newBpm = minBpm;

      if (newBpm !== config.bpm) {
          onChange({ ...config, bpm: newBpm });
      }
  }, [config.taal]);

  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm flex items-center gap-2">
                Tabla Loop
                {isLoading && <Loader2 size={12} className="animate-spin text-zinc-500" />}
            </h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-colors ${config.enabled ? 'bg-studio-accent text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
            >
                <div className="w-3 h-3 rounded-full bg-current shadow-sm" />
            </button>
        </div>

        <div className="flex flex-col space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Taal</label>
            <div className="grid grid-cols-2 gap-1 bg-zinc-950/30 p-1 rounded-lg">
                {ALL_TAALS.map(t => (
                    <button 
                        key={t}
                        onClick={() => onChange({ ...config, taal: t })}
                        className={`py-1.5 px-2 text-[10px] rounded font-bold transition-colors truncate ${config.taal === t ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        {formatTaal(t)}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col space-y-2">
             <label className="text-[10px] text-zinc-500 font-bold uppercase">Key</label>
             <div className="grid grid-cols-6 gap-1">
                 {KEYS.map(k => (
                    <button 
                        key={k}
                        onClick={() => onChange({...config, key: k})}
                        className={`h-8 text-[10px] rounded font-bold transition-colors ${config.key === k ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        {formatKey(k)}
                    </button>
                 ))}
             </div>
        </div>

        <div className="flex justify-around pt-2">
            <Knob 
                label="BPM" 
                value={(config.bpm - minBpm) / (maxBpm - minBpm)} 
                min={0} max={1}
                onChange={(v) => {
                    // Map 0-1 to min-max range
                    let rawBpm = minBpm + (v * (maxBpm - minBpm));
                    // Snap to 5
                    let snapped = Math.round(rawBpm / 5) * 5;
                    // Clamp
                    snapped = Math.max(minBpm, Math.min(maxBpm, snapped));
                    onChange({ ...config, bpm: snapped });
                }}
            />
            <Knob 
                label="Volume" 
                value={config.volume} 
                min={0} max={1}
                onChange={(v) => onChange({ ...config, volume: v })}
            />
        </div>
        <div className="text-center text-[10px] text-zinc-500 font-mono">
            {config.bpm} BPM
        </div>
    </div>
  );
};

export default Tabla;
