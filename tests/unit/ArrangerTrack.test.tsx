

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrangerTrack from '../../components/ArrangerTrack';
import { Track, Clip } from '../../types';

// Mock child components
vi.mock('../../components/Waveform', () => ({ default: () => <div data-testid="waveform" /> }));
vi.mock('../../components/MidiClipView', () => ({ default: () => <div data-testid="midi-clip" /> }));

describe('ArrangerTrack Component', () => {
    const mockTrack: Track = {
        id: 't1', type: 'audio', name: 'Track 1', volume: 1, pan: 0, muted: false, solo: false, 
        color: '#000', eq: { low: 0, mid: 0, high: 0 }, sends: { reverb: 0, delay: 0, chorus: 0 },
        sendConfig: { reverbPre: false, delayPre: false, chorusPre: false }
    };
    const mockClips: Clip[] = [
        { id: 'c1', trackId: 't1', name: 'Clip 1', start: 0, duration: 4, offset: 0, bufferKey: 'k1', fadeIn: 0, fadeOut: 0 }
    ];

    it('renders clips correctly', () => {
        const { getByText, getByTestId } = render(
            <ArrangerTrack
                track={mockTrack}
                clips={mockClips}
                trackHeight={100}
                zoom={50}
                selectedClipIds={[]}
                dragState={null}
                onDrop={vi.fn()}
                onClipPointerDown={vi.fn()}
            />
        );

        expect(getByText('Clip 1')).toBeInTheDocument();
        expect(getByTestId('waveform')).toBeInTheDocument();
    });

    it('handles selection on pointer down', () => {
        const onClipPointerDown = vi.fn();
        const { getByTestId } = render(
            <ArrangerTrack
                track={mockTrack}
                clips={mockClips}
                trackHeight={100}
                zoom={50}
                selectedClipIds={[]}
                dragState={null}
                onDrop={vi.fn()}
                onClipPointerDown={onClipPointerDown}
            />
        );

        const clipEl = getByTestId('clip-Clip 1');
        fireEvent.pointerDown(clipEl);
        
        expect(onClipPointerDown).toHaveBeenCalledWith(expect.anything(), mockClips[0], 'MOVE');
    });

    it('applies grayscale when track is muted', () => {
        const mutedTrack = { ...mockTrack, muted: true };
        const { container } = render(
            <ArrangerTrack
                track={mutedTrack}
                clips={mockClips}
                trackHeight={100}
                zoom={50}
                selectedClipIds={[]}
                dragState={null}
                onDrop={vi.fn()}
                onClipPointerDown={vi.fn()}
            />
        );

        expect(container.firstChild).toHaveClass('grayscale');
    });
});