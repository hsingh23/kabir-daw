
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrangerToolbar from '../../components/ArrangerToolbar';
import { ProjectState, ToolMode } from '../../types';
import { ProjectProvider } from '../../contexts/ProjectContext';

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
    countIn: 0,
    recordingLatency: 0,
    inputMonitoring: false,
    masterVolume: 1,
    masterEq: { low: 0, mid: 0, high: 0 },
    masterCompressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
    effects: { reverb: 0, delay: 0, chorus: 0 },
    sequencer: { enabled: false, volume: 0.8, tracks: [] },
    drone: { enabled: false, volume: 0.5, note: 36, oscillators: [] }
};

describe('ArrangerToolbar', () => {
    const defaultProps = {
        tool: ToolMode.POINTER,
        setTool: vi.fn(),
        snapGrid: 1,
        setSnapGrid: vi.fn(),
        quantizeStrength: 100,
        setQuantizeStrength: vi.fn(),
        zoom: 100,
        setZoom: vi.fn(),
        isSidebarCollapsed: false,
        setIsSidebarCollapsed: vi.fn(),
        isLibraryOpen: false,
        setIsLibraryOpen: vi.fn(),
        showInstruments: false,
        setShowInstruments: vi.fn(),
        selectedClipIds: [],
        onZoomToFit: vi.fn(),
        toggleTrackHeight: vi.fn(),
        numerator: 4,
        handleQuantize: vi.fn()
    };

    it('renders all tool buttons', () => {
        const { getByTitle } = render(
            <ProjectProvider initialProject={mockProject}>
                <ArrangerToolbar {...defaultProps} />
            </ProjectProvider>
        );
        expect(getByTitle(/Pointer/)).toBeInTheDocument();
        expect(getByTitle(/Hand/)).toBeInTheDocument();
        expect(getByTitle('Split')).toBeInTheDocument();
        expect(getByTitle('Erase')).toBeInTheDocument();
        expect(getByTitle('Automation')).toBeInTheDocument();
    });

    it('switches to Hand tool on click', () => {
        const setTool = vi.fn();
        const { getByTitle } = render(
            <ProjectProvider initialProject={mockProject}>
                <ArrangerToolbar {...defaultProps} setTool={setTool} />
            </ProjectProvider>
        );
        
        fireEvent.click(getByTitle(/Hand/));
        expect(setTool).toHaveBeenCalledWith(ToolMode.HAND);
    });

    it('toggles library visibility', () => {
        const setIsLibraryOpen = vi.fn();
        const { getByTitle } = render(
            <ProjectProvider initialProject={mockProject}>
                <ArrangerToolbar {...defaultProps} setIsLibraryOpen={setIsLibraryOpen} />
            </ProjectProvider>
        );
        
        fireEvent.click(getByTitle('Toggle Library'));
        expect(setIsLibraryOpen).toHaveBeenCalledWith(true);
    });
});
