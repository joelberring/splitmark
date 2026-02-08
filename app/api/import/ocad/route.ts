import { NextRequest, NextResponse } from 'next/server';
import { parseCoursePlanningDataFromXml } from '@/lib/import/course-planning-parser';

const MAX_IMPORT_SIZE_BYTES = 15 * 1024 * 1024;

function isSupportedCourseFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.xml') || lower.endsWith('.ppen');
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({
                success: false,
                message: 'Ingen fil skickades med.',
            }, { status: 400 });
        }

        if (!isSupportedCourseFile(file.name)) {
            return NextResponse.json({
                success: false,
                message: 'Endast .xml eller .ppen stöds för import.',
            }, { status: 400 });
        }

        if (file.size > MAX_IMPORT_SIZE_BYTES) {
            return NextResponse.json({
                success: false,
                message: `Filen är för stor. Maxstorlek är ${Math.round(MAX_IMPORT_SIZE_BYTES / (1024 * 1024))} MB.`,
            }, { status: 413 });
        }

        const xmlText = await file.text();
        const parsed = parseCoursePlanningDataFromXml(xmlText);

        if (parsed.format === 'unknown') {
            return NextResponse.json({
                success: false,
                message: parsed.warnings[0] || 'Okänt banfilformat.',
                warnings: parsed.warnings,
            }, { status: 422 });
        }

        if (parsed.controls.length === 0 || parsed.courses.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'Kunde inte hitta både kontroller och banor i filen.',
                format: parsed.format,
                warnings: parsed.warnings,
                controls: parsed.controls,
                courses: parsed.courses,
            }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            format: parsed.format,
            controls: parsed.controls,
            courses: parsed.courses,
            warnings: parsed.warnings,
            summary: {
                controlCount: parsed.controls.length,
                courseCount: parsed.courses.length,
            },
        });
    } catch (error) {
        console.error('OCAD import failed:', error);
        return NextResponse.json({
            success: false,
            message: 'Kunde inte tolka filen.',
        }, { status: 500 });
    }
}
