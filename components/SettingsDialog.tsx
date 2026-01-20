
import React, { useEffect, useState, useRef } from 'react';
import { audio } from '../services/audio';
import { cleanupOrphanedAssets } from '../services/db';
import { ProjectState } from '../types';
import { X, Mic, Music, Settings, Info, Keyboard, Database, Trash2, Clock } from 'lucide-react';
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
  
  // Metering
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
              const level = audio.measureInputLevel(); // 0-1
              const canvas = meterCanvasRef.current;
              if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                      const w = canvas.width;
                      const h = canvas.height;
                      ctx.clearRect(0, 0, w, h);
                      ctx.fillStyle = '#18181b';
                      ctx.fillRect(0, 0, w, h);
                      const fillW = w * Math.min(1, level * 5); 
                      let color = '#22c55e';
                      if (fillW > w * 0.9) color = '#ef4444';
                      else if (fillW > w * 0.7) color = '#eab308';
                      ctx.fillStyle = color;
                      ctx.fillRect(0, 0, fillW, h);
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

  const handleMetronomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setMetronomeVolume(val);
      audio.setMetronomeVolume(val);
  };

  const handleMetronomeSoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          metronomeSound: e.target.value as 'beep' | 'click' | 'hihat'
      }));
  };

  const handleCountInChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          countIn: parseInt(e.target.value)
      }));
  };

  const handleLatencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          recordingLatency: parseInt(e.target.value)
      }));
  };

  const handleApplyLatency = (val: number) => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          recordingLatency: val
      }));
  };

  const handleInputMonitoringChange = () => {
      updateProject((prev: ProjectState) => ({
          ...prev,
          inputMonitoring: !prev.inputMonitoring
      }));
  };

  const handleTimeSignatureChange = (index: 0 | 1, value: number) => {
      updateProject((prev: ProjectState) => {
          const newSig = [...prev.timeSignature] as [number, number];
          newSig[index] = value;
          return { ...prev, timeSignature: newSig };
      });
  };

  const handleCleanup = async () => {
      setIsCleaning(true);
      try {
          const count = await cleanupOrphanedAssets();
          showToast(`Cleaned up ${count} unused files`, 'success');
      } catch (e) {
          console.error(e);
          showToast("Cleanup failed", 'error');
      } finally {
          setIsCleaning(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center sm:p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 sm:rounded-xl w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
                <div className="flex space-x-4">
                    <button onClick={() => setActiveTab('audio')} className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'audio' ? 'text-white border-studio-accent' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>Audio</button>
                    <button onClick={() => setActiveTab('midi')} className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'midi' ? 'text-white border-studio-accent' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>MIDI</button>
                    <button onClick={() => setActiveTab('general')} className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'general' ? 'text-white border-studio-accent' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>General</button>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {activeTab === 'audio' && (
                    <>
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Mic size={14} /> Input & Output</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Input Device</label>
                                    <select value={selectedInput} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none">
                                        <option value="">Default Input</option>
                                        {inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,4)}`}</option>)}
                                    </select>
                                </div>
                                {selectedInput && (
                                    <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                                        <span className="text-xs text-zinc-400">Input Level</span>
                                        <canvas ref={meterCanvasRef} width={100} height={10} className="rounded bg-zinc-900" />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Output Device</label>
                                    <select value={selectedOutput} onChange={handleOutputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none">
                                        <option value="">Default Output</option>
                                        {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,4)}`}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Settings size={14} /> Recording</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Count-In (Bars)</label>
                                    <select value={project?.countIn || 0} onChange={handleCountInChange} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none">
                                        <option value="0">None</option>
                                        <option value="1">1 Bar</option>
                                        <option value="2">2 Bars</option>
                                        <option value="4">4 Bars</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Input Monitoring</label>
                                    <button onClick={handleInputMonitoringChange} className={`w-full py-2 rounded text-xs font-bold border transition-colors ${project?.inputMonitoring ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                                        {project?.inputMonitoring ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Latency Section */}
                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>Recording Latency Compensation</span><span>{project?.recordingLatency || 0} ms</span></div>
                                <input type="range" min="0" max="500" step="1" value={project?.recordingLatency || 0} onChange={handleLatencyChange} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            
                            <LatencyCalibrator 
                                currentLatency={project?.recordingLatency || 0} 
                                onApply={handleApplyLatency} 
                            />
                        </div>
                    </>
                )}

                {activeTab === 'midi' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Keyboard size={14} /> MIDI Controller</h3>
                        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-zinc-200">MIDI Learn Mode</span>
                                {setMidiLearnActive && (
                                    <button 
                                        onClick={() => setMidiLearnActive(!isMidiLearnActive)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isMidiLearnActive ? 'bg-studio-accent text-white animate-pulse' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                                    >
                                        {isMidiLearnActive ? 'Active' : 'Enable'}
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500">
                                Enable Learn Mode, click a fader/knob in the Mixer, then move a control on your MIDI device to map it.
                            </p>
                            
                            <div className="pt-2">
                                <h4 className="text-xs font-bold text-zinc-400 mb-2">Current Mappings</h4>
                                {project?.midiMappings && project.midiMappings.length > 0 ? (
                                    <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                                        {project.midiMappings.map(m => (
                                            <div key={m.id} className="flex justify-between items-center bg-zinc-900 px-2 py-1.5 rounded text-xs">
                                                <span className="text-zinc-300 font-mono">CC{m.cc} (Ch {m.channel})</span>
                                                <span className="text-zinc-500">→</span>
                                                <span className="text-zinc-300">{m.targetId === 'master' ? 'Master' : 'Track'} {m.parameter}</span>
                                                <button 
                                                    onClick={() => updateProject((p: ProjectState) => ({...p, midiMappings: p.midiMappings!.filter(mm => mm.id !== m.id)}))}
                                                    className="text-red-500 hover:text-red-400 font-bold ml-2"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-zinc-600 italic">No mappings saved.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-6">
                        {/* Time Signature */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Clock size={14} /> Project Settings</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Time Signature</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" max="16" 
                                            value={project?.timeSignature[0] || 4} 
                                            onChange={(e) => handleTimeSignatureChange(0, parseInt(e.target.value))}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none text-center"
                                        />
                                        <span className="text-zinc-500">/</span>
                                        <select 
                                            value={project?.timeSignature[1] || 4} 
                                            onChange={(e) => handleTimeSignatureChange(1, parseInt(e.target.value))}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none text-center appearance-none"
                                        >
                                            <option value="2">2</option>
                                            <option value="4">4</option>
                                            <option value="8">8</option>
                                            <option value="16">16</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Music size={14} /> Metronome</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Sound</label>
                                    <select value={project?.metronomeSound || 'beep'} onChange={handleMetronomeSoundChange} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none">
                                        <option value="beep">Digital Beep</option>
                                        <option value="click">Wood Click</option>
                                        <option value="hihat">Hi-Hat</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-zinc-400 mb-1"><span>Volume</span><span>{Math.round(metronomeVolume * 100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.01" value={metronomeVolume} onChange={handleMetronomeChange} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Database size={14} /> Storage</h3>
                            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                                <p className="text-xs text-zinc-400 mb-3">
                                    Free up space by deleting audio recordings that are not used in any project.
                                </p>
                                <button 
                                    onClick={handleCleanup}
                                    disabled={isCleaning}
                                    className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    {isCleaning ? 'Cleaning...' : 'Cleanup Unused Audio'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Info size={14} /> About</h3>
                            <div className="bg-zinc-800/50 p-3 rounded-lg text-xs text-zinc-400 space-y-2">
                                <p>PocketStudio v1.3.0</p>
                                <p>A mobile-first DAW built with React & Web Audio API.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SettingsDialog;
