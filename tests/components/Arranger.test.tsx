
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';

// Mock audio service
vi.mock('../../services/audio', () => ({
  audio: {
    buffers: new Map(),
    getCurrentTime: () => 0,
  }
}));

// Mock Waveform component
vi.mock('../../components/Waveform', () => ({
  default: () => <div data-testid="mock-waveform">Waveform</div>
}));

// Mock useProject
const useProjectMock = vi.fn();
vi.mock('../../contexts/ProjectContext', () => ({
    useProject: () => useProjectMock(),
    ProjectProvider: ({children}: any) => <div>{children}</div>
}));

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
}));

const mockProject: ProjectState = {
  id: 'test-project',
  name: 'Test Project',
  bpm: 120,
  timeSignature: [4, 4],
  returnToStartOnStop: true,
  tracks: [
    { id: 't1', type: 'audio', name: 'Guitar', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
  ],
  clips: [
    { id: 'c1', trackId: 't1', name: 'Riff 1', start: 0, offset: 0, duration: 4, bufferKey: 'key1', fadeIn: 0, fadeOut: 0 }
  ],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: true,
  metronomeOn: false,
  countIn: 0,
  recordingLatency: 0,
  inputMonitoring: false,
  masterVolume: 1,
  masterEq: { low: 0, mid: 0, high: 0 },
  masterCompressor: { threshold: -24, ratio: 12, attack: 0.05, release: 0.25 },
  effects: { reverb: 0, delay: 0, chorus: 0 },
  sequencer: { enabled: false, volume: 0.8, tracks: [] },
  drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
};

describe('Arranger Component Interaction', () => {
    
    it('opens context menu on right click', () => {
        const setProject = vi.fn();
        useProjectMock.mockReturnValue({ project: mockProject, setProject, updateProject: setProject });

        const { getByText } = render(
            <Arranger
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
                commitTransaction={() => {}}
            />
        );

        const clip = getByText('Riff 1').closest('div[style*="absolute"]');
        expect(clip).toBeInTheDocument();

        // Right click (button: 2)
        fireEvent.pointerDown(clip!, { button: 2, clientX: 100, clientY: 100 });

        // Menu items should appear
        expect(getByText('Rename')).toBeInTheDocument();
        expect(getByText('Delete')).toBeInTheDocument();
    });

    it('renders loop region and handles', () => {
        const setProject = vi.fn();
        useProjectMock.mockReturnValue({ project: mockProject, setProject, updateProject: setProject });

        const { container } = render(
            <Arranger
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
                commitTransaction={() => {}}
            />
        );

        const handles = container.querySelectorAll('.cursor-ew-resize');
        expect(handles.length).toBeGreaterThan(0); // Should have left and right handles
    });

    it('displays Zero State when no tracks exist', () => {
        const emptyProject = { ...mockProject, tracks: [] };
        const setProject = vi.fn();
        const updateProject = vi.fn();
        useProjectMock.mockReturnValue({ project: emptyProject, setProject, updateProject });

        const { getByText } = render(
            <Arranger
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
                commitTransaction={() => {}}
            />
        );

        expect(getByText('No Tracks Created')).toBeInTheDocument();
        
        // Check CTA action
        const addBtn = getByText('Audio Track'); // Updated text from 'Add First Track'
        fireEvent.click(addBtn);
        
        expect(updateProject).toHaveBeenCalled();
    });
});
