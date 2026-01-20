
import { render, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AudioContextOverlay from '../../components/AudioContextOverlay';
import { audio } from '../../services/audio';

// Mock audio
vi.mock('../../services/audio', () => ({
  audio: {
    ctx: { 
        state: 'suspended', 
        resume: vi.fn(() => Promise.resolve()),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        suspend: vi.fn(() => Promise.resolve())
    },
    resumeContext: vi.fn(() => Promise.resolve())
  }
}));

describe('AudioContextOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state
        (audio.ctx as any).state = 'suspended';
    });

    it('shows overlay when context is suspended', () => {
        const { getByText } = render(<AudioContextOverlay />);
        expect(getByText('Start Audio Engine')).toBeInTheDocument();
    });

    it('calls resumeContext on click', async () => {
        const { getByText } = render(<AudioContextOverlay />);
        const btn = getByText('Start Audio Engine');
        
        fireEvent.click(btn);
        
        expect(audio.resumeContext).toHaveBeenCalled();
        
        // After resume, state should visually update (mock doesn't update state automatically, 
        // but component checks state on render/effect). 
        // We can simulate state change behavior if we mock the event listener, 
        // but simple interaction verification is sufficient here.
    });

    it('does not render if context is running', () => {
        (audio.ctx as any).state = 'running';
        const { queryByText } = render(<AudioContextOverlay />);
        expect(queryByText('Start Audio Engine')).not.toBeInTheDocument();
    });
});
