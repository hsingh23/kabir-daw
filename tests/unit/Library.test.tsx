
import { render } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
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
    resumeContext: vi.fn()
  }
}));

describe('Library Component', () => {
  it('displays skeleton loading state initially', async () => {
    // Mock slow DB response
    (db.getAllAssetKeys as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(['kick.wav']), 100)));
    (db.getAllAssetsMetadata as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));
    
    const { getByText, container } = render(<Library />);
    
    // Switch to assets tab to trigger load
    const assetsTab = getByText('Assets');
    assetsTab.click();
    
    // Check for skeleton elements (animate-pulse class is key identifier for skeleton)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    
    // Wait for load to finish
    await waitFor(() => {
        expect(db.getAllAssetsMetadata).toHaveBeenCalled();
    });
  });

  it('loads and displays assets after loading', async () => {
    (db.getAllAssetKeys as any).mockResolvedValue(['kick.wav']);
    (db.getAllAssetsMetadata as any).mockResolvedValue([
        { id: '1', name: 'kick.wav', type: 'oneshot', tags: [], dateAdded: 0, instrument: 'Drums' }
    ]);
    
    const { getByText, container } = render(<Library />);
    
    // Switch to assets tab
    getByText('Assets').click();
    
    await waitFor(() => {
        expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
        expect(getByText('kick.wav')).toBeInTheDocument();
    });
  });
});
