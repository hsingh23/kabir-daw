
import React from 'react';
import { DroneState, DroneOscillator } from '../types';
import Knob from './Knob';
import { Power, Activity, Zap } from 'lucide-react';

interface DroneSynthProps {
  config: DroneState;
  onChange: (config: DroneState) => void;
}

const DroneSynth: React.FC<DroneSynthProps> = ({ config, onChange }) => {
  
  const updateOsc = (index: number, updates: Partial<DroneOscillator>) => {
      const newOscs = [...config.oscillators];
      newOscs[index] = { ...newOscs[index], ...updates };
      onChange({ ...config, oscillators: newOscs });
  };

  const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl bg-[#1a1a1a] border border-black group">
        {/* Brushed Metal Texture Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')] mix-blend-overlay" />
        
        {/* Rack Rails */}
        <div className="absolute left-2 top-0 bottom-0 w-2 border-r border-black/50 flex flex-col justify-between py-2 opacity-50">
            {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-black/80 mx-auto" />)}
        </div>
        <div className="absolute right-2 top-0 bottom-0 w-2 border-l border-black/50 flex flex-col justify-between py-2 opacity-50">
            {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-black/80 mx-auto" />)}
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-3 border-b border-black bg-gradient-to-b from-[#333] to-[#222]">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-black/50 rounded border border-white/10 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    <Activity size={16} />
                </div>
                <div>
                    <h3 className="text-zinc-200 font-bold tracking-widest uppercase text-xs text-shadow-sm">Atmosphere</h3>
                    <p className="text-[9px] text-zinc-500 font-mono tracking-tighter">DRONE SYNTHESIZER</p>
                </div>
            </div>
            
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-inner ${config.enabled ? 'bg-cyan-900 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-[#111] border-zinc-700 text-zinc-600'}`}
            >
                <Power size={14} />
            </button>
        </div>

        {/* Main Controls */}
        <div className="relative p-6 px-8 grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-6 bg-[#222]">
             {/* Master Section */}
             <div className="bg-[#181818] rounded-lg border border-white/5 p-4 flex flex-col items-center justify-center space-y-4 shadow-inner">
                 <div className="w-full text-center border-b border-white/5 pb-2 mb-2">
                     <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Master</span>
                 </div>
                 
                 <Knob 
                    label="Root" 
                    value={(config.note - 24) / 48} 
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, note: Math.round(24 + (v * 48)) })}
                    color="#06b6d4"
                    size={56}
                 />
                 <div className="text-xs font-mono text-cyan-500 bg-black/40 px-2 py-1 rounded border border-cyan-900/30">
                     MIDI {config.note}
                 </div>
                 
                 <div className="w-full h-px bg-white/5 my-2" />
                 
                 <Knob 
                    label="Volume" 
                    value={config.volume} 
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, volume: v })}
                    color="#06b6d4"
                    size={48}
                 />
             </div>

             {/* Oscillators */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {config.oscillators.map((osc, i) => (
                    <div key={i} className={`bg-[#181818] border border-white/5 rounded-lg p-2 flex flex-col items-center relative transition-all ${osc.active ? 'shadow-[0_0_15px_rgba(0,0,0,0.5)] border-cyan-900/30' : 'opacity-60 grayscale'}`}>
                        {/* Header */}
                        <div className="flex justify-between items-center w-full mb-3 border-b border-white/5 pb-1">
                            <span className="text-[9px] font-bold text-zinc-500">OSC {i+1}</span>
                            <button 
                                onClick={() => updateOsc(i, { active: !osc.active })}
                                className={`w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] transition-colors ${osc.active ? 'bg-cyan-500 text-cyan-500' : 'bg-red-900 text-red-900'}`}
                            />
                        </div>
                        
                        {/* Wave Selector */}
                        <div className="grid grid-cols-2 gap-1 w-full mb-4">
                            {WAVEFORMS.map(wf => (
                                <button
                                    key={wf}
                                    onClick={() => updateOsc(i, { type: wf as any })}
                                    className={`h-4 rounded-[2px] flex items-center justify-center border transition-colors ${osc.type === wf ? 'bg-cyan-900/50 border-cyan-600' : 'bg-[#111] border-[#222]'}`}
                                    title={wf}
                                >
                                    <div className={`w-3 h-3 bg-current mask-image-${wf} ${osc.type === wf ? 'text-cyan-400' : 'text-zinc-700'}`} style={{ 
                                        maskImage: `url('/icons/${wf}.svg')`, 
                                        WebkitMaskImage: `url('/icons/${wf}.svg')`,
                                        // Fallback visual for demo if icons missing
                                        borderRadius: '50%',
                                        backgroundColor: osc.type === wf ? 'currentColor' : '#333'
                                    }} />
                                </button>
                            ))}
                        </div>

                        {/* Knobs */}
                        <div className="w-full flex justify-between px-1 mb-3">
                            <Knob 
                                label="Oct" 
                                value={(osc.octave + 2) / 4} 
                                min={0} max={1}
                                onChange={(v) => updateOsc(i, { octave: Math.round((v * 4) - 2) })}
                                size={32}
                                color={osc.active ? '#06b6d4' : '#555'}
                            />
                            <Knob 
                                label="Fine" 
                                value={(osc.detune + 50) / 100} 
                                min={0} max={1}
                                onChange={(v) => updateOsc(i, { detune: (v * 100) - 50 })}
                                size={32}
                                color={osc.active ? '#06b6d4' : '#555'}
                            />
                        </div>
                        
                        {/* Fader */}
                        <div className="w-full mt-auto">
                            <div className="h-1 bg-[#111] rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-cyan-600" style={{ width: `${osc.gain * 100}%` }} />
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={osc.gain} 
                                onChange={(e) => updateOsc(i, { gain: parseFloat(e.target.value) })}
                                className="w-full h-4 -mt-2 opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>
                ))}
             </div>
        </div>
    </div>
  );
};

export default DroneSynth;
