
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PianoRoll from '../../components/PianoRoll';
import { MidiNote } from '../../types';

describe('PianoRoll Component', () => {
    let mockNotes: MidiNote[];
    let onNotesChange: any;

    beforeEach(() => {
        mockNotes = [];
        onNotesChange = vi.fn();
        
        // Mock getBoundingClientRect
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            top: 0, left: 0, right: 500, bottom: 500, width: 500, height: 500, x: 0, y: 0, toJSON: () => {}
        }));
    });

    it('renders canvas', () => {
        const { container } = render(
            <PianoRoll notes={mockNotes} duration={4} onNotesChange={onNotesChange} />
        );
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('adds note on click', () => {
        const { container } = render(
            <PianoRoll notes={mockNotes} duration={4} onNotesChange={onNotesChange} />
        );
        const canvas = container.querySelector('canvas')!;
        
        // Simulate click in grid area (x>40 for keys width)
        // Click at x=100 (time) y=200 (pitch)
        fireEvent.pointerDown(canvas, { clientX: 100, clientY: 200, pointerId: 1 });
        
        expect(onNotesChange).toHaveBeenCalled();
        const newNotes = onNotesChange.mock.calls[0][0];
        expect(newNotes).toHaveLength(1);
        // Note defaults to 0.25 duration
        expect(newNotes[0].duration).toBe(0.25);
    });

    it('selects existing note on click', () => {
        const existingNotes: MidiNote[] = [
            { note: 60, start: 0, duration: 1, velocity: 100 }
        ];
        
        const { container } = render(
            <PianoRoll notes={existingNotes} duration={4} onNotesChange={onNotesChange} />
        );
        const canvas = container.querySelector('canvas')!;
        
        // Calculate coords for note 60 at time 0
        // KeysWidth = 40. Start = 0. X = 40.
        // Pitch 60. Max 84. Row = 84 - 60 = 24. Y = 24 * 16 = 384.
        
        // Click on the note
        fireEvent.pointerDown(canvas, { clientX: 50, clientY: 390, pointerId: 1 });
        
        // Should not trigger change (creation), just selection/drag start.
        // Note: The component logic triggers drag state on pointer down for existing notes, 
        // but doesn't call onNotesChange until move.
        expect(onNotesChange).not.toHaveBeenCalled();
        
        // Move slightly
        fireEvent.pointerMove(canvas, { clientX: 60, clientY: 390, pointerId: 1 });
        
        // Now it should update
        expect(onNotesChange).toHaveBeenCalled();
    });
});
