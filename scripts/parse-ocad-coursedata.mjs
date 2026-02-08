#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
});

function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

function readText(value) {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        if (typeof value['#text'] === 'string') return value['#text'];
        if (typeof value._text === 'string') return value._text;
    }
    return undefined;
}

function toNumber(value) {
    const text = readText(value);
    if (text === undefined) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function normalizeForkLabel(raw) {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const direct = trimmed.match(/([A-Z]{1,4})$/);
    if (direct) return direct[1];

    const numeric = trimmed.match(/([0-9]{1,2})$/);
    if (numeric) return numeric[1];

    return undefined;
}

function deriveForkLabelFromFamily(name, family) {
    const direct = normalizeForkLabel(name);
    if (direct) return direct;

    if (name.startsWith(family)) {
        return normalizeForkLabel(name.slice(family.length));
    }

    return undefined;
}

function parseCourseData(xmlText) {
    const parsed = xmlParser.parse(xmlText);
    const courseData = parsed?.CourseData;
    if (!courseData) {
        throw new Error('XML innehåller inte CourseData.');
    }

    const raceCourseDataItems = toArray(courseData.RaceCourseData);
    if (raceCourseDataItems.length === 0) {
        throw new Error('CourseData saknar RaceCourseData.');
    }

    let minX;
    let maxX;
    let minY;
    let maxY;

    const controls = [];
    const courses = [];

    for (const raceData of raceCourseDataItems) {
        if (!raceData || typeof raceData !== 'object') continue;

        const map = raceData.Map;
        const topLeft = map?.MapPositionTopLeft;
        const bottomRight = map?.MapPositionBottomRight;
        const topLeftX = toNumber(topLeft?.['@_x']);
        const topLeftY = toNumber(topLeft?.['@_y']);
        const bottomRightX = toNumber(bottomRight?.['@_x']);
        const bottomRightY = toNumber(bottomRight?.['@_y']);

        if (topLeftX !== undefined && bottomRightX !== undefined) {
            minX = Math.min(topLeftX, bottomRightX);
            maxX = Math.max(topLeftX, bottomRightX);
        }
        if (topLeftY !== undefined && bottomRightY !== undefined) {
            minY = Math.min(topLeftY, bottomRightY);
            maxY = Math.max(topLeftY, bottomRightY);
        }

        for (const controlNode of toArray(raceData.Control)) {
            if (!controlNode || typeof controlNode !== 'object') continue;

            const id = readText(controlNode.Id) || `ctrl-${controls.length + 1}`;
            const mapPosition = controlNode.MapPosition;
            const mapX = toNumber(mapPosition?.['@_x']);
            const mapY = toNumber(mapPosition?.['@_y']);

            if (mapX !== undefined) {
                minX = minX === undefined ? mapX : Math.min(minX, mapX);
                maxX = maxX === undefined ? mapX : Math.max(maxX, mapX);
            }
            if (mapY !== undefined) {
                minY = minY === undefined ? mapY : Math.min(minY, mapY);
                maxY = maxY === undefined ? mapY : Math.max(maxY, mapY);
            }

            const typeRaw = (readText(controlNode['@_type']) || 'Control').toLowerCase();
            const type = typeRaw === 'start' ? 'start' : typeRaw === 'finish' ? 'finish' : 'control';

            controls.push({
                id,
                code: readText(controlNode.Code) || id,
                type,
                lat: toNumber(controlNode.Position?.['@_lat']),
                lng: toNumber(controlNode.Position?.['@_lng']),
                mapX,
                mapY,
            });
        }

        for (const courseNode of toArray(raceData.Course)) {
            if (!courseNode || typeof courseNode !== 'object') continue;

            const name = readText(courseNode.Name) || `Course ${courses.length + 1}`;
            const family = readText(courseNode.CourseFamily)?.trim();

            const controlIds = toArray(courseNode.CourseControl)
                .map((courseControl) => readText(courseControl?.Control) || readText(courseControl?.ControlCode))
                .filter(Boolean);

            courses.push({
                id: readText(courseNode.Id) || `course-${courses.length + 1}`,
                name,
                baseName: family || name,
                forkLabel: family ? deriveForkLabelFromFamily(name, family) : normalizeForkLabel(name),
                lengthMeters: toNumber(courseNode.Length),
                climbMeters: toNumber(courseNode.Climb),
                controlIds,
            });
        }
    }

    const xSpan = minX !== undefined && maxX !== undefined ? maxX - minX : undefined;
    const ySpan = minY !== undefined && maxY !== undefined ? maxY - minY : undefined;
    const hasMapBounds = xSpan !== undefined && ySpan !== undefined && xSpan > 0 && ySpan > 0;

    const normalizedControls = controls.map((control) => ({
        id: control.id,
        code: control.code,
        type: control.type,
        lat: control.lat,
        lng: control.lng,
        relX: hasMapBounds && control.mapX !== undefined
            ? clamp01((control.mapX - minX) / xSpan)
            : undefined,
        relY: hasMapBounds && control.mapY !== undefined
            ? clamp01(1 - ((control.mapY - minY) / ySpan))
            : undefined,
    }));

    const controlIdSet = new Set(normalizedControls.map((control) => control.id));
    const normalizedCourses = courses.map((course) => ({
        id: course.id,
        name: course.name,
        baseName: course.baseName,
        forkLabel: course.forkLabel,
        lengthMeters: course.lengthMeters,
        climbMeters: course.climbMeters,
        controlIds: course.controlIds.filter((controlId) => controlIdSet.has(controlId)),
    }));

    return {
        format: 'iof-coursedata',
        controlCount: normalizedControls.length,
        courseCount: normalizedCourses.length,
        controls: normalizedControls,
        courses: normalizedCourses,
    };
}

function parseArgs(argv) {
    const args = [...argv];
    const input = args[0];
    if (!input) {
        throw new Error('Usage: node scripts/parse-ocad-coursedata.mjs <input.xml> [--out output.json]');
    }

    let outFile;
    const outIndex = args.indexOf('--out');
    if (outIndex >= 0 && args[outIndex + 1]) {
        outFile = args[outIndex + 1];
    }

    return { input, outFile };
}

async function main() {
    const { input, outFile } = parseArgs(process.argv.slice(2));
    const absoluteInput = path.resolve(process.cwd(), input);
    const xmlText = await readFile(absoluteInput, 'utf-8');
    const parsed = parseCourseData(xmlText);

    const output = JSON.stringify(parsed, null, 2);

    if (outFile) {
        const absoluteOutput = path.resolve(process.cwd(), outFile);
        await writeFile(absoluteOutput, output, 'utf-8');
        console.log(`Wrote ${parsed.courseCount} courses / ${parsed.controlCount} controls to ${absoluteOutput}`);
        return;
    }

    console.log(output);
}

main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
});
