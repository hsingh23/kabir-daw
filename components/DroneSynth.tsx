
import React from 'react';
import { DroneState, DroneOscillator } from '../types';
import Knob from './Knob';
import { Power, Settings2, Activity } from 'lucide-react';

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
    <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-700/50 flex flex-col space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
            <h3 className="text-zinc-200 font-bold tracking-wide uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Drone Synth
            </h3>
            <button 
                onClick={() => onChange({ ...config, enabled: !config.enabled })}
                className={`p-2 rounded-full transition-all duration-300 ${config.enabled ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
            >
                <Power size={14} />
            </button>
        </div>

        <div className="flex justify-between items-center bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/30">
             <div className="flex items-center gap-4">
                 <Knob 
                    label="Root Note" 
                    value={(config.note - 24) / 48} // Range C0 to C4 approx
                    min={0} max={1}
                    onChange={(v) => onChange({ ...config, note: Math.round(24 + (v * 48)) })}
                 />
                 <div className="text-center">
                     <div className="text-lg font-bold text-blue-400 font-mono">MIDI {config.note}</div>
                     <div className="text-[9px] text-zinc-500 uppercase">Base Pitch</div>
                 </div>
             </div>
             
             <Knob 
                label="Master Vol" 
                value={config.volume} 
                min={0} max={1}
                onChange={(v) => onChange({ ...config, volume: v })}
             />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {config.oscillators.map((osc, i) => (
                <div key={i} className={`bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-2 flex flex-col items-center space-y-2 relative transition-opacity ${osc.active ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                    <button 
                        onClick={() => updateOsc(i, { active: !osc.active })}
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${osc.active ? 'bg-green-500' : 'bg-zinc-600'}`}
                    />
                    <span className="text-[9px] font-bold text-zinc-400">OSC {i+1}</span>
                    
                    <div className="flex bg-zinc-900 rounded p-0.5 w-full">
                        {WAVEFORMS.map(wf => (
                            <button
                                key={wf}
                                onClick={() => updateOsc(i, { type: wf as any })}
                                className={`flex-1 h-3 rounded-sm ${osc.type === wf ? 'bg-blue-600' : 'bg-transparent'}`}
                                title={wf}
                            />
                        ))}
                    </div>

                    <div className="w-full flex justify-between px-1">
                        <Knob 
                            label="Octave" 
                            value={(osc.octave + 2) / 4} // -2 to +2
                            min={0} max={1}
                            onChange={(v) => updateOsc(i, { octave: Math.round((v * 4) - 2) })}
                        />
                        <Knob 
                            label="Detune" 
                            value={(osc.detune + 50) / 100} // -50 to +50
                            min={0} max={1}
                            onChange={(v) => updateOsc(i, { detune: (v * 100) - 50 })}
                        />
                    </div>
                    
                    <div className="w-full">
                        <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={osc.gain} 
                            onChange={(e) => updateOsc(i, { gain: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-zinc-700 rounded appearance-none"
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default DroneSynth;
