import { describe, expect, it } from '@jest/globals';
import {
    buildVirtualControls,
    deriveLatLngFromControl,
    estimateCourseLengthMeters,
    getCourseControls,
    normalizePlanningControls,
    normalizePlanningCourses,
} from '@/lib/events/course-planning';

describe('course planning helpers', () => {
    it('normalizes planning courses with defaults', () => {
        const courses = normalizePlanningCourses([
            {
                id: 'course-1',
                name: 'Medel',
                controlIds: ['a', 'b', 'c'],
            },
        ]);

        expect(courses).toHaveLength(1);
        expect(courses[0].gpsMode.enabled).toBe(true);
        expect(courses[0].gpsMode.sensitivity).toBe('standard');
        expect(courses[0].mobileOptions.allowMobileMap).toBe(true);
        expect(courses[0].mobileOptions.hideRunnerDot).toBe(true);
    });

    it('derives lat/lng from calibration when control has relative coordinates', () => {
        const derived = deriveLatLngFromControl(
            {
                id: '31',
                code: '31',
                type: 'control',
                relX: 0.5,
                relY: 0.25,
            },
            {
                calibration: {
                    a: 0.00001,
                    b: 0,
                    c: 18,
                    d: 0,
                    e: -0.00001,
                    f: 59.5,
                },
                imageWidth: 1000,
                imageHeight: 800,
            }
        );

        expect(derived).not.toBeNull();
        expect(derived!.lng).toBeCloseTo(18.005, 6);
        expect(derived!.lat).toBeCloseTo(59.498, 6);
    });

    it('builds virtual controls and tracks missing GPS coordinates', () => {
        const controls = normalizePlanningControls([
            { id: 's', code: 'S', type: 'start', lat: 59.31, lng: 18.01 },
            { id: '31', code: '31', type: 'control', lat: 59.312, lng: 18.013, gpsRadius: 28 },
            { id: '32', code: '32', type: 'control' },
            { id: 'm', code: 'M', type: 'finish', lat: 59.314, lng: 18.015 },
        ]);

        const [course] = normalizePlanningCourses([
            {
                id: 'course-a',
                name: 'A',
                controlIds: ['s', '31', '32', 'm'],
                gpsMode: { enabled: true, sensitivity: 'custom', customRadius: 40 },
            },
        ]);

        const result = buildVirtualControls(course, controls);

        expect(result.controls).toHaveLength(3);
        expect(result.controls.find((control) => control.id === '31')?.radius).toBe(28);
        expect(result.controls.find((control) => control.id === 'm')?.radius).toBe(40);
        expect(result.missingControlCodes).toEqual(['32']);
    });

    it('estimates course length from gps coordinates', () => {
        const controls = normalizePlanningControls([
            { id: 's', code: 'S', type: 'start', lat: 59.31, lng: 18.01 },
            { id: '31', code: '31', type: 'control', lat: 59.312, lng: 18.013 },
            { id: 'm', code: 'M', type: 'finish', lat: 59.314, lng: 18.015 },
        ]);

        const [course] = normalizePlanningCourses([
            { id: 'course-a', name: 'A', controlIds: ['s', '31', 'm'] },
        ]);
        const courseControls = getCourseControls(course, controls);
        const estimate = estimateCourseLengthMeters(courseControls);

        expect(estimate).not.toBeNull();
        expect(estimate!).toBeGreaterThan(450);
        expect(estimate!).toBeLessThan(900);
    });
});
