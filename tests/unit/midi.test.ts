
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { midi } from '../../services/midi';

describe('MidiService', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton internal state by recreating it or manually clearing (since it's a module singleton, clearing via public methods is tricky, but listeners can be managed)
        // Since we can't easily reset private sets in the singleton, we rely on test isolation or assume empty start if not for other tests.
        // However, we can mock navigator.requestMIDIAccess differently per test if needed.
    });

    it('initializes if supported', async () => {
        const mockInput = {
            id: 'input-1',
            type: 'input',
            state: 'connected',
            onmidimessage: null
        };
        const mockAccess = {
            inputs: new Map([['input-1', mockInput]]),
            onstatechange: null
        };
        
        Object.defineProperty(navigator, 'requestMIDIAccess', {
            value: vi.fn(() => Promise.resolve(mockAccess)),
            writable: true
        });

        await midi.init();
        expect(navigator.requestMIDIAccess).toHaveBeenCalled();
        expect(mockInput.onmidimessage).toBeDefined();
    });

    it('handles Note On message', () => {
        const noteOnHandler = vi.fn();
        midi.onNoteOn(noteOnHandler);

        // Simulate message
        // Since we can't easily access private handleMidiMessage, we simulate the effect by manually triggering if we exposed it, 
        // OR we mock the input's onmidimessage handler after init.
        
        const mockInput = { onmidimessage: null as any };
        (navigator as any).requestMIDIAccess = vi.fn(() => Promise.resolve({ inputs: [mockInput], onstatechange: null }));
        
        return midi.init().then(() => {
            // Trigger handler
            const handler = mockInput.onmidimessage;
            expect(handler).toBeDefined();
            
            // Note On Channel 1 (0x90), Note 60, Velocity 100
            const event = { data: [0x90, 60, 100], timeStamp: 12345 };
            handler(event);
            
            expect(noteOnHandler).toHaveBeenCalledWith(60, 100, 12345);
        });
    });

    it('handles Note Off message', () => {
        const noteOffHandler = vi.fn();
        midi.onNoteOff(noteOffHandler);

        const mockInput = { onmidimessage: null as any };
        (navigator as any).requestMIDIAccess = vi.fn(() => Promise.resolve({ inputs: [mockInput], onstatechange: null }));

        return midi.init().then(() => {
            const handler = mockInput.onmidimessage;
            // Note Off (0x80)
            const event = { data: [0x80, 60, 0], timeStamp: 100 };
            handler(event);
            expect(noteOffHandler).toHaveBeenCalledWith(60, 0, 100);
        });
    });
});
