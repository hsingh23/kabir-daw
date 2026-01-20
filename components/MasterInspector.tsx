
import React from 'react';
import { ProjectState } from '../types';
import Knob from './Knob';
import VisualEQ from './VisualEQ';
import VisualCompressor from './VisualCompressor';
import { X, Volume2, Activity } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

interface MasterInspectorProps {
  onClose: () => void;
}

const MasterInspector: React.FC<MasterInspectorProps> = ({ onClose }) => {
  const { project, updateProject } = useProject();
  
  const updateEq = (band: 'low' | 'mid' | 'high', val: number) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          masterEq: {
              ...prev.masterEq,
              [band]: val
          }
      }));
  };

  const updateComp = (param: keyof ProjectState['masterCompressor'], val: number) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          masterCompressor: {
              ...prev.masterCompressor,
              [param]: val
          }
      }));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 bg-studio-panel z-[150] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded flex items-center justify-center bg-red-500 shadow-inner text-black">
                <Activity size={20} />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-white">Master Output</h2>
                 <p className="text-xs text-zinc-400 uppercase tracking-widest">Main Mix Bus</p>
             </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* EQ */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider">Master EQ</h3>
                  <div className="mb-4">
                      <VisualEQ 
                        low={project.masterEq.low}
                        mid={project.masterEq.mid}
                        high={project.masterEq.high}
                        onChangeLow={(v) => updateEq('low', v)}
                        onChangeMid={(v) => updateEq('mid', v)}
                        onChangeHigh={(v) => updateEq('high', v)}
                      />
                  </div>
                  <div className="flex justify-around">
                      <Knob label="Low" value={(project.masterEq.low + 12)/24} min={0} max={1} onChange={(v) => updateEq('low', (v*24)-12)} />
                      <Knob label="Mid" value={(project.masterEq.mid + 12)/24} min={0} max={1} onChange={(v) => updateEq('mid', (v*24)-12)} />
                      <Knob label="High" value={(project.masterEq.high + 12)/24} min={0} max={1} onChange={(v) => updateEq('high', (v*24)-12)} />
                  </div>
              </div>

              {/* Compressor */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider">Bus Compressor</h3>
                  <div className="mb-4">
                      <VisualCompressor 
                        threshold={project.masterCompressor.threshold}
                        ratio={project.masterCompressor.ratio}
                        knee={project.masterCompressor.knee || 30}
                      />
                  </div>
                  <div className="flex justify-around">
                      <Knob label="Thresh" value={(project.masterCompressor.threshold + 60)/60} min={0} max={1} onChange={(v) => updateComp('threshold', (v*60)-60)} />
                      <Knob label="Ratio" value={(project.masterCompressor.ratio - 1)/19} min={0} max={1} onChange={(v) => updateComp('ratio', 1 + (v*19))} />
                      <Knob label="Attack" value={(project.masterCompressor.attack || 0.05)} min={0} max={1} onChange={(v) => updateComp('attack', v)} />
                  </div>
              </div>
          </div>

          <div className="flex justify-center">
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
                          // Update Audio Engine directly via audio service public setter
                          onChange={(v) => {
                              import('../services/audio').then(({ audio }) => audio.setMasterVolume(v));
                          }}
                          // Sync to state on release
                          onChangeEnd={(v) => updateProject((p: ProjectState) => ({...p, masterVolume: v}))}
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
