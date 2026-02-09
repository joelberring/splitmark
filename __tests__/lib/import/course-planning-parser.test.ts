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
        // Fixture sizes vary; we mainly care that we get a non-trivial control set + fork expansion.
        expect(parsed.controls.length).toBeGreaterThanOrEqual(10);
        expect(parsed.courses.length).toBeGreaterThan(0);

        // Variants are encoded as `${courseId}-${index}` by the parser when Purple Pen forks expand.
        const variantGroups = new Map<string, Array<{ id: string; controlIds: string[] }>>();
        parsed.courses.forEach((course) => {
            const match = course.id.match(/^(.*)-([0-9]+)$/);
            if (!match) return;
            const baseId = match[1];
            const group = variantGroups.get(baseId) || [];
            group.push({ id: course.id, controlIds: course.controlIds });
            variantGroups.set(baseId, group);
        });

        const expandedGroup = Array.from(variantGroups.values()).find((group) => group.length >= 2);
        expect(expandedGroup).toBeDefined();

        if (expandedGroup) {
            expect(new Set(expandedGroup.map((course) => course.controlIds.join('>'))).size).toBe(expandedGroup.length);
        }

        parsed.courses.forEach((course) => {
            expect(course.controlIds.length).toBeGreaterThan(0);
        });
    });
});
