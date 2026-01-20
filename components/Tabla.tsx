
import React, { useEffect, useRef, useState } from 'react';
import Knob from './Knob';
import { audio } from '../services/audio';

// Local definition
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

const TAALS = ['TeenTaal', 'Keherwa', 'Dadra'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const Tabla: React.FC<TablaProps> = ({ config, onChange }) => {
  const [currentBeat, setCurrentBeat] = useState<number>(-1);
  const rafRef = useRef<number>(0);
  
  // Placeholder pattern as audio support removed
  const pattern = ['Dha', 'Dhin', 'Dhin', 'Dha']; 

  useEffect(() => {
      const loop = () => {
          if (config.enabled && audio.isPlaying) {
              // audio.currentTablaBeat removed, simulating placeholder or 0
              setCurrentBeat(0); 
          } else {
              setCurrentBeat(-1);
          }
          rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      return () => cancelAnimationFrame(rafRef.current);
  }, [config.enabled, config.taal]);

  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4 opacity-50 pointer-events-none grayscale">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm">Tabla (Legacy)</h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-colors ${config.enabled ? 'bg-studio-accent text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
            >
                <div className="w-3 h-3 rounded-full bg-current shadow-sm" />
            </button>
        </div>

        {/* Pattern Visualizer */}
        <div className="bg-black/30 rounded-lg p-3 min-h-[60px] flex flex-wrap gap-1 justify-center items-center">
             {pattern.map((bol, idx) => {
                 const isActive = idx === currentBeat && config.enabled && audio.isPlaying;
                 const isSum = idx === 0; // The 'Sum' (first beat)
                 return (
                     <div 
                        key={idx}
                        className={`
                            px-2 py-1 rounded text-xs font-mono font-bold uppercase transition-all duration-75
                            ${isActive 
                                ? 'bg-yellow-500 text-black transform scale-110 shadow-lg' 
                                : isSum ? 'bg-zinc-700 text-zinc-300 border border-zinc-600' : 'bg-zinc-800 text-zinc-500 border border-transparent'}
                        `}
                     >
                         {bol}
                     </div>
                 )
             })}
        </div>

        <div className="flex flex-col space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Taal Pattern</label>
            <div className="flex space-x-1">
                {TAALS.map(t => (
                    <button 
                        key={t}
                        onClick={() => onChange({ ...config, taal: t })}
                        className={`flex-1 py-1.5 text-[10px] rounded font-bold transition-colors ${config.taal === t ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col space-y-2">
             <label className="text-[10px] text-zinc-500 font-bold uppercase">Tuning (Dayan)</label>
             <div className="flex flex-wrap gap-1">
                 {KEYS.map(k => (
                    <button 
                        key={k}
                        onClick={() => onChange({...config, key: k})}
                        className={`w-6 h-6 text-[10px] rounded font-bold transition-colors ${config.key === k ? 'bg-zinc-200 text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        {k}
                    </button>
                 ))}
             </div>
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
