import React, { useEffect, useState } from 'react';
import { getAllAssetKeys, deleteAudioBlob, getAudioBlob } from '../services/db';
import { Trash2, Play, AlertCircle, FileAudio } from 'lucide-react';
import { audio } from '../services/audio';

const Library: React.FC = () => {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const k = await getAllAssetKeys();
      setKeys(k);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (confirm('Delete this audio file permanently?')) {
      await deleteAudioBlob(key);
      loadKeys();
    }
  };

  const handlePreview = async (key: string) => {
    if (previewing === key) {
        audio.stop();
        setPreviewing(null);
        return;
    }
    
    try {
        const blob = await getAudioBlob(key);
        if (blob) {
            audio.stop(); // Stop any current playback
            const buffer = await audio.loadAudio(key, blob);
            // Play directly using a temporary source
            const source = audio.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(audio.ctx.destination);
            source.start();
            setPreviewing(key);
            source.onended = () => setPreviewing(null);
        }
    } catch (e) {
        console.error("Preview failed", e);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading library...</div>;

  return (
    <div className="flex flex-col h-full bg-studio-bg text-white p-6 overflow-hidden">
        <h2 className="text-2xl font-light tracking-widest uppercase mb-6 text-zinc-400">Asset Library</h2>
        
        {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-zinc-600 space-y-4">
                <AlertCircle size={48} />
                <p>No audio assets found in storage.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20">
                {keys.map(key => (
                    <div key={key} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex items-center justify-between group hover:bg-zinc-800 transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="w-10 h-10 rounded bg-zinc-900 flex items-center justify-center shrink-0">
                                <FileAudio size={20} className="text-zinc-500" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-mono text-zinc-400 truncate w-32 md:w-48" title={key}>{key}</span>
                                <span className="text-[10px] text-zinc-600">Local Audio</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => handlePreview(key)}
                                className={`p-2 rounded-full hover:bg-zinc-700 transition-colors ${previewing === key ? 'text-studio-accent' : 'text-zinc-400'}`}
                            >
                                <Play size={16} fill={previewing === key ? "currentColor" : "none"} />
                            </button>
                            <button 
                                onClick={() => handleDelete(key)}
                                className="p-2 rounded-full hover:bg-red-900/30 text-zinc-600 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default Library;