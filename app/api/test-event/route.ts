import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load the test competition data from testtävling/äns
export async function GET() {
    try {
        const testDir = join(process.cwd(), 'testtävling', 'äns');

        // Check if directory exists
        if (!existsSync(testDir)) {
            return NextResponse.json({ error: 'Testtävling directory not found' }, { status: 404 });
        }

        // Load files
        const files: Record<string, string | null> = {
            resultat: null,
            courseData: null,
            worldFile: null,
            meosData: null,
        };

        // Result XML
        const resultatPath = join(testDir, 'resultat äns ver2.xml');
        if (existsSync(resultatPath)) {
            files.resultat = readFileSync(resultatPath, 'utf-8');
        }

        // Course data (IOF XML from Purple Pen)
        const coursePath = join(testDir, 'ÄNS 20251202.xml');
        if (existsSync(coursePath)) {
            files.courseData = readFileSync(coursePath, 'utf-8');
        }

        // World file
        const worldPath = join(testDir, 'karta_hela.pgw');
        if (existsSync(worldPath)) {
            files.worldFile = readFileSync(worldPath, 'utf-8');
        }

        // MeOS data
        const meosPath = join(testDir, 'Kklar inför tävling.meosxml');
        if (existsSync(meosPath)) {
            files.meosData = readFileSync(meosPath, 'utf-8');
        }

        // Map image URL (public path)
        const mapImagePath = '/api/test-event/map-image';

        return NextResponse.json({
            success: true,
            eventName: 'Älvsjö Night Sprint',
            eventDate: '2025-12-02',
            files: {
                hasResultat: !!files.resultat,
                hasCourseData: !!files.courseData,
                hasWorldFile: !!files.worldFile,
                hasMeosData: !!files.meosData,
            },
            data: files,
            mapImagePath,
        });

    } catch (error) {
        console.error('Error loading test event:', error);
        return NextResponse.json({ error: 'Failed to load test event' }, { status: 500 });
    }
}
