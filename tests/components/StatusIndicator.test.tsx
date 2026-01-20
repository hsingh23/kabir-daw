
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusIndicator from '../../components/StatusIndicator';

describe('StatusIndicator', () => {
  it('displays saved status', () => {
    const { getByText } = render(<StatusIndicator status="saved" />);
    expect(getByText('Saved')).toBeInTheDocument();
  });

  it('displays saving status', () => {
    const { getByText } = render(<StatusIndicator status="saving" />);
    expect(getByText('Saving...')).toBeInTheDocument();
  });
  
  it('displays unsaved status', () => {
      const { getByText } = render(<StatusIndicator status="unsaved" />);
      expect(getByText('Unsaved')).toBeInTheDocument();
  });
});
