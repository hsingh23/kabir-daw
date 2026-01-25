
import React, { useEffect, useState, useRef } from 'react';
import { audio } from '../services/audio';
import { cleanupOrphanedAssets } from '../services/db';
import { ProjectState } from '../types';
import { X, Mic, Music, Settings, Info, Keyboard, Database, Trash2, Clock, Speaker, Monitor } from 'lucide-react';
import { useToast } from './Toast';
import LatencyCalibrator from './LatencyCalibrator';
import { useProject } from '../contexts/ProjectContext';

interface SettingsDialogProps {
  onClose: () => void;
  isMidiLearnActive?: boolean;
  setMidiLearnActive?: (active: boolean) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose, isMidiLearnActive, setMidiLearnActive }) => {
  const { project, updateProject } = useProject();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'audio' | 'general' | 'midi'>('audio');
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [metronomeVolume, setMetronomeVolume] = useState<number>(0.5);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const meterCanvasRef = useRef<HTMLCanvasElement>(null);
  const meterRafRef = useRef<number>(0);

  useEffect(() => {
    loadDevices();
    setSelectedInput(audio.selectedInputDeviceId || '');
    startMetering();

    return () => {
        if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
        audio.closeInput(); 
    };
  }, []);

  const startMetering = async () => {
      try {
          await audio.initInput(audio.selectedInputDeviceId);
          const draw = () => {
              const level = audio.measureInputLevel();
              const canvas = meterCanvasRef.current;
              if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                      const w = canvas.width;
                      const h = canvas.height;
                      ctx.clearRect(0, 0, w, h);
                      // Meter Background
                      ctx.fillStyle = '#111';
                      ctx.fillRect(0, 0, w, h);
                      // Segments
                      const segments = 20;
                      const segWidth = w / segments;
                      const activeSegs = Math.floor(level * 5 * segments); // boost level visual
                      
                      for(let i=0; i<segments; i++) {
                          if (i < activeSegs) {
                              ctx.fillStyle = i > 16 ? '#ef4444' : (i > 12 ? '#eab308' : '#22c55e');
                              ctx.fillRect(i * segWidth + 1, 1, segWidth - 2, h - 2);
                          }
                      }
                  }
              }
              meterRafRef.current = requestAnimationFrame(draw);
          };
          draw();
      } catch (e) {
          console.error("Failed to init metering", e);
      }
  };

  const loadDevices = async () => {
      try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
          console.warn("Permission denied or not available", e);
      }
      const { inputs, outputs } = await audio.getAudioDevices();
      setInputs(inputs);
      setOutputs(outputs);
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedInput(id);
      audio.selectedInputDeviceId = id;
      await audio.initInput(id);
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedOutput(id);
      audio.setOutputDevice(id);
  };

  const handleCleanup = async () => {
      setIsCleaning(true);
      try {
          const count = await cleanupOrphanedAssets();
          showToast(`Cleaned up ${count} unused files`, 'success');
      } catch (e) {
          showToast("Cleanup failed", 'error');
      } finally {
          setIsCleaning(false);
      }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
      <button 
          onClick={() => setActiveTab(id)}
          className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ${activeTab === id ? 'bg-studio-accent text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
      >
          <Icon size={18} />
          {label}
      </button>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-[#1e1e1e] border border-black rounded-lg w-full max-w-2xl h-[600px] shadow-2xl flex overflow-hidden flex-col md:flex-row">
            {/* Sidebar */}
            <div className="w-full md:w-48 bg-[#161616] border-b md:border-b-0 md:border-r border-black flex flex-col pt-4">
                <h2 className="px-4 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Preferences</h2>
                <nav className="flex-1">
                    <NavItem id="audio" icon={Speaker} label="Audio" />
                    <NavItem id="midi" icon={Keyboard} label="MIDI" />
                    <NavItem id="general" icon={Settings} label="General" />
                </nav>
                <div className="p-4 border-t border-black text-center">
                    <p className="text-[10px] text-zinc-600">PocketStudio v1.3</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-[#1e1e1e] relative">
                {/* Window Controls (Simulated) */}
                <div className="absolute top-3 right-3">
                    <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-zinc-700 pb-2 capitalize">{activeTab} Settings</h3>

                    {activeTab === 'audio' && (
                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Mic size={16} /> Devices</h4>
                                <div className="space-y-3 pl-2">
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Input</label>
                                        <select value={selectedInput} onChange={handleInputChange} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500">
                                            <option value="">Default System Input</option>
                                            {inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0,4)}`}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Level</label>
                                        <div className="bg-black rounded border border-zinc-800 p-1 h-4 w-full">
                                            <canvas ref={meterCanvasRef} width={200} height={8} className="w-full h-full block" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Output</label>
                                        <select value={selectedOutput} onChange={handleOutputChange} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500">
                                            <option value="">Default System Output</option>
                                            {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0,4)}`}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Monitor size={16} /> Latency</h4>
                                <div className="pl-2 space-y-4">
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Compensation</label>
                                        <div className="flex items-center gap-3">
                                            <input type="range" min="0" max="500" value={project?.recordingLatency || 0} onChange={(e) => updateProject((p: ProjectState) => ({...p, recordingLatency: parseInt(e.target.value)}))} className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                                            <span className="text-xs font-mono w-12 text-right">{project?.recordingLatency} ms</span>
                                        </div>
                                    </div>
                                    <div className="ml-[116px]">
                                        <LatencyCalibrator currentLatency={project?.recordingLatency || 0} onApply={(val) => updateProject((p: ProjectState) => ({...p, recordingLatency: val}))} />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'midi' && (
                        <div className="space-y-6">
                            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-6 flex flex-col items-center text-center space-y-4">
                                <Keyboard size={48} className="text-zinc-600" />
                                <div>
                                    <h4 className="text-lg font-bold text-white">MIDI Learn</h4>
                                    <p className="text-sm text-zinc-400 max-w-xs mx-auto mt-1">Map your hardware controller knobs and faders to mixer controls.</p>
                                </div>
                                {setMidiLearnActive && (
                                    <button 
                                        onClick={() => setMidiLearnActive(!isMidiLearnActive)}
                                        className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${isMidiLearnActive ? 'bg-studio-accent text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'}`}
                                    >
                                        {isMidiLearnActive ? 'Learning Active...' : 'Start Learning'}
                                    </button>
                                )}
                            </div>
                            
                            {project.midiMappings && project.midiMappings.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Active Mappings</h4>
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-zinc-800 text-zinc-400 font-bold">
                                                <tr>
                                                    <th className="p-2">CC</th>
                                                    <th className="p-2">Target</th>
                                                    <th className="p-2">Param</th>
                                                    <th className="p-2 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800 text-zinc-300">
                                                {project.midiMappings.map(m => (
                                                    <tr key={m.id}>
                                                        <td className="p-2 font-mono">CC{m.cc}</td>
                                                        <td className="p-2">{m.targetId === 'master' ? 'Master' : 'Track'}</td>
                                                        <td className="p-2 capitalize">{m.parameter}</td>
                                                        <td className="p-2">
                                                            <button onClick={() => updateProject((p: ProjectState) => ({...p, midiMappings: p.midiMappings!.filter(mm => mm.id !== m.id)}))} className="text-zinc-500 hover:text-red-500"><X size={14} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Clock size={16} /> Defaults</h4>
                                <div className="space-y-3 pl-2">
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Metronome</label>
                                        <div className="flex gap-4">
                                            <select value={project?.metronomeSound || 'beep'} onChange={(e) => updateProject((p: ProjectState) => ({...p, metronomeSound: e.target.value}))} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none">
                                                <option value="beep">Digital</option>
                                                <option value="click">Woodblock</option>
                                                <option value="hihat">Hi-Hat</option>
                                            </select>
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-xs text-zinc-500">Vol</span>
                                                <input type="range" min="0" max="1" step="0.01" value={metronomeVolume} onChange={(e) => { const v = parseFloat(e.target.value); setMetronomeVolume(v); audio.setMetronomeVolume(v); }} className="h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer flex-1" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                                        <label className="text-xs text-zinc-400 text-right">Count-In</label>
                                        <select value={project?.countIn || 0} onChange={(e) => updateProject((p: ProjectState) => ({...p, countIn: parseInt(e.target.value)}))} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none w-32">
                                            <option value="0">Off</option>
                                            <option value="1">1 Bar</option>
                                            <option value="2">2 Bars</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-zinc-800">
                                <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Database size={16} /> Data</h4>
                                <div className="pl-2">
                                    <div className="bg-zinc-900 rounded border border-zinc-800 p-4 flex items-center justify-between">
                                        <div className="text-xs text-zinc-400">
                                            <p className="font-bold text-zinc-300 mb-1">Unused Assets</p>
                                            <p>Remove recordings not used in any project.</p>
                                        </div>
                                        <button 
                                            onClick={handleCleanup}
                                            disabled={isCleaning}
                                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-zinc-600 text-xs font-bold flex items-center gap-2"
                                        >
                                            <Trash2 size={14} />
                                            {isCleaning ? 'Cleaning...' : 'Cleanup'}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SettingsDialog;
