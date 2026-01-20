
import React, { useEffect, useRef, useState } from 'react';
import { TanpuraState } from '../types';
import Knob from './Knob';
import { audio } from '../services/audio';

interface TanpuraProps {
  config: TanpuraState;
  onChange: (config: TanpuraState) => void;
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const Tanpura: React.FC<TanpuraProps> = ({ config, onChange }) => {
  const [activeString, setActiveString] = useState<number>(-1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = () => {
        if (config.enabled && audio.isPlaying) {
            setActiveString(audio.currentTanpuraString);
        } else {
            setActiveString(-1);
        }
        rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [config.enabled]);

  return (
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Tanpura Drone
            </h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-all duration-300 ${config.enabled ? 'bg-studio-accent text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
            >
                <div className="w-3 h-3 rounded-full bg-current shadow-sm" />
            </button>
        </div>

        {/* Visualizer */}
        <div className="bg-gradient-to-b from-black/60 to-black/30 rounded-lg p-4 h-32 flex justify-around items-stretch relative overflow-hidden border border-zinc-800/50 shadow-inner">
            {/* 4 Strings */}
            {[0, 1, 2, 3].map(i => {
                const isActive = activeString === i && config.enabled && audio.isPlaying;
                return (
                    <div key={i} className="flex flex-col items-center justify-center w-8 relative group">
                        {/* String Line */}
                        <div className={`absolute top-0 bottom-0 w-1 rounded-full transition-all duration-100 ${isActive ? 'bg-amber-200 shadow-[0_0_15px_#fcd34d] w-1.5' : 'bg-zinc-700'}`}>
                             {/* Vibration blur effect */}
                             {isActive && <div className="absolute inset-0 bg-amber-200 blur-md animate-pulse opacity-50" />}
                        </div>
                        {/* String Label */}
                        <span className={`absolute bottom-2 text-[10px] font-bold font-mono ${isActive ? 'text-amber-200' : 'text-zinc-600'}`}>
                            {i === 0 ? config.tuning : i === 3 ? 'Sa_L' : 'Sa'}
                        </span>
                    </div>
                )
            })}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Key</label>
                <div className="flex flex-wrap gap-1">
                    {KEYS.map(k => (
                        <button 
                            key={k}
                            onClick={() => onChange({ ...config, key: k })}
                            className={`w-6 h-6 text-[10px] rounded font-bold transition-all ${config.key === k ? 'bg-zinc-200 text-black shadow-lg scale-110' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                            {k}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">String 1</label>
                <div className="flex space-x-1">
                    {['Pa', 'Ma', 'Ni'].map(t => (
                        <button 
                            key={t}
                            onClick={() => onChange({ ...config, tuning: t as any })}
                            className={`flex-1 py-1 text-[10px] rounded font-bold transition-all ${config.tuning === t ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex justify-around pt-2 bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/30">
            <Knob 
                label="Tempo" 
                value={(config.tempo - 30) / 90} // Range 30-120
                min={0} max={1}
                onChange={(v) => onChange({ ...config, tempo: 30 + (v * 90) })}
            />
            <Knob 
                label="Fine Tune" 
                value={((config.fineTune || 0) + 50) / 100} // Range -50 to 50 cents
                min={0} max={1}
                onChange={(v) => onChange({ ...config, fineTune: (v * 100) - 50 })}
            />
            <Knob 
                label="Volume" 
                value={config.volume} 
                min={0} max={1}
                onChange={(v) => onChange({ ...config, volume: v })}
            />
        </div>
        <div className="flex justify-between px-4 text-[10px] text-zinc-500 font-mono">
            <span>{Math.round(config.tempo)} BPM</span>
            <span>{Math.round(config.fineTune || 0)} ct</span>
        </div>
    </div>
  );
};

export default Tanpura;
