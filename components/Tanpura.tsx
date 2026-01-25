
import React, { useEffect, useRef, useState } from 'react';
import Knob from './Knob';
import { audio } from '../services/audio';
import { Power } from 'lucide-react';

interface TanpuraState {
  enabled: boolean;
  volume: number;
  key: string;
  tuning: 'Pa' | 'Ma' | 'Ni';
  tempo: number;
  fineTune?: number;
}

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
            // Simulated visualizer since exact string phase isn't exposed
            const time = Date.now() / (60000 / config.tempo);
            setActiveString(Math.floor(time) % 4);
        } else {
            setActiveString(-1);
        }
        rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [config.enabled, config.tempo]);

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl bg-[#1a1a1a] border border-black group">
        {/* Wood Texture Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900 to-black" />
        
        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-black/40">
            <div>
                <h3 className="text-amber-500 font-bold tracking-widest uppercase text-xs">Tanpura</h3>
                <p className="text-[9px] text-amber-700 font-mono tracking-tighter">DRONE ACCOMPANIMENT</p>
            </div>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`w-8 h-8 rounded-full border border-amber-900/50 flex items-center justify-center transition-all shadow-inner ${config.enabled ? 'bg-amber-900 text-amber-100 shadow-[0_0_15px_rgba(180,83,9,0.4)]' : 'bg-[#111] text-zinc-700'}`}
            >
                <Power size={14} />
            </button>
        </div>

        {/* String Visualizer */}
        <div className="relative h-24 mx-4 mt-4 bg-black/60 rounded-lg border border-amber-900/20 flex justify-around items-stretch p-4 shadow-inner">
            {[0, 1, 2, 3].map(i => {
                const isActive = activeString === i && config.enabled;
                return (
                    <div key={i} className="relative flex flex-col items-center justify-center w-10">
                        {/* String */}
                        <div className={`w-0.5 h-full rounded-full transition-all duration-75 ${isActive ? 'bg-amber-100 blur-[1px] scale-x-150' : 'bg-amber-800/50'}`} />
                        {/* Glow */}
                        {isActive && <div className="absolute inset-0 bg-amber-500/20 blur-xl animate-pulse" />}
                        <span className="absolute bottom-1 text-[9px] font-bold text-amber-700/50">
                            {i === 0 ? config.tuning : 'Sa'}
                        </span>
                    </div>
                )
            })}
        </div>

        {/* Controls */}
        <div className="relative p-6 grid grid-cols-[1fr_2fr] gap-6">
            <div className="space-y-4">
                <div>
                    <label className="text-[9px] text-amber-700 font-bold uppercase mb-1 block">Root Key</label>
                    <div className="grid grid-cols-4 gap-1">
                        {KEYS.map(k => (
                            <button 
                                key={k}
                                onClick={() => onChange({ ...config, key: k })}
                                className={`h-6 text-[9px] rounded font-bold transition-all border ${config.key === k ? 'bg-amber-600 border-amber-500 text-white' : 'bg-black/30 border-amber-900/20 text-amber-800 hover:text-amber-500'}`}
                            >
                                {k}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div>
                    <label className="text-[9px] text-amber-700 font-bold uppercase mb-1 block">First String</label>
                    <div className="flex bg-black/30 rounded border border-amber-900/20 p-0.5">
                        {['Pa', 'Ma', 'Ni'].map(t => (
                            <button 
                                key={t}
                                onClick={() => onChange({ ...config, tuning: t as any })}
                                className={`flex-1 py-1 text-[10px] rounded font-bold transition-all ${config.tuning === t ? 'bg-amber-800/80 text-amber-100 shadow-sm' : 'text-amber-800 hover:text-amber-500'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-around items-center bg-black/20 rounded-lg border border-amber-900/10">
                <Knob 
                    label="Speed" 
                    value={(config.tempo - 30) / 90} 
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, tempo: 30 + (v * 90) })}
                    color="#d97706"
                />
                <Knob 
                    label="Fine" 
                    value={((config.fineTune || 0) + 50) / 100}
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, fineTune: (v * 100) - 50 })}
                    color="#d97706"
                />
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

export default Tanpura;
