
import React, { useState } from 'react';
import { X, Download, Layers, Disc } from 'lucide-react';
import { ProjectState } from '../types';

interface ExportDialogProps {
  onClose: () => void;
  onExport: (options: { type: 'master' | 'stems' }) => void;
  isExporting: boolean;
  project: ProjectState;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose, onExport, isExporting, project }) => {
  const [type, setType] = useState<'master' | 'stems'>('master');

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Download size={20} className="text-zinc-400" /> Export Project
                </h2>
                <button onClick={onClose} disabled={isExporting} className="p-1.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Export Type</label>
                    
                    <button 
                        onClick={() => setType('master')}
                        className={`w-full flex items-center p-3 rounded-lg border transition-all ${type === 'master' ? 'bg-studio-accent/10 border-studio-accent text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <div className={`p-2 rounded-full mr-3 ${type === 'master' ? 'bg-studio-accent text-white' : 'bg-zinc-700 text-zinc-500'}`}>
                            <Disc size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">Master Mix</div>
                            <div className="text-xs opacity-70">Single WAV file of the entire project mix.</div>
                        </div>
                    </button>

                    <button 
                        onClick={() => setType('stems')}
                        className={`w-full flex items-center p-3 rounded-lg border transition-all ${type === 'stems' ? 'bg-studio-accent/10 border-studio-accent text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <div className={`p-2 rounded-full mr-3 ${type === 'stems' ? 'bg-studio-accent text-white' : 'bg-zinc-700 text-zinc-500'}`}>
                            <Layers size={20} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm">Track Stems</div>
                            <div className="text-xs opacity-70">Individual WAV files for each track ({project.tracks.length} files).</div>
                        </div>
                    </button>
                </div>

                <div className="bg-zinc-800/50 p-3 rounded text-xs text-zinc-500 flex items-start gap-2">
                    <div className="mt-0.5 min-w-[4px] h-4 rounded-full bg-blue-500" />
                    <p>Files will be exported as 44.1kHz 16-bit WAV. Rendering might take a moment depending on project length.</p>
                </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-800/30 flex justify-end gap-2">
                <button onClick={onClose} disabled={isExporting} className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button 
                    onClick={() => onExport({ type })}
                    disabled={isExporting}
                    className="px-6 py-2 rounded bg-studio-accent hover:bg-red-600 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExporting ? 'Rendering...' : 'Export Audio'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default ExportDialog;
