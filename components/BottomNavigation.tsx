
import React from 'react';
import { Folder, LayoutGrid, Activity, FolderOpen, Users } from 'lucide-react';

export type ViewType = 'projects' | 'arranger' | 'mixer' | 'library' | 'community';

interface BottomNavigationProps {
    view: ViewType;
    setView: (view: ViewType) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ view, setView }) => {
    const navItems: { id: ViewType, icon: React.ElementType, label: string }[] = [
        { id: 'projects', icon: Folder, label: 'Projects' },
        { id: 'arranger', icon: LayoutGrid, label: 'Arranger' },
        { id: 'mixer', icon: Activity, label: 'Mixer' },
        { id: 'library', icon: FolderOpen, label: 'Library' },
        { id: 'community', icon: Users, label: 'Community' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-zinc-800 flex items-center justify-around px-2 z-[90] pb-safe">
            {navItems.map(item => {
                const Icon = item.icon;
                return (
                    <button 
                        key={item.id}
                        onClick={() => setView(item.id)} 
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${view === item.id ? 'text-studio-accent' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Icon size={20} />
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNavigation;
