import { describe, expect, it } from '@jest/globals';
import {
    getControlCoverageRect,
    remapControlsForCrop,
    remapRelativePointForCrop,
} from '@/lib/maps/image-processing';

describe('map image processing helpers', () => {
    it('calculates a crop rect that covers all controls with margin', () => {
        const rect = getControlCoverageRect([
            { relX: 0.2, relY: 0.3 },
            { relX: 0.8, relY: 0.7 },
        ], 0.1);

        expect(rect).not.toBeNull();
        expect(rect!.left).toBeCloseTo(0.1, 4);
        expect(rect!.top).toBeCloseTo(0.2, 4);
        expect(rect!.right).toBeCloseTo(0.9, 4);
        expect(rect!.bottom).toBeCloseTo(0.8, 4);
    });

    it('returns null when controls have no usable relative coordinates', () => {
        const rect = getControlCoverageRect([
            { relX: undefined, relY: 0.4 },
            { relX: 0.4, relY: undefined },
        ]);

        expect(rect).toBeNull();
    });

    it('remaps relative coordinates when map is cropped', () => {
        const cropRect = { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 };
        const remapped = remapRelativePointForCrop({ relX: 0.5, relY: 0.5 }, cropRect);

        expect(remapped.relX).toBeCloseTo(0.5, 4);
        expect(remapped.relY).toBeCloseTo(0.5, 4);
    });

    it('remaps all controls for a cropped map', () => {
        const cropRect = { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 };
        const controls = [
            { id: '31', relX: 0.1, relY: 0.1 },
            { id: '32', relX: 0.5, relY: 0.5 },
            { id: '33', relX: 0.9, relY: 0.9 },
        ];

        const remapped = remapControlsForCrop(controls, cropRect);

        expect(remapped[0].relX).toBeCloseTo(0, 4);
        expect(remapped[0].relY).toBeCloseTo(0, 4);
        expect(remapped[1].relX).toBeCloseTo(0.5, 4);
        expect(remapped[1].relY).toBeCloseTo(0.5, 4);
        expect(remapped[2].relX).toBeCloseTo(1, 4);
        expect(remapped[2].relY).toBeCloseTo(1, 4);
    });
});
