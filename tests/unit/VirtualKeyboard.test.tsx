
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VirtualKeyboard from '../../components/VirtualKeyboard';
import { InstrumentConfig } from '../../types';

describe('VirtualKeyboard Component', () => {
    let mockOnNoteOn: any;
    let mockOnNoteOff: any;
    let mockConfig: InstrumentConfig;

    beforeEach(() => {
        mockOnNoteOn = vi.fn();
        mockOnNoteOff = vi.fn();
        mockConfig = { type: 'synth', preset: 'sawtooth', attack: 0, decay: 0, sustain: 1, release: 0 };
    });

    it('renders keys', () => {
        const { container } = render(
            <VirtualKeyboard trackId="t1" config={mockConfig} onClose={() => {}} onNoteOn={mockOnNoteOn} onNoteOff={mockOnNoteOff} />
        );
        expect(container.querySelectorAll('[data-note]').length).toBeGreaterThan(0);
    });

    it('triggers note on pointer down', () => {
        const { container } = render(
            <VirtualKeyboard trackId="t1" config={mockConfig} onClose={() => {}} onNoteOn={mockOnNoteOn} onNoteOff={mockOnNoteOff} />
        );
        
        // Find a white key (first one usually C3 = 48)
        const key = container.querySelector('[data-note="48"]');
        
        // Mock elementFromPoint for glissando logic
        document.elementFromPoint = vi.fn(() => key);

        fireEvent.pointerDown(container.querySelector('.flex-1.flex')!, { clientX: 10, clientY: 10, pointerId: 1, buttons: 1 });
        
        expect(mockOnNoteOn).toHaveBeenCalledWith(48, 100);
    });

    it('triggers note off on pointer up', () => {
        const { container } = render(
            <VirtualKeyboard trackId="t1" config={mockConfig} onClose={() => {}} onNoteOn={mockOnNoteOn} onNoteOff={mockOnNoteOff} />
        );
        
        const key = container.querySelector('[data-note="48"]');
        document.elementFromPoint = vi.fn(() => key);
        
        const wrapper = container.querySelector('.flex-1.flex')!;

        // Down
        fireEvent.pointerDown(wrapper, { clientX: 10, clientY: 10, pointerId: 1, buttons: 1 });
        // Up
        fireEvent.pointerUp(wrapper, { pointerId: 1 });
        
        expect(mockOnNoteOff).toHaveBeenCalledWith(48);
    });

    it('supports glissando (sliding between keys)', () => {
        const { container } = render(
            <VirtualKeyboard trackId="t1" config={mockConfig} onClose={() => {}} onNoteOn={mockOnNoteOn} onNoteOff={mockOnNoteOff} />
        );
        
        const key1 = container.querySelector('[data-note="48"]');
        const key2 = container.querySelector('[data-note="50"]'); // D3
        
        const wrapper = container.querySelector('.flex-1.flex')!;

        // 1. Down on 48
        document.elementFromPoint = vi.fn(() => key1);
        fireEvent.pointerDown(wrapper, { clientX: 10, clientY: 10, pointerId: 1, buttons: 1 });
        expect(mockOnNoteOn).toHaveBeenCalledWith(48, 100);

        // 2. Move to 50
        document.elementFromPoint = vi.fn(() => key2);
        fireEvent.pointerMove(wrapper, { clientX: 50, clientY: 10, pointerId: 1, buttons: 1 });
        
        expect(mockOnNoteOff).toHaveBeenCalledWith(48);
        expect(mockOnNoteOn).toHaveBeenCalledWith(50, 100);
    });
});
