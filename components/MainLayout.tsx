
import React from 'react';
import BottomNavigation, { ViewType } from './BottomNavigation';

export type { ViewType };

interface MainLayoutProps {
    children: React.ReactNode;
    view: ViewType;
    setView: (view: ViewType) => void;
    isRecording: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, view, setView, isRecording }) => {
    return (
        <div className={`flex flex-col h-[100dvh] overflow-hidden transition-all duration-300 bg-studio-bg ${isRecording ? 'ring-4 ring-red-500/50' : ''}`}>
            {children}
            <BottomNavigation view={view} setView={setView} />
        </div>
    );
};

export default MainLayout;
