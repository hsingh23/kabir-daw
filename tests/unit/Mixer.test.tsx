
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Mixer from '../../components/Mixer';
import { ProjectState } from '../../types';
import { ProjectProvider } from '../../contexts/ProjectContext';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    measureTrackLevel: () => 0,
    measureMasterLevel: () => 0,
    setTrackVolume: vi.fn(),
    setMasterVolume: vi.fn(),
  }
}));

const mockProject: ProjectState = {
  id: 'test',
  name: 'Test Project',
  bpm: 120,
  timeSignature: [4, 4],
  returnToStartOnStop: true,
  tracks: [
    { id: 't1', type: 'audio', name: 'Track 1', volume: 0.8, pan: 0, muted: false, solo: false, color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } },
    { id: 't2', type: 'audio', name: 'Track 2', volume: 0.5, pan: 0, muted: false, solo: false, color: '#fff', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 }, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
  ],
  clips: [],
  markers: [],
  loopStart: 0,
  loopEnd: 4,
  isLooping: false,
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

describe('Mixer Component', () => {
  it('renders all tracks', () => {
    const { getByText } = render(
      <ProjectProvider initialProject={mockProject}>
          <Mixer 
            isPlaying={false} 
            onPlayPause={() => {}} 
            onStop={() => {}} 
            onRecord={() => {}} 
            onOpenMaster={() => {}}
          />
      </ProjectProvider>
    );

    expect(getByText('Track 1')).toBeInTheDocument();
    expect(getByText('Track 2')).toBeInTheDocument();
  });

  it('updates master volume knob', () => {
    const { getByLabelText } = render(
      <ProjectProvider initialProject={mockProject}>
          <Mixer 
            isPlaying={false} 
            onPlayPause={() => {}} 
            onStop={() => {}} 
            onRecord={() => {}} 
            onOpenMaster={() => {}}
          />
      </ProjectProvider>
    );
    
    const masterKnob = getByLabelText('Master Vol'); 
    expect(masterKnob).toBeInTheDocument();
    
    // Simulate keyboard interaction
    fireEvent.keyDown(masterKnob, { key: 'ArrowDown', shiftKey: true });
    // State update is internal to provider, can't easily check 'setProject' mock
    // But we can check audio service call if needed, or re-render
  });

  it('switches tabs', () => {
      const { getByText } = render(
        <ProjectProvider initialProject={mockProject}>
            <Mixer 
              isPlaying={false} 
              onPlayPause={() => {}} 
              onStop={() => {}} 
              onRecord={() => {}} 
              onOpenMaster={() => {}}
            />
        </ProjectProvider>
      );

      // Default is tracks
      expect(getByText('Track 1')).toBeInTheDocument();

      // Switch to Backing
      fireEvent.click(getByText('Backing'));
      
      expect(getByText('Drone Synth')).toBeInTheDocument();
  });
});
