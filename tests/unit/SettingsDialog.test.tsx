
import { render, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsDialog from '../../components/SettingsDialog';
import { audio } from '../../services/audio';

vi.mock('../../services/audio', () => ({
  audio: {
    getAudioDevices: vi.fn(() => Promise.resolve({
        inputs: [{ deviceId: 'in1', label: 'Mic 1', kind: 'audioinput', groupId: '1', toJSON: () => {} }],
        outputs: [{ deviceId: 'out1', label: 'Speaker 1', kind: 'audiooutput', groupId: '2', toJSON: () => {} }]
    })),
    setOutputDevice: vi.fn(),
    setMetronomeVolume: vi.fn(),
    selectedInputDeviceId: undefined
  }
}));

// Mock navigator.mediaDevices.getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: () => {} }] })),
        enumerateDevices: vi.fn(() => Promise.resolve([]))
    },
    writable: true
});

describe('SettingsDialog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads devices on mount', async () => {
        const { getByText, findByText } = render(<SettingsDialog onClose={() => {}} />);
        
        await waitFor(() => expect(audio.getAudioDevices).toHaveBeenCalled());
        
        // Check if options are rendered
        expect(await findByText('Mic 1')).toBeInTheDocument();
        expect(await findByText('Speaker 1')).toBeInTheDocument();
    });

    it('changes output device', async () => {
        const { findByRole } = render(<SettingsDialog onClose={() => {}} />);
        
        // Wait for select to populate
        const outputSelect = await findByRole('combobox', { name: '' }); // Selects are tricky without explicit label association via ID in this simple component structure
        // Actually we can find by display value
        // The component has label "Output Device", then select.
        
        // Let's use getByDisplayValue after wait
        await waitFor(() => expect(audio.getAudioDevices).toHaveBeenCalled());
        
        // Fire change event
        const selects = document.querySelectorAll('select');
        const outputSel = selects[1]; // Second select is output
        
        fireEvent.change(outputSel, { target: { value: 'out1' } });
        
        expect(audio.setOutputDevice).toHaveBeenCalledWith('out1');
    });

    it('changes metronome volume', () => {
        const { container } = render(<SettingsDialog onClose={() => {}} />);
        const range = container.querySelector('input[type="range"]');
        
        fireEvent.change(range!, { target: { value: '0.8' } });
        expect(audio.setMetronomeVolume).toHaveBeenCalledWith(0.8);
    });

    it('switches tabs', () => {
        const { getByText, queryByText } = render(<SettingsDialog onClose={() => {}} />);
        
        fireEvent.click(getByText('General'));
        
        expect(getByText('PocketStudio')).toBeInTheDocument();
        expect(queryByText('Input Device')).not.toBeInTheDocument();
    });
});
