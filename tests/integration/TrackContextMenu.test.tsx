
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Arranger from '../../components/Arranger';
import { ProjectState } from '../../types';
import { ProjectProvider } from '../../contexts/ProjectContext';

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

const mockProject: ProjectState = {
  id: 'test-track-menu',
  name: 'Test Project',
  bpm: 120,
  timeSignature: [4, 4],
  returnToStartOnStop: true,
  tracks: [
    { id: 't1', type: 'audio', name: 'Original Track', volume: 1, pan: 0, muted: false, solo: false, color: '#fff', eq: {low:0,mid:0,high:0}, sends:{reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
  ],
  clips: [],
  markers: [], loopStart:0, loopEnd:4, isLooping:false, metronomeOn:false, countIn:0, recordingLatency:0, inputMonitoring:false,
  masterVolume:1, masterEq:{low:0,mid:0,high:0}, masterCompressor:{threshold:-20,ratio:4, attack: 0.01, release: 0.1}, effects:{reverb:0,delay:0,chorus:0},
  sequencer: { enabled: false, volume: 0.8, tracks: [] },
  drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
};

describe('Arranger Track Context Menu', () => {
    
    it('opens track menu on right click', () => {
        const { getByText } = render(
            <ProjectProvider initialProject={mockProject}>
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
            </ProjectProvider>
        );

        const trackHeader = getByText('Original Track').closest('div[style*="height"]');
        expect(trackHeader).toBeInTheDocument();

        fireEvent.contextMenu(trackHeader!);

        expect(getByText('Duplicate')).toBeInTheDocument();
        expect(getByText('Delete Track')).toBeInTheDocument();
    });
});
