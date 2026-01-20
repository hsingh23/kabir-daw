
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VisualEQ from '../../components/VisualEQ';

describe('VisualEQ Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders canvas', () => {
        const { container } = render(
            <VisualEQ 
                low={0} mid={0} high={0}
                onChangeLow={() => {}} 
                onChangeMid={() => {}} 
                onChangeHigh={() => {}} 
            />
        );
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
        expect(canvas).toHaveClass('cursor-pointer');
    });

    it('interacts with nodes', () => {
        const onChangeLow = vi.fn();
        const { container } = render(
            <VisualEQ 
                low={0} mid={0} high={0}
                onChangeLow={onChangeLow} 
                onChangeMid={() => {}} 
                onChangeHigh={() => {}} 
            />
        );
        
        const canvas = container.querySelector('canvas')!;
        
        // Mock getBoundingClientRect
        canvas.getBoundingClientRect = vi.fn(() => ({
            top: 0, left: 0, width: 300, height: 100,
            right: 300, bottom: 100, x: 0, y: 0, toJSON: () => {}
        }));

        // Low node is at 320Hz.
        // Freq range 20Hz-20kHz (log).
        // minLog = 1.3, maxLog = 4.3. Range = 3.
        // 320Hz log = ~2.5.
        // x = ((2.5 - 1.3) / 3) * 300 = 120px approx.
        // Let's click around x=120
        
        // Use a more generic hit logic in test or calculate properly:
        // log10(320) = 2.505
        // log10(20) = 1.301
        // log10(20000) = 4.301
        // range = 3.0
        // normX = (2.505 - 1.301) / 3.0 = 0.401
        // x = 0.401 * 300 = 120.3px
        
        fireEvent.pointerDown(canvas, { clientX: 120, clientY: 50, pointerId: 1 });
        
        // Drag up (decrease Y value -> increase dB)
        fireEvent.pointerMove(canvas, { clientX: 120, clientY: 20, pointerId: 1 });
        
        expect(onChangeLow).toHaveBeenCalled();
        const callArg = onChangeLow.mock.calls[0][0];
        // Y=20 is near top. Max dB is 15.
        // Height=100. Y=20 => norm = 1 - 0.2 = 0.8
        // dB = -15 + (0.8 * 30) = -15 + 24 = 9dB
        expect(callArg).toBeGreaterThan(0);
    });
});
