
import React, { useEffect, useState } from 'react';
import Knob from './Knob';
import { Loader2, Power } from 'lucide-react';

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

const TAAL_GROUPS: Record<string, string[]> = {
    high: ['teen_taal', 'roopak', 'ektaal', 'bhajani'], 
    low: ['dadra', 'jhaptaal', 'kehrwa'] 
};

const ALL_TAALS = [...TAAL_GROUPS.high, ...TAAL_GROUPS.low];
const KEYS = ["c", "c_sharp", "d", "d_sharp", "e", "f", "f_sharp", "g", "g_sharp", "a", "a_sharp", "b"];
const formatKey = (k: string) => k.replace('_sharp', '#').toUpperCase();
const formatTaal = (t: string) => t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const Tabla: React.FC<TablaProps> = ({ config, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);

  // Determine valid BPM range based on selected taal
  const isHighRange = TAAL_GROUPS.high.includes(config.taal);
  const minBpm = 80;
  const maxBpm = isHighRange ? 200 : 150;

  useEffect(() => {
      let newBpm = config.bpm;
      if (newBpm < minBpm) newBpm = minBpm;
      if (newBpm > maxBpm) newBpm = maxBpm;
      const remainder = newBpm % 5;
      if (remainder !== 0) newBpm = newBpm - remainder + (remainder >= 2.5 ? 5 : 0);
      if (newBpm > maxBpm) newBpm = maxBpm;
      if (newBpm < minBpm) newBpm = minBpm;

      if (newBpm !== config.bpm) {
          onChange({ ...config, bpm: newBpm });
      }
  }, [config.taal]);

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl bg-[#1a1a1a] border border-black group">
        {/* Leather/Wood Texture Background */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-700 to-black" />

        <div className="relative flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-black/40">
            <div className="flex items-center gap-2">
                <div>
                    <h3 className="text-amber-500 font-bold tracking-widest uppercase text-xs">Tabla</h3>
                    <p className="text-[9px] text-amber-700 font-mono tracking-tighter">PERCUSSION LOOP</p>
                </div>
                {isLoading && <Loader2 size={12} className="animate-spin text-amber-500" />}
            </div>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`w-8 h-8 rounded-full border border-amber-900/50 flex items-center justify-center transition-all shadow-inner ${config.enabled ? 'bg-amber-900 text-amber-100 shadow-[0_0_15px_rgba(180,83,9,0.4)]' : 'bg-[#111] text-zinc-700'}`}
            >
                <Power size={14} />
            </button>
        </div>

        <div className="relative p-6 space-y-6">
            <div className="bg-black/30 rounded-lg p-1 border border-amber-900/10 grid grid-cols-2 gap-1">
                {ALL_TAALS.map(t => (
                    <button 
                        key={t}
                        onClick={() => onChange({ ...config, taal: t })}
                        className={`py-2 px-2 text-[10px] rounded font-bold transition-all truncate border ${config.taal === t ? 'bg-amber-800 border-amber-600 text-white shadow-md' : 'bg-transparent border-transparent text-amber-800/60 hover:text-amber-500'}`}
                    >
                        {formatTaal(t)}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <label className="text-[9px] text-amber-700 font-bold uppercase mb-1 block">Tuning</label>
                    <div className="grid grid-cols-6 gap-1">
                        {KEYS.map(k => (
                            <button 
                                key={k}
                                onClick={() => onChange({...config, key: k})}
                                className={`h-8 text-[10px] rounded font-bold transition-all border ${config.key === k ? 'bg-amber-100 border-amber-200 text-black shadow' : 'bg-black/20 border-transparent text-amber-800/60 hover:text-amber-500'}`}
                            >
                                {formatKey(k)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-around items-center bg-black/20 rounded-lg border border-amber-900/10 p-4">
                <div className="text-center">
                    <Knob 
                        label="Tempo" 
                        value={(config.bpm - minBpm) / (maxBpm - minBpm)} 
                        min={0} max={1}
                        onChange={(v) => {
                            let rawBpm = minBpm + (v * (maxBpm - minBpm));
                            let snapped = Math.round(rawBpm / 5) * 5;
                            snapped = Math.max(minBpm, Math.min(maxBpm, snapped));
                            onChange({ ...config, bpm: snapped });
                        }}
                        color="#d97706"
                        size={56}
                    />
                    <div className="mt-2 text-[10px] font-mono text-amber-500 font-bold bg-black/40 rounded px-2 py-0.5 inline-block border border-amber-900/20">
                        {config.bpm} BPM
                    </div>
                </div>

                <div className="w-px h-12 bg-amber-900/20" />

                <Knob 
                    label="Level" 
                    value={config.volume} 
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, volume: v })}
                    color="#d97706"
                    size={56}
                />
            </div>
        </div>
    </div>
  );
};

export default Tabla;
