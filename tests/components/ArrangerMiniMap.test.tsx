
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrangerMiniMap from '../../components/ArrangerMiniMap';
import { Clip } from '../../types';

describe('ArrangerMiniMap', () => {
    const mockClips: Clip[] = [
        { id: 'c1', trackId: 't1', name: 'Clip 1', start: 0, duration: 10, offset: 0, bufferKey: 'k', fadeIn: 0, fadeOut: 0, color: '#f00' },
        { id: 'c2', trackId: 't1', name: 'Clip 2', start: 20, duration: 5, offset: 0, bufferKey: 'k', fadeIn: 0, fadeOut: 0, color: '#00f' }
    ];

    it('renders visual representation of clips', () => {
        const { container } = render(
            <ArrangerMiniMap 
                clips={mockClips} 
                totalDuration={100} 
                visibleStartTime={0} 
                visibleDuration={20} 
                onScroll={vi.fn()} 
            />
        );

        // Expect two divs for clips
        const clipDivs = container.querySelectorAll('div[style*="absolute"]');
        // Actually there is also a viewport indicator div, so check styles specifically
        // Clip 1: left 0%, width 10%
        // Clip 2: left 20%, width 5%
        // Viewport: left 0%, width 20%
        
        // We can just check for existence of clips style
        const clip1 = Array.from(clipDivs).find(d => d.getAttribute('style')?.includes('width: 10%'));
        const clip2 = Array.from(clipDivs).find(d => d.getAttribute('style')?.includes('width: 5%'));
        
        expect(clip1).toBeDefined();
        expect(clip2).toBeDefined();
    });

    it('calls onScroll when clicked', () => {
        const onScroll = vi.fn();
        const { container } = render(
            <ArrangerMiniMap 
                clips={mockClips} 
                totalDuration={100} 
                visibleStartTime={0} 
                visibleDuration={20} 
                onScroll={onScroll} 
            />
        );

        // Mock getBoundingClientRect
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            left: 0, top: 0, width: 1000, height: 32, right: 1000, bottom: 32, x: 0, y: 0, toJSON: () => {}
        }));

        // Click at 50% width (500px) -> time 50
        // Logic: newStartTime = clickTime - (visibleDuration / 2)
        // 50 - (20 / 2) = 40
        const map = container.firstChild as Element;
        fireEvent.pointerDown(map, { clientX: 500, pointerId: 1 });

        expect(onScroll).toHaveBeenCalledWith(40);
    });
});
