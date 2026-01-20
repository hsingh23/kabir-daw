
import React from 'react';
import { Globe, Users, Heart, MessageCircle } from 'lucide-react';

const CommunityView: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-studio-bg text-zinc-400 p-8 text-center">
            <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-zinc-700">
                <Users size={48} className="text-studio-accent" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Community Hub</h2>
            <p className="max-w-md text-sm mb-8">
                Share your projects, discover new sounds, and collaborate with other creators. Coming soon to PocketStudio.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex flex-col items-center">
                    <Globe size={24} className="mb-3 text-blue-400" />
                    <h3 className="font-bold text-white text-sm">Discover</h3>
                    <p className="text-xs mt-1">Browse trending tracks</p>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex flex-col items-center">
                    <Heart size={24} className="mb-3 text-red-400" />
                    <h3 className="font-bold text-white text-sm">Favorites</h3>
                    <p className="text-xs mt-1">Save sounds & stems</p>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex flex-col items-center">
                    <MessageCircle size={24} className="mb-3 text-green-400" />
                    <h3 className="font-bold text-white text-sm">Collab</h3>
                    <p className="text-xs mt-1">Connect with artists</p>
                </div>
            </div>
        </div>
    );
};

export default CommunityView;
