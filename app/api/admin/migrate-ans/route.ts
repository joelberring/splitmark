import { NextResponse } from 'next/server';
import { parseResultListServer, parseCourseDataServer } from '@/lib/import/server-parser';
import { saveEvent, EventCourse } from '@/lib/firestore/events';
import {
    extractEventMetadataFromResultXml,
    readTextFileIfExists,
    resolveTestCompetitionFiles,
} from '@/lib/test-event/files';

export async function POST() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const resultsXml = await readTextFileIfExists(resolved.files.resultsXml);

        if (!resultsXml) {
            return NextResponse.json({ error: 'Result file not found in test competition data' }, { status: 404 });
        }

        const parsedResults = parseResultListServer(resultsXml);
        if (!parsedResults) {
            return NextResponse.json({ error: 'Failed to parse results' }, { status: 500 });
        }

        const eventMeta = extractEventMetadataFromResultXml(resultsXml);

        let parsedCourses: { courses: EventCourse[]; controls: any[] } = { courses: [], controls: [] };
        const courseXml = await readTextFileIfExists(resolved.files.courseDataXml);
        if (courseXml) {
            const parsed = parseCourseDataServer(courseXml);
            if (parsed) parsedCourses = parsed;
        }

        const worldFileContent = await readTextFileIfExists(resolved.files.worldFile);
        const eventId = `test-${eventMeta.eventDate.replace(/[^0-9]/g, '') || Date.now()}`;

        const eventData: any = {
            id: eventId,
            name: eventMeta.eventName,
            date: eventMeta.eventDate,
            time: '18:00',
            location: 'Imported test competition',
            type: 'individual',
            classification: 'club',
            status: 'completed',
            description: 'Imported from local test competition files.',
            classes: parsedResults.classes,
            entries: parsedResults.entries,
            results: parsedResults.results,
            courses: parsedCourses.courses,
            worldFile: worldFileContent,
            mapImageUrl: '/api/test-event/map-image',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await saveEvent(eventData);

        return NextResponse.json({
            success: true,
            message: `Migrated ${eventMeta.eventName} to Firestore`,
            eventId,
            sourceDirectory: resolved.baseDirectory,
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: `Migration failed: ${(error as Error).message}` }, { status: 500 });
    }
}
