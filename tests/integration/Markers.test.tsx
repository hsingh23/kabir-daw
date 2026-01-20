

import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    buffers: new Map(),
    getCurrentTime: () => 0,
  }
}));

// Mock Waveform
vi.mock('../../components/Waveform', () => ({
  default: () => <div />
}));

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

describe('Arranger Markers', () => {
    const mockProject: ProjectState = {
      id: 'test',
      name: 'Test Project',
      bpm: 120,
      tracks: [],
      clips: [],
      markers: [], // Initially empty
      loopStart: 0,
      loopEnd: 4,
      isLooping: false,
      metronomeOn: false,
      countIn: 0,
      masterVolume: 1,
      masterEq: { low: 0, mid: 0, high: 0 },
      masterCompressor: { threshold: -20, ratio: 4 },
      effects: { reverb: 0, delay: 0, chorus: 0 },
      tanpura: { enabled: false, volume: 0, key: 'C', tuning: 'Pa', tempo: 60 },
      tabla: { enabled: false, volume: 0, taal: 'TeenTaal', bpm: 100, key: 'C' }
    };

    it('adds marker on double click in ruler', () => {
        const setProject = vi.fn();
        const { container } = render(
            <Arranger 
                project={mockProject} 
                setProject={setProject}
                currentTime={0}
                isPlaying={false}
                isRecording={false}
                onPlayPause={() => {}}
                onStop={() => {}}
                onRecord={() => {}}
                onSeek={() => {}}
                onSplit={() => {}}
                zoom={50}
                setZoom={() => {}}
                selectedTrackId={null}
                onSelectTrack={() => {}}
                selectedClipIds={[]}
                onSelectClip={() => {}}
                onOpenInspector={() => {}}
            />
        );

        // Ruler is the sticky top div
        // We can find it by class or role if added, but here we look for a div with 'sticky' class logic effectively
        const ruler = container.querySelector('.sticky');
        expect(ruler).toBeInTheDocument();

        fireEvent.doubleClick(ruler!, { clientX: 100, clientY: 10 });

        expect(setProject).toHaveBeenCalledWith(expect.any(Function));
        
        // Simulate state update call
        const updater = setProject.mock.calls[0][0];
        const newState = updater(mockProject);
        expect(newState.markers.length).toBe(1);
        expect(newState.markers[0].text).toContain('Marker 1');
    });

    it('deletes marker on context menu', () => {
        const projectWithMarker = {
            ...mockProject,
            markers: [{ id: 'm1', time: 1, text: 'Intro', color: 'red' }]
        };
        const setProject = vi.fn();
        
        // Mock confirm
        window.confirm = vi.fn(() => true);

        const { getByText } = render(
            <Arranger 
                project={projectWithMarker} 
                setProject={setProject}
                currentTime={0}
                isPlaying={false}
                isRecording={false}
                onPlayPause={() => {}}
                onStop={() => {}}
                onRecord={() => {}}
                onSeek={() => {}}
                onSplit={() => {}}
                zoom={50}
                setZoom={() => {}}
                selectedTrackId={null}
                onSelectTrack={() => {}}
                selectedClipIds={[]}
                onSelectClip={() => {}}
                onOpenInspector={() => {}}
            />
        );

        const markerEl = getByText('Intro').parentElement;
        fireEvent.contextMenu(markerEl!);

        expect(window.confirm).toHaveBeenCalled();
        expect(setProject).toHaveBeenCalled();
        
        const updater = setProject.mock.calls[0][0];
        const newState = updater(projectWithMarker);
        expect(newState.markers.length).toBe(0);
    });
});