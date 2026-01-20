
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HeaderInputMeter from '../../components/HeaderInputMeter';
import { audio } from '../../services/audio';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    measureInputLevel: vi.fn(() => 0.5)
  }
}));

describe('HeaderInputMeter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders and animates when active', () => {
        const { container } = render(<HeaderInputMeter isRecordingOrMonitoring={true} />);
        
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
        expect(container.firstChild).toHaveClass('animate-in');

        // Check if measurement is called in loop
        const spy = vi.spyOn(audio, 'measureInputLevel');
        
        // Advance frame
        vi.advanceTimersByTime(16);
        expect(spy).toHaveBeenCalled();
    });

    it('renders nothing when inactive', () => {
        const { container } = render(<HeaderInputMeter isRecordingOrMonitoring={false} />);
        expect(container.firstChild).toBeNull();
    });
});
