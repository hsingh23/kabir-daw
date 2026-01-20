
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VisualCompressor from '../../components/VisualCompressor';

describe('VisualCompressor Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders canvas', () => {
        const { container } = render(
            <VisualCompressor 
                threshold={-20} 
                ratio={4} 
                knee={10} 
            />
        );
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('displays label', () => {
        const { getByText } = render(
            <VisualCompressor 
                threshold={-20} 
                ratio={4} 
                knee={10} 
            />
        );
        expect(getByText('COMPRESSION CURVE')).toBeInTheDocument();
    });
});
