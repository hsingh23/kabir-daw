
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrackLane from '../../components/TrackLane';
import { Track } from '../../types';

// Mock dependencies
vi.mock('../../components/TrackIcon', () => ({
    default: () => <div data-testid="track-icon" />
}));
vi.mock('../../components/LevelMeter', () => ({
    default: () => <div data-testid="level-meter" />
}));

describe('TrackLane Component', () => {
    const mockTrack: Track = {
        id: 't1',
        type: 'audio',
        name: 'Guitar',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        color: '#ff0000',
        eq: { low: 0, mid: 0, high: 0 },
        compressor: { enabled: false, threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
        sends: { reverb: 0, delay: 0, chorus: 0 }
    };

    const defaultProps = {
        track: mockTrack,
        index: 0,
        trackHeight: 100,
        isCompactHeader: false,
        isSelected: false,
        onSelectTrack: vi.fn(),
        onOpenInspector: vi.fn(),
        handleTrackDragStart: vi.fn(),
        updateTrack: vi.fn()
    };

    it('renders track name and controls', () => {
        const { getByText, getByTestId, getByTitle } = render(<TrackLane {...defaultProps} />);
        
        expect(getByText('Guitar')).toBeInTheDocument();
        expect(getByTestId('track-icon')).toBeInTheDocument();
        expect(getByTestId('level-meter')).toBeInTheDocument();
        
        // Mute/Solo buttons by text
        expect(getByText('M')).toBeInTheDocument();
        expect(getByText('S')).toBeInTheDocument();
    });

    it('hides controls in compact mode', () => {
        const { queryByRole, getByText } = render(<TrackLane {...defaultProps} isCompactHeader={true} />);
        
        // Volume slider is an input range
        expect(queryByRole('slider')).not.toBeInTheDocument();
        
        // Buttons should still be there (bottom row)
        expect(getByText('M')).toBeInTheDocument();
    });

    it('handles selection on pointer down', () => {
        const onSelect = vi.fn();
        const { getByText } = render(<TrackLane {...defaultProps} onSelectTrack={onSelect} />);
        
        fireEvent.pointerDown(getByText('Guitar').closest('div[style*="height"]')!);
        expect(onSelect).toHaveBeenCalledWith('t1');
    });

    it('toggles mute', () => {
        const update = vi.fn();
        const { getByText } = render(<TrackLane {...defaultProps} updateTrack={update} />);
        
        const muteBtn = getByText('M');
        fireEvent.pointerDown(muteBtn);
        
        expect(update).toHaveBeenCalledWith('t1', { muted: true });
    });

    it('toggles solo', () => {
        const update = vi.fn();
        const { getByText } = render(<TrackLane {...defaultProps} updateTrack={update} />);
        
        const soloBtn = getByText('S');
        fireEvent.pointerDown(soloBtn);
        
        expect(update).toHaveBeenCalledWith('t1', { solo: true });
    });
});