
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SpectrumAnalyzer from '../../components/SpectrumAnalyzer';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    masterAnalyser: {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(arr => arr.fill(128))
    }
  }
}));

describe('SpectrumAnalyzer Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders canvas element', () => {
        const { container } = render(<SpectrumAnalyzer />);
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('sets up animation loop', () => {
        const spy = vi.spyOn(window, 'requestAnimationFrame');
        render(<SpectrumAnalyzer />);
        expect(spy).toHaveBeenCalled();
    });
});
