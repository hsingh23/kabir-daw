
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Library from '../../components/Library';
import * as db from '../../services/db';

// Mock dependencies
vi.mock('../../services/db');
vi.mock('../../services/audio', () => ({
  audio: {
    ctx: {
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        onended: null
      })),
      destination: {}
    },
    loadAudio: vi.fn(),
    stop: vi.fn(),
  }
}));

describe('Library Component', () => {
  it('loads and displays assets', async () => {
    (db.getAllAssetKeys as any).mockResolvedValue(['kick.wav', 'snare.wav']);
    
    const { getByText, queryByText } = render(<Library />);
    
    // Switch to assets tab to trigger load
    const assetsTab = getByText('Assets');
    assetsTab.click();
    
    // Check loading state
    expect(getByText('Loading library...')).toBeInTheDocument();
    
    await waitFor(() => {
        expect(queryByText('Loading library...')).not.toBeInTheDocument();
        expect(getByText('kick.wav')).toBeInTheDocument();
        expect(getByText('snare.wav')).toBeInTheDocument();
    });
  });
});
