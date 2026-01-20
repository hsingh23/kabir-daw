
import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadDevices();
    setSelectedInput(audio.selectedInputDeviceId || '');
    // Need to initialize metronome volume if available from a store, for now default
  }, []);

  const loadDevices = async () => {
      // Trigger permission prompt if needed
      try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
          console.warn("Permission denied or not available", e);
      }
      
      const { inputs, outputs } = await audio.getAudioDevices();
      setInputs(inputs);
      setOutputs(outputs);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedInput(id);
      audio.selectedInputDeviceId = id;
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
              countIn: parseInt(e.target.value, 10)
          }));
      }
  };

  const handlePanic = () => {
      audio.panic();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Settings size={20} className="text-zinc-400" /> Settings
                </h2>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white">
                    <X size={20} />
                </button>
            </div>

            <div className="flex border-b border-zinc-800">
                <button 
                    onClick={() => setActiveTab('audio')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'audio' ? 'border-studio-accent text-white bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    Audio
                </button>
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-studio-accent text-white bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    Project
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                {activeTab === 'audio' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                <Mic size={14} /> Input Device
                            </label>
                            <select 
                                value={selectedInput}
                                onChange={handleInputChange}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                            >
                                <option value="">Default Input</option>
                                {inputs.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,4)}`}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                <Speaker size={14} /> Output Device
                            </label>
                            <select 
                                value={selectedOutput}
                                onChange={handleOutputChange}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-studio-accent outline-none"
                                disabled={outputs.length === 0}
                            >
                                <option value="">Default Output</option>
                                {outputs.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,4)}`}</option>
                                ))}
                            </select>
                            {outputs.length === 0 && <p className="text-[10px] text-zinc-600">Output selection not supported by this browser.</p>}
                        </div>

                        {project && setProject && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                    <Activity size={14} /> Recording Latency
                                </label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" min={0} max={500} step={1}
                                        value={project.recordingLatency}
                                        onChange={(e) => setProject(p => ({...p, recordingLatency: parseInt(e.target.value)}))}
                                        className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                                    />
                                    <div className="w-12 text-right font-mono text-sm text-zinc-300">{project.recordingLatency}ms</div>
                                </div>
                                <p className="text-[10px] text-zinc-600">Adjust to correct sync issues when recording.</p>
                            </div>
                        )}

                        {project && setProject && (
                            <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-zinc-300">Input Monitoring</span>
                                    <span className="text-[10px] text-zinc-500">Hear your input while recording</span>
                                </div>
                                <button 
                                    onClick={() => setProject(p => ({...p, inputMonitoring: !p.inputMonitoring}))}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${project.inputMonitoring ? 'bg-studio-accent' : 'bg-zinc-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${project.inputMonitoring ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                <Music size={14} /> Metronome & Recording
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500">Volume</span>
                                    <input 
                                        type="range" min={0} max={1} step={0.05}
                                        value={metronomeVolume}
                                        onChange={handleMetronomeChange}
                                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-studio-accent"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500">Sound</span>
                                    <select 
                                        value={project?.metronomeSound || 'beep'}
                                        onChange={handleMetronomeSoundChange}
                                        disabled={!project}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-studio-accent outline-none"
                                    >
                                        <option value="beep">Beep</option>
                                        <option value="click">Woodblock</option>
                                        <option value="hihat">Hi-Hat</option>
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-[10px] text-zinc-500">Count-In (Bars)</span>
                                    <select 
                                        value={project?.countIn ?? 0}
                                        onChange={handleCountInChange}
                                        disabled={!project}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-studio-accent outline-none"
                                    >
                                        <option value="0">Off (Start Immediately)</option>
                                        <option value="1">1 Bar</option>
                                        <option value="2">2 Bars</option>
                                        <option value="4">4 Bars</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button 
                                onClick={handlePanic}
                                className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg border border-red-900/50 flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                            >
                                <AlertTriangle size={14} /> Reset Audio Engine (Panic)
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-6">
                        {project && setProject && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                                    <FileText size={14} /> Project Notes / Lyrics
                                </label>
                                <textarea 
                                    className="w-full h-48 bg-zinc-950 border border-zinc-700 rounded p-3 text-sm text-zinc-300 focus:border-studio-accent outline-none resize-none"
                                    placeholder="Write lyrics, chord progressions, or session notes here..."
                                    value={project.notes || ''}
                                    onChange={(e) => setProject(p => ({...p, notes: e.target.value}))}
                                />
                            </div>
                        )}

                        <div className="text-center pt-4 border-t border-zinc-800">
                            <div className="w-16 h-16 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-2xl mx-auto shadow-inner border border-zinc-600 flex items-center justify-center mb-3">
                                <Settings size={32} className="text-zinc-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">PocketStudio</h3>
                            <p className="text-xs text-zinc-500 mb-2">v1.0.0 (Beta)</p>
                            <div className="text-xs text-zinc-400 bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                                <p className="mb-2">A mobile-first DAW built with React & Web Audio API.</p>
                                <p>Created for music creators on the go.</p>
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
