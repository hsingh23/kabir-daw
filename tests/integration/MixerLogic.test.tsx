

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Mixer from '../../components/Mixer';
import { ProjectState, Track } from '../../types';

// Mock dependencies
vi.mock('../../services/audio', () => ({
  audio: {
    measureTrackLevel: () => 0,
    measureMasterLevel: () => 0,
  }
}));

const mockProject: ProjectState = {
  id: 'test',
  name: 'Test Project',
  bpm: 120,
  timeSignature: [4, 4],
  returnToStartOnStop: true,
  tracks: [
    { id: 't1', type: 'audio', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: true, color: '#000', eq:{low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } },
    { id: 't2', type: 'audio', name: 'Track 2', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq:{low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
  ],
  clips: [], markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn:0, recordingLatency:0, inputMonitoring:false,
  masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4}, effects:{reverb:0,delay:0,chorus:0},
  tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
};

describe('Mixer Logic Integration', () => {
    it('applies implicit mute visual when another track is soloed', () => {
        const { getByText } = render(
            <Mixer 
                project={mockProject} 
                setProject={() => {}} 
                isPlaying={false} 
                onPlayPause={() => {}} 
                onStop={() => {}} 
                onRecord={() => {}} 
                onOpenMaster={() => {}} 
            />
        );

        // Track 1 is Soloed.
        // Track 2 should be implicitly muted (opacity reduced).
        
        // Find strip for Track 2
        const track2Label = getByText('Track 2');
        // Find container: Grandparent of the label usually in MixerStrip structure
        const track2Container = track2Label.closest('.flex.flex-col.w-20');
        
        expect(track2Container).toHaveClass('opacity-40');
        expect(track2Container).toHaveClass('bg-black');
    });

    it('does not mute soloed track', () => {
        const { getByText } = render(
            <Mixer 
                project={mockProject} 
                setProject={() => {}} 
                isPlaying={false} 
                onPlayPause={() => {}} 
                onStop={() => {}} 
                onRecord={() => {}} 
                onOpenMaster={() => {}} 
            />
        );

        const track1Label = getByText('Track 1');
        const track1Container = track1Label.closest('.flex.flex-col.w-20');
        
        expect(track1Container).not.toHaveClass('opacity-40');
    });
});