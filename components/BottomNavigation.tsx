
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
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-[90] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            {navItems.map(item => {
                const Icon = item.icon;
                const isActive = view === item.id;
                return (
                    <button 
                        key={item.id}
                        onClick={() => setView(item.id)} 
                        className={`
                            relative flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300
                            ${isActive ? 'text-white -translate-y-1' : 'text-zinc-500 hover:text-zinc-300'}
                        `}
                    >
                        {isActive && (
                            <div className="absolute inset-0 bg-white/5 rounded-2xl shadow-[inset_0_0_15px_rgba(255,255,255,0.05)] border border-white/5" />
                        )}
                        
                        <div className={`relative ${isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            {isActive && <div className="absolute inset-0 bg-current blur-lg opacity-20" />}
                        </div>
                        
                        <span className={`text-[9px] font-bold tracking-wide ${isActive ? 'text-white' : 'text-zinc-600'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNavigation;
