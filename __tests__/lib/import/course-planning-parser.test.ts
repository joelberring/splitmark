import { describe, expect, it } from '@jest/globals';
import { parseCoursePlanningDataFromXml } from '@/lib/import/course-planning-parser';
import {
    readTextFileIfExists,
    resolveTestCompetitionFiles,
} from '@/lib/test-event/files';

async function loadFixtureXml() {
    const resolved = await resolveTestCompetitionFiles();
    const courseDataXml = await readTextFileIfExists(resolved.files.courseDataXml);
    const purplePenXml = await readTextFileIfExists(resolved.files.purplePen);

    if (!courseDataXml) {
        throw new Error('CourseData XML fixture saknas i testtävling-mappen.');
    }
    if (!purplePenXml) {
        throw new Error('Purple Pen fixture saknas i testtävling-mappen.');
    }

    return {
        courseDataXml,
        purplePenXml,
    };
}

describe('course planning parser', () => {
    it('parses IOF CourseData with course families and relative map coordinates', async () => {
        const { courseDataXml } = await loadFixtureXml();
        const parsed = parseCoursePlanningDataFromXml(courseDataXml);

        expect(parsed.format).toBe('iof-coursedata');
        expect(parsed.controls.length).toBeGreaterThan(20);
        expect(parsed.courses.length).toBeGreaterThanOrEqual(9);

        const mellanCourses = parsed.courses.filter((course) => course.name.startsWith('Mellan'));
        expect(mellanCourses).toHaveLength(4);
        expect(mellanCourses.map((course) => course.forkLabel).sort()).toEqual(['AC', 'AD', 'BC', 'BD']);

        const sampleControl = parsed.controls.find((control) => control.id === '31');
        expect(sampleControl).toBeDefined();
        expect(sampleControl?.relX).toBeGreaterThan(0);
        expect(sampleControl?.relX).toBeLessThan(1);
        expect(sampleControl?.relY).toBeGreaterThan(0);
        expect(sampleControl?.relY).toBeLessThan(1);
    });

    it('expands Purple Pen forks into unique variants', async () => {
        const { purplePenXml } = await loadFixtureXml();
        const parsed = parseCoursePlanningDataFromXml(purplePenXml);

        expect(parsed.format).toBe('purplepen');
        expect(parsed.controls.length).toBeGreaterThan(20);

        const mellanVariants = parsed.courses.filter((course) => course.name.startsWith('Mellan '));
        const longaVariants = parsed.courses.filter((course) => course.name.startsWith('Långa '));

        expect(mellanVariants).toHaveLength(4);
        expect(longaVariants).toHaveLength(4);

        expect(new Set(mellanVariants.map((course) => course.controlIds.join('>'))).size).toBe(4);
        expect(new Set(longaVariants.map((course) => course.controlIds.join('>'))).size).toBe(4);

        parsed.courses.forEach((course) => {
            expect(course.controlIds.length).toBeGreaterThan(0);
        });
    });
});
