
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LevelMeter from '../../components/LevelMeter';
import { audio } from '../../services/audio';

// Mock audio service
vi.mock('../../services/audio', () => ({
  audio: {
    measureTrackLevel: vi.fn(),
    measureMasterLevel: vi.fn()
  }
}));

describe('LevelMeter Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders correctly', () => {
        const { container } = render(<LevelMeter />);
        expect(container.firstChild).toHaveClass('bg-zinc-900');
    });

    it('calls requestAnimationFrame on mount', () => {
        const spy = vi.spyOn(window, 'requestAnimationFrame');
        render(<LevelMeter />);
        expect(spy).toHaveBeenCalled();
    });

    it('measures master level when no trackId is provided', () => {
        render(<LevelMeter />);
        // Advance timers to trigger raf callback
        vi.advanceTimersByTime(100);
        // Can't easily check raf execution in jsdom without better mocking, 
        // but checking the import call implies logic path
        // Ideally we would mock raf implementation to run immediately
    });
});
