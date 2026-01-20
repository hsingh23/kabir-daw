
import { describe, it, expect, vi } from 'vitest';
import { TEMPLATES } from '../../services/templates';

describe('Project Templates', () => {
    it('defines an empty template', () => {
        const empty = TEMPLATES['Empty'];
        expect(empty).toBeDefined();
        expect(empty.tracks).toHaveLength(0);
    });

    it('defines a basic band template with tracks', () => {
        const band = TEMPLATES['Basic Band'];
        expect(band).toBeDefined();
        expect(band.tracks?.length).toBeGreaterThan(0);
        
        // Check for specific track names
        const names = band.tracks?.map(t => t.name);
        expect(names).toContain('Drums');
        expect(names).toContain('Vocals');
    });

    it('generates unique IDs for tracks', () => {
        const t1 = TEMPLATES['Electronic'].tracks?.[0];
        const t2 = TEMPLATES['Electronic'].tracks?.[1];
        
        expect(t1?.id).toBeDefined();
        expect(t2?.id).toBeDefined();
        expect(t1?.id).not.toBe(t2?.id);
    });

    it('has valid colors', () => {
        const tracks = TEMPLATES['Basic Band'].tracks || [];
        tracks.forEach(t => {
            expect(t.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });
});
