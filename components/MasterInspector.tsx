
import React from 'react';
import { ProjectState } from '../types';
import Knob from './Knob';
import VisualEQ from './VisualEQ';
import VisualCompressor from './VisualCompressor';
import { X, Activity, Sliders, Volume2, Settings2 } from 'lucide-react';

interface MasterInspectorProps {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
  onClose: () => void;
}

const MasterInspector: React.FC<MasterInspectorProps> = ({ project, setProject, onClose }) => {
  
  const updateEQ = (band: 'low' | 'mid' | 'high', value: number) => {
      setProject(prev => ({
          ...prev,
          masterEq: { ...prev.masterEq, [band]: value }
      }));
  };

  const updateCompressor = (updates: Partial<typeof project.masterCompressor>) => {
      setProject(prev => ({
          ...prev,
          masterCompressor: { ...prev.masterCompressor, ...updates }
      }));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 bg-studio-panel z-[100] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded flex items-center justify-center bg-red-900/50 shadow-inner text-red-400">
                <Activity size={20} />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-white">Master Bus</h2>
                 <p className="text-xs text-zinc-400 uppercase tracking-widest">Global Processing</p>
             </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
          
          {/* Main Visuals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* EQ Section */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                      Master EQ
                  </h3>
                  
                  <div className="mb-4">
                      <VisualEQ 
                        low={project.masterEq.low}
                        mid={project.masterEq.mid}
                        high={project.masterEq.high}
                        onChangeLow={(v) => updateEQ('low', v)}
                        onChangeMid={(v) => updateEQ('mid', v)}
                        onChangeHigh={(v) => updateEQ('high', v)}
                      />
                  </div>

                  <div className="flex justify-around items-center">
                      <Knob 
                        label="Low" 
                        value={(project.masterEq.low + 12) / 24} 
                        min={0} max={1}
                        onChange={(v) => updateEQ('low', (v * 24) - 12)} 
                      />
                      <Knob 
                        label="Mid" 
                        value={(project.masterEq.mid + 12) / 24} 
                        min={0} max={1}
                        onChange={(v) => updateEQ('mid', (v * 24) - 12)} 
                      />
                      <Knob 
                        label="High" 
                        value={(project.masterEq.high + 12) / 24} 
                        min={0} max={1}
                        onChange={(v) => updateEQ('high', (v * 24) - 12)} 
                      />
                  </div>
              </div>

              {/* Compressor Section */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                      Master Compressor
                  </h3>
                  
                  <div className="mb-4">
                      <VisualCompressor 
                          threshold={project.masterCompressor.threshold}
                          ratio={project.masterCompressor.ratio}
                          knee={project.masterCompressor.knee || 10}
                      />
                  </div>

                  <div className="flex justify-around items-center">
                      <Knob 
                        label="Thresh" 
                        value={(project.masterCompressor.threshold + 60) / 60} 
                        min={0} max={1}
                        onChange={(v) => updateCompressor({ threshold: (v * 60) - 60 })} 
                      />
                      <Knob 
                        label="Ratio" 
                        value={(project.masterCompressor.ratio - 1) / 19} 
                        min={0} max={1}
                        onChange={(v) => updateCompressor({ ratio: 1 + (v * 19) })} 
                      />
                      <Knob 
                        label="Makeup" 
                        value={0.5} // Placeholder for gain logic if implemented later
                        min={0} max={1}
                        onChange={() => {}} 
                      />
                  </div>
              </div>
          </div>

          {/* Advanced Controls Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Returns */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <Settings2 size={12} className="mr-2" /> FX Returns
                  </h3>
                  <div className="flex justify-around items-center">
                       <Knob 
                        label="Reverb" 
                        value={project.effects.reverb} 
                        onChange={(v) => setProject(p => ({...p, effects: {...p.effects, reverb: v}}))} 
                       />
                       <Knob 
                        label="Delay" 
                        value={project.effects.delay} 
                        onChange={(v) => setProject(p => ({...p, effects: {...p.effects, delay: v}}))} 
                       />
                       <Knob 
                        label="Chorus" 
                        value={project.effects.chorus} 
                        onChange={(v) => setProject(p => ({...p, effects: {...p.effects, chorus: v}}))} 
                       />
                  </div>
              </div>

              {/* Master Volume */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50 flex flex-col items-center justify-center">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center">
                      <Volume2 size={12} className="mr-2" /> Output
                  </h3>
                  <div className="flex items-center space-x-6">
                      <Knob 
                          label="Master Vol" 
                          value={project.masterVolume} 
                          min={0} max={1}
                          onChange={(v) => setProject(p => ({...p, masterVolume: v}))} 
                      />
                      <div className="text-xl font-mono text-white font-bold">{Math.round(project.masterVolume * 100)}%</div>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};

export default MasterInspector;
