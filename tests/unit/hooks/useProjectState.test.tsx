
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useProjectState } from '../../../hooks/useProjectState';
import { ProjectState } from '../../../types';

// Minimal mock
const initialProject: ProjectState = {
    id: '1',
    name: 'Init',
    bpm: 120,
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
    masterCompressor: { threshold: -20, ratio: 4 },
    effects: { reverb: 0, delay: 0, chorus: 0 },
    tanpura: { enabled: false, volume: 0, key: 'C', tuning: 'Pa', tempo: 60 },
    tabla: { enabled: false, volume: 0, taal: 'TeenTaal', bpm: 100, key: 'C' }
};

describe('useProjectState Hook', () => {
    it('initializes with given project', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        expect(result.current.project.name).toBe('Init');
    });

    it('updates project state', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        
        act(() => {
            result.current.updateProject(prev => ({ ...prev, name: 'Updated' }));
        });
        
        expect(result.current.project.name).toBe('Updated');
    });

    it('pushes to past history on update', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        
        act(() => {
            result.current.updateProject(prev => ({ ...prev, name: 'Step 1' }));
        });
        
        expect(result.current.past).toHaveLength(1);
        expect(result.current.past[0].name).toBe('Init');
    });

    it('handles undo correctly', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        
        act(() => {
            result.current.updateProject(prev => ({ ...prev, name: 'Step 1' }));
        });
        
        act(() => {
            result.current.undo();
        });
        
        expect(result.current.project.name).toBe('Init');
        expect(result.current.future).toHaveLength(1);
        expect(result.current.future[0].name).toBe('Step 1');
    });

    it('handles redo correctly', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        
        act(() => {
            result.current.updateProject(prev => ({ ...prev, name: 'Step 1' }));
        });
        
        act(() => {
            result.current.undo();
        });
        
        act(() => {
            result.current.redo();
        });
        
        expect(result.current.project.name).toBe('Step 1');
        expect(result.current.past).toHaveLength(1);
    });

    it('limits history size (mock check for slice)', () => {
        const { result } = renderHook(() => useProjectState(initialProject));
        
        // Simulate many updates
        for (let i = 0; i < 25; i++) {
            act(() => {
                result.current.updateProject(prev => ({ ...prev, name: `Step ${i}` }));
            });
        }
        
        // Implementation slices -19, so max 19 items in history?
        // Actually slice(-19) keeps last 19.
        expect(result.current.past.length).toBeLessThanOrEqual(20); 
    });
});
