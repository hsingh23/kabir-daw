
import React from 'react';

interface GlobalProgressBarProps {
    isLoading: boolean;
    isExporting: boolean;
}

const GlobalProgressBar: React.FC<GlobalProgressBarProps> = ({ isLoading, isExporting }) => {
    if (!isLoading && !isExporting) return null;

    const color = isExporting ? 'bg-studio-accent' : 'bg-blue-500';

    return (
        <div className="fixed top-0 left-0 right-0 z-[300] h-1 bg-zinc-900 overflow-hidden">
            <div className={`h-full ${color} animate-progress-indeterminate`} />
        </div>
    );
};

export default GlobalProgressBar;
