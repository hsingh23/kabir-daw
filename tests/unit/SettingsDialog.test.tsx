
import { render, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsDialog from '../../components/SettingsDialog';
import { audio } from '../../services/audio';
import { ProjectState } from '../../types';

vi.mock('../../services/audio', () => ({
  audio: {
    getAudioDevices: vi.fn(() => Promise.resolve({
        inputs: [{ deviceId: 'in1', label: 'Mic 1', kind: 'audioinput', groupId: '1', toJSON: () => {} }],
        outputs: [{ deviceId: 'out1', label: 'Speaker 1', kind: 'audiooutput', groupId: '2', toJSON: () => {} }]
    })),
    setOutputDevice: vi.fn(),
    setMetronomeVolume: vi.fn(),
    selectedInputDeviceId: undefined,
    initInput: vi.fn(),
    measureInputLevel: vi.fn(() => 0),
    closeInput: vi.fn()
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

const mockProject: ProjectState = {
    id: 'test',
    name: 'Test Project',
    bpm: 120,
    timeSignature: [4, 4],
    returnToStartOnStop: true,
    tracks: [],
    clips: [],
    markers: [],
    loopStart: 0,
    loopEnd: 4,
    isLooping: false,
    metronomeOn: false,
    metronomeSound: 'beep',
    countIn: 0,
    recordingLatency: 0,
    inputMonitoring: false,
    masterVolume: 1,
    masterEq: { low: 0, mid: 0, high: 0 },
    masterCompressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
    effects: { reverb: 0, delay: 0, chorus: 0 },
    tanpura: { enabled: false, volume: 0, key: 'C', tuning: 'Pa', tempo: 60 },
    tabla: { enabled: false, volume: 0, taal: 'TeenTaal', bpm: 100, key: 'C' }
};

describe('SettingsDialog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads devices on mount', async () => {
        const { getByText, findByText } = render(<SettingsDialog onClose={() => {}} project={mockProject} setProject={() => {}} />);
        
        await waitFor(() => expect(audio.getAudioDevices).toHaveBeenCalled());
        
        // Check if options are rendered
        expect(await findByText('Mic 1')).toBeInTheDocument();
        expect(await findByText('Speaker 1')).toBeInTheDocument();
    });

    it('changes output device', async () => {
        const { findByRole } = render(<SettingsDialog onClose={() => {}} project={mockProject} setProject={() => {}} />);
        
        await waitFor(() => expect(audio.getAudioDevices).toHaveBeenCalled());
        
        const selects = document.querySelectorAll('select');
        // Index might vary depending on structure, finding by label text usually better but simplified here
        // Order: Input, Output, CountIn
        // Let's rely on option text if possible, or order
        
        // Input is first select
        // Output is second select
        const outputSel = selects[1]; 
        
        fireEvent.change(outputSel, { target: { value: 'out1' } });
        
        expect(audio.setOutputDevice).toHaveBeenCalledWith('out1');
    });

    it('updates recording latency', () => {
        const setProject = vi.fn();
        const { getByText } = render(<SettingsDialog onClose={() => {}} project={mockProject} setProject={setProject} />);
        
        const latencyLabel = getByText('Recording Latency Compensation');
        expect(latencyLabel).toBeInTheDocument();
        
        const inputs = document.querySelectorAll('input[type="range"]');
        const latencyInput = Array.from(inputs).find(i => i.getAttribute('max') === '500');
        
        fireEvent.change(latencyInput!, { target: { value: '50' } });
        
        expect(setProject).toHaveBeenCalledWith(expect.any(Function));
        
        // Verify state update function logic
        const updater = setProject.mock.calls[0][0];
        expect(updater(mockProject).recordingLatency).toBe(50);
    });

    it('toggles input monitoring', () => {
        const setProject = vi.fn();
        const { getByText } = render(<SettingsDialog onClose={() => {}} project={mockProject} setProject={setProject} />);
        
        const monitorLabel = getByText('Input Monitoring');
        const toggleBtn = monitorLabel.nextElementSibling; // Button is sibling
        
        fireEvent.click(toggleBtn!);
        
        expect(setProject).toHaveBeenCalledWith(expect.any(Function));
        
        const updater = setProject.mock.calls[0][0];
        expect(updater(mockProject).inputMonitoring).toBe(true);
    });
});
