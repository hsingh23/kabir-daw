
import React from 'react';
import { Check, Loader2, Disc } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'saved' | 'saving' | 'unsaved';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  return (
    <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-zinc-900/50 border border-zinc-800/50 select-none">
      {status === 'saving' && (
        <>
          <Loader2 size={10} className="text-yellow-500 animate-spin" />
          <span className="text-[10px] text-zinc-400 font-medium">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={10} className="text-green-500" />
          <span className="text-[10px] text-zinc-500 font-medium hidden sm:inline">Saved</span>
        </>
      )}
      {status === 'unsaved' && (
        <>
          <Disc size={10} className="text-zinc-500" />
          <span className="text-[10px] text-zinc-500 font-medium italic hidden sm:inline">Unsaved</span>
        </>
      )}
    </div>
  );
};

export default StatusIndicator;
