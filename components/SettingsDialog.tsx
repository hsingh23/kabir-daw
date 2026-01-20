
import React, { useEffect, useState, useRef } from 'react';
import { audio } from '../services/audio';
import { ProjectState } from '../types';
import { X, Mic, Speaker, Music, Settings, Info, FileText, Activity, AlertTriangle } from 'lucide-react';

interface SettingsDialogProps {
  onClose: () => void;
  project?: ProjectState;
  setProject?: (value: React.SetStateAction<ProjectState>) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose, project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'general'>('audio');
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [metronomeVolume, setMetronomeVolume] = useState<number>(0.5);
  
  // Metering
  const meterCanvasRef = useRef<HTMLCanvasElement>(null);
  const meterRafRef = useRef<number>(0);

  useEffect(() => {
    loadDevices();
    setSelectedInput(audio.selectedInputDeviceId || '');
    // Need to initialize metronome volume if available from a store, for now default
    
    // Initialize input meter
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
                      
                      // Background
                      ctx.fillStyle = '#18181b';
                      ctx.fillRect(0, 0, w, h);
                      
                      // Level Bar
                      const fillW = w * Math.min(1, level * 5); // Boost visual
                      
                      // Color based on level
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
      if (setProject) {
          setProject((prev: ProjectState) => ({
              ...prev,
              metronomeSound: e.target.value as 'beep' | 'click' | 'hihat'
          }));
      }
  };

  const handleCountInChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (setProject) {
          setProject((prev: ProjectState) => ({
              ...prev,
              countIn: parseInt(e.target.value)
          }));
      }
  };

  const handleLatencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (setProject) {
          setProject((prev: ProjectState) => ({
              ...prev,
              recordingLatency: parseInt(e.target.value)
          }));
      }
  };

  const handleInputMonitoringChange = () => {
      if (setProject) {
          setProject((prev: ProjectState) => ({
              ...prev,
              inputMonitoring: !prev.inputMonitoring
          }));
      }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
                <div className="flex space-x-4">
                    <button 
                        onClick={() => setActiveTab('audio')}
                        className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'audio' ? 'text-white border-studio-accent' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                    >
                        Audio
                    </button>
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'general' ? 'text-white border-studio-accent' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                    >
                        General
                    </button>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
                {activeTab === 'audio' && (
                    <>
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Mic size={14} /> Input & Output
                            </h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Input Device</label>
                                    <select 
                                        value={selectedInput} 
                                        onChange={handleInputChange}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    >
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
                                    <select 
                                        value={selectedOutput} 
                                        onChange={handleOutputChange}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    >
                                        <option value="">Default Output</option>
                                        {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,4)}`}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Settings size={14} /> Recording
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Count-In (Bars)</label>
                                    <select 
                                        value={project?.countIn || 0} 
                                        onChange={handleCountInChange}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    >
                                        <option value="0">None</option>
                                        <option value="1">1 Bar</option>
                                        <option value="2">2 Bars</option>
                                        <option value="4">4 Bars</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Input Monitoring</label>
                                    <button 
                                        onClick={handleInputMonitoringChange}
                                        className={`w-full py-2 rounded text-xs font-bold border transition-colors ${project?.inputMonitoring ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        {project?.inputMonitoring ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                    <span>Recording Latency Compensation</span>
                                    <span>{project?.recordingLatency || 0} ms</span>
                                </div>
                                <input 
                                    type="range" min="0" max="500" step="1"
                                    value={project?.recordingLatency || 0} 
                                    onChange={handleLatencyChange}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">Adjust if recordings are out of sync with backing tracks.</p>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Music size={14} /> Metronome
                            </h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Sound</label>
                                    <select 
                                        value={project?.metronomeSound || 'beep'} 
                                        onChange={handleMetronomeSoundChange}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                    >
                                        <option value="beep">Digital Beep</option>
                                        <option value="click">Wood Click</option>
                                        <option value="hihat">Hi-Hat</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                        <span>Volume</span>
                                        <span>{Math.round(metronomeVolume * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1" step="0.01"
                                        value={metronomeVolume} 
                                        onChange={handleMetronomeChange}
                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                <Info size={14} /> About
                            </h3>
                            <div className="bg-zinc-800/50 p-3 rounded-lg text-xs text-zinc-400 space-y-2">
                                <p>PocketStudio v1.0.0</p>
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
