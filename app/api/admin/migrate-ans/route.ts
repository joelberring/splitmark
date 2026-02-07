import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseResultListServer, parseCourseDataServer } from '@/lib/import/server-parser';
import { saveEvent, EventCourse } from '@/lib/firestore/events';

export async function POST() {
    try {
        const testDir = join(process.cwd(), 'data', 'ans');

        if (!existsSync(testDir)) {
            console.error('Directory not found:', testDir);
            return NextResponse.json({ error: `Test data directory not found in ${testDir}` }, { status: 404 });
        }

        // 1. Parse Results
        const resultatPath = join(testDir, 'results.xml');
        if (!existsSync(resultatPath)) {
            return NextResponse.json({ error: `Result file not found at ${resultatPath}` }, { status: 404 });
        }
        const resultsXml = readFileSync(resultatPath, 'utf-8');
        const parsedResults = parseResultListServer(resultsXml);

        if (!parsedResults) {
            return NextResponse.json({ error: 'Failed to parse results' }, { status: 500 });
        }

        // 2. Parse Courses
        const coursePath = join(testDir, 'courses.xml');
        let parsedCourses: { courses: EventCourse[]; controls: any[] } = { courses: [], controls: [] };
        if (existsSync(coursePath)) {
            const coursesXml = readFileSync(coursePath, 'utf-8');
            const pc = parseCourseDataServer(coursesXml);
            if (pc) parsedCourses = pc;
        }

        // 3. World File (Calibration)
        const worldPath = join(testDir, 'worldfile.pgw');
        let worldFileContent = null;
        if (existsSync(worldPath)) {
            worldFileContent = readFileSync(worldPath, 'utf-8');
        }

        // 4. Construct Firestore Event
        const eventId = 'ans-2025';
        const eventData: any = {
            id: eventId,
            name: 'Älvsjö Night Sprint',
            date: '2025-12-02',
            time: '18:00',
            location: 'Älvsjö, Stockholm',
            type: 'individual',
            classification: 'club',
            status: 'completed',
            description: 'Nattsprint i Älvsjö. Komplett med resultat, banor och karta.',
            classes: parsedResults.classes,
            entries: parsedResults.entries,
            results: parsedResults.results,
            courses: parsedCourses.courses,
            // Include map calibration data
            worldFile: worldFileContent,
            mapImageUrl: '/test-map.jpg', // Public path
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // 5. Save to Firestore
        await saveEvent(eventData);

        return NextResponse.json({
            success: true,
            message: 'Migrated Älvsjö Night Sprint to Firestore',
            eventId
        });

    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: 'Migration failed: ' + (error as Error).message }, { status: 500 });
    }
}
