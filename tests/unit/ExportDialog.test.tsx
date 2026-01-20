
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExportDialog from '../../components/ExportDialog';
import { ProjectState } from '../../types';

describe('ExportDialog Component', () => {
  const mockProject: ProjectState = {
      id: 'p1',
      name: 'Test Project',
      bpm: 120,
      timeSignature: [4, 4],
      returnToStartOnStop: true,
      tracks: [
          { id: 't1', type: 'audio', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: false, color: '#000', eq: {low:0,mid:0,high:0}, sends: {reverb:0,delay:0,chorus:0}, sendConfig: { reverbPre: false, delayPre: false, chorusPre: false } }
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
      masterEq: {low:0,mid:0,high:0},
      masterCompressor: {threshold:-20,ratio:4, attack: 0.01, release: 0.1},
      effects: {reverb:0,delay:0,chorus:0},
      sequencer: { enabled: false, volume: 0.8, tracks: [] },
      drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
  };

  it('renders correctly', () => {
    const { getByText } = render(
        <ExportDialog 
            onClose={() => {}} 
            onExport={() => {}} 
            isExporting={false} 
            project={mockProject} 
        />
    );
    expect(getByText('Export Project')).toBeInTheDocument();
    expect(getByText('Master Mix')).toBeInTheDocument();
    expect(getByText('Track Stems')).toBeInTheDocument();
  });

  it('calls export with master option by default', () => {
      const onExport = vi.fn();
      const { getByText } = render(
        <ExportDialog 
            onClose={() => {}} 
            onExport={onExport} 
            isExporting={false} 
            project={mockProject} 
        />
      );

      fireEvent.click(getByText('Export Audio'));
      expect(onExport).toHaveBeenCalledWith({ type: 'master' });
  });

  it('calls export with stems option when selected', () => {
      const onExport = vi.fn();
      const { getByText } = render(
        <ExportDialog 
            onClose={() => {}} 
            onExport={onExport} 
            isExporting={false} 
            project={mockProject} 
        />
      );

      // Select Stems option (clicking the button text container)
      fireEvent.click(getByText('Track Stems'));
      
      fireEvent.click(getByText('Export Audio'));
      expect(onExport).toHaveBeenCalledWith({ type: 'stems' });
  });

  it('disables buttons when exporting', () => {
      const { getByText } = render(
        <ExportDialog 
            onClose={() => {}} 
            onExport={() => {}} 
            isExporting={true} 
            project={mockProject} 
        />
      );

      expect(getByText('Rendering...')).toBeInTheDocument();
      expect(getByText('Rendering...')).toBeDisabled();
      expect(getByText('Cancel')).toBeDisabled();
  });
});
