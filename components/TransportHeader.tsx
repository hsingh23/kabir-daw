
import React from 'react';
import { Undo2, Redo2, Square, Pause, Play, Circle, VolumeX, Piano, Settings, Download } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import TimeDisplay from './TimeDisplay';
import TempoControl from './TempoControl';
import HeaderInputMeter from './HeaderInputMeter';
import { ProjectState } from '../types';

interface TransportHeaderProps {
    project: ProjectState;
    isPlaying: boolean;
    isRecording: boolean;
    hasSolo: boolean;
    saveStatus: 'saved' | 'saving' | 'unsaved';
    isMidiLearnActive: boolean;
    showKeyboard: boolean;
    isInstrumentTrackSelected: boolean;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    stop: () => void;
    togglePlay: () => void;
    toggleRecord: () => void;
    clearSolo: () => void;
    updateBpm: (bpm: number) => void;
    setShowKeyboard: (show: boolean) => void;
    setShowSettings: (show: boolean) => void;
    setShowExport: (show: boolean) => void;
    currentTime: number;
}

const TransportHeader: React.FC<TransportHeaderProps> = ({
    project, isPlaying, isRecording, hasSolo, saveStatus, isMidiLearnActive, showKeyboard, isInstrumentTrackSelected,
    undo, redo, canUndo, canRedo, stop, togglePlay, toggleRecord, clearSolo, updateBpm,
    setShowKeyboard, setShowSettings, setShowExport, currentTime
}) => {
    return (
        <div className="flex items-center justify-between h-14 bg-studio-panel border-b border-zinc-800 px-4 shrink-0 z-50">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">
                    <span className="text-studio-accent">Pocket</span>Studio
                </h1>
                <div className="flex gap-1">
                    <button onClick={undo} disabled={!canUndo} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Undo (Ctrl+Z)">
                        <Undo2 size={16} />
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 size={16} />
                    </button>
                </div>
                <StatusIndicator status={saveStatus} />
            </div>

            <div className="flex items-center gap-2 sm:gap-6">
                <div className="hidden sm:flex items-center gap-2 bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800">
                    <TimeDisplay currentTime={currentTime} bpm={project.bpm} isPlaying={isPlaying} />
                    <div className="w-px h-6 bg-zinc-800 mx-1" />
                    <TempoControl bpm={project.bpm} onChange={updateBpm} />
                </div>
                
                <div className="flex items-center gap-4">
                    <button onClick={stop} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400" title="Stop">
                        <Square size={14} fill="currentColor" />
                    </button>
                    <button onClick={togglePlay} className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 ${isPlaying ? 'bg-zinc-200 text-black' : 'bg-studio-accent text-white shadow-lg shadow-red-500/20'}`} title="Play/Pause (Space)">
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <button onClick={toggleRecord} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-red-500 hover:bg-zinc-700'}`} title="Record (R)">
                        <Circle size={14} fill="currentColor" />
                    </button>
                    {hasSolo && (
                        <button onClick={clearSolo} className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 flex items-center justify-center animate-pulse" title="Clear Solo">
                            <VolumeX size={14} />
                        </button>
                    )}
                    {(isRecording || project.inputMonitoring) && <HeaderInputMeter isRecordingOrMonitoring={isRecording || project.inputMonitoring} />}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isMidiLearnActive && (
                    <span className="text-[10px] font-bold bg-studio-accent px-2 py-1 rounded text-white animate-pulse mr-2">MIDI LEARN</span>
                )}
                {isInstrumentTrackSelected && (
                    <button 
                        onClick={() => setShowKeyboard(!showKeyboard)}
                        className={`p-2 rounded transition-colors ${showKeyboard ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        title="Virtual Keyboard"
                    >
                        <Piano size={20} />
                    </button>
                )}
                <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white" title="Settings">
                    <Settings size={20} />
                </button>
                <button onClick={() => setShowExport(true)} className="p-2 text-studio-accent hover:text-red-400" title="Export Mix">
                    <Download size={20} />
                </button>
            </div>
        </div>
    );
};

export default TransportHeader;
