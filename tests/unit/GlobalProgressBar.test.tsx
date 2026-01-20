
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GlobalProgressBar from '../../components/GlobalProgressBar';

describe('GlobalProgressBar Component', () => {
    it('does not render when inactive', () => {
        const { container } = render(<GlobalProgressBar isLoading={false} isExporting={false} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders blue bar when loading', () => {
        const { container } = render(<GlobalProgressBar isLoading={true} isExporting={false} />);
        const bar = container.querySelector('.bg-blue-500');
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveClass('animate-progress-indeterminate');
    });

    it('renders accent bar when exporting (priority over loading)', () => {
        // Even if loading is true, exporting should take precedence in color if designed that way 
        // (Implementation: const color = isExporting ? 'bg-studio-accent' : 'bg-blue-500')
        const { container } = render(<GlobalProgressBar isLoading={true} isExporting={true} />);
        const bar = container.querySelector('.bg-studio-accent');
        expect(bar).toBeInTheDocument();
        
        // Ensure blue is not present
        const blueBar = container.querySelector('.bg-blue-500');
        expect(blueBar).not.toBeInTheDocument();
    });
});
