
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: { buffers: new Map(), getCurrentTime: () => 0 }
}));

// Mock Waveform
vi.mock('../../components/Waveform', () => ({
  default: () => <div />
}));

const mockProject: ProjectState = {
  id: 'test', name: 'Test', bpm: 120, timeSignature: [4, 4], returnToStartOnStop: true, 
  tracks: [{id:'t1', type: 'audio', name:'T1', volume:1, pan:0, muted:false, solo:false, color:'#000', eq:{low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}}],
  clips: [{id:'c1', trackId:'t1', name:'Clip', start:0, duration:4, offset:0, bufferKey:'k1', fadeIn:0, fadeOut:0}],
  markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn:0, recordingLatency:0, inputMonitoring:false,
  masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4, attack: 0.01, release: 0.1}, effects:{reverb:0,delay:0,chorus:0},
  tanpura:{enabled:false,volume:0,key:'C',tuning:'Pa',tempo:60}, tabla:{enabled:false,volume:0,taal:'TeenTaal',bpm:100,key:'C'}
};

describe('Arranger Auto-Scroll', () => {
    
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock getBoundingClientRect for timeline container
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => {}
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts scrolling when dragging near right edge', () => {
        const { getByText, getByRole } = render(
            <Arranger project={mockProject} setProject={() => {}} currentTime={0} isPlaying={false} isRecording={false} onPlayPause={()=>{}} onStop={()=>{}} onRecord={()=>{}} onSeek={()=>{}} onSplit={()=>{}} zoom={50} setZoom={()=>{}} selectedTrackId={null} onSelectTrack={()=>{}} selectedClipIds={[]} onSelectClip={()=>{}} onOpenInspector={()=>{}} commitTransaction={()=>{}} />
        );

        const clip = getByText('Clip').closest('div[style*="absolute"]');
        const container = getByRole('application').querySelector('.flex-1.overflow-auto');
        
        // Mock scroll property since jsdom doesn't handle layout/scroll natively
        let scrollLeft = 0;
        Object.defineProperty(container, 'scrollLeft', {
            get: () => scrollLeft,
            set: (val) => { scrollLeft = val; }
        });

        // Start Drag
        fireEvent.pointerDown(clip!, { clientX: 100, clientY: 100, pointerId: 1 });

        // Move to right edge (width is 1000, move to 980)
        fireEvent.pointerMove(container!, { clientX: 980, clientY: 100, pointerId: 1 });

        // Advance timers to trigger interval
        vi.advanceTimersByTime(100); // 16ms interval, should fire ~6 times

        expect(scrollLeft).toBeGreaterThan(0);
    });

    it('stops scrolling on pointer up', () => {
        const { getByText, getByRole } = render(
            <Arranger project={mockProject} setProject={() => {}} currentTime={0} isPlaying={false} isRecording={false} onPlayPause={()=>{}} onStop={()=>{}} onRecord={()=>{}} onSeek={()=>{}} onSplit={()=>{}} zoom={50} setZoom={()=>{}} selectedTrackId={null} onSelectTrack={()=>{}} selectedClipIds={[]} onSelectClip={()=>{}} onOpenInspector={()=>{}} commitTransaction={()=>{}} />
        );

        const clip = getByText('Clip').closest('div[style*="absolute"]');
        const container = getByRole('application').querySelector('.flex-1.overflow-auto');
        
        let scrollLeft = 0;
        Object.defineProperty(container, 'scrollLeft', {
            get: () => scrollLeft,
            set: (val) => { scrollLeft = val; }
        });

        // Start Drag
        fireEvent.pointerDown(clip!, { clientX: 100, clientY: 100, pointerId: 1 });
        // Move near edge
        fireEvent.pointerMove(container!, { clientX: 980, clientY: 100, pointerId: 1 });
        
        vi.advanceTimersByTime(50);
        const currentScroll = scrollLeft;
        
        // Release
        fireEvent.pointerUp(container!, { clientX: 980, clientY: 100, pointerId: 1 });
        
        vi.advanceTimersByTime(100);
        // Should not have increased further
        expect(scrollLeft).toBe(currentScroll);
    });
});