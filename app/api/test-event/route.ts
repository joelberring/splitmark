import { NextResponse } from 'next/server';
import {
    extractEventMetadataFromResultXml,
    readTextFileIfExists,
    resolveTestCompetitionFiles,
} from '@/lib/test-event/files';

export async function GET() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const data = {
            resultat: await readTextFileIfExists(resolved.files.resultsXml),
            courseData: await readTextFileIfExists(resolved.files.courseDataXml),
            worldFile: await readTextFileIfExists(resolved.files.worldFile),
            meosData: await readTextFileIfExists(resolved.files.meosXml),
        };

        if (!data.resultat && !data.courseData && !data.worldFile && !data.meosData) {
            return NextResponse.json({ error: 'Test competition files not found' }, { status: 404 });
        }

        const eventMeta = data.resultat
            ? extractEventMetadataFromResultXml(data.resultat)
            : { eventName: 'Test competition', eventDate: new Date().toISOString().slice(0, 10) };

        return NextResponse.json({
            success: true,
            eventName: eventMeta.eventName,
            eventDate: eventMeta.eventDate,
            baseDirectory: resolved.baseDirectory,
            files: {
                hasResultat: !!data.resultat,
                hasCourseData: !!data.courseData,
                hasWorldFile: !!data.worldFile,
                hasMeosData: !!data.meosData,
                hasMapImage: !!resolved.files.mapImage,
            },
            data,
            mapImagePath: '/api/test-event/map-image',
        });
    } catch (error) {
        console.error('Error loading test event:', error);
        return NextResponse.json({ error: 'Failed to load test event' }, { status: 500 });
    }
}
