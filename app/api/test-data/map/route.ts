import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolveMapImageMimeType, resolveTestCompetitionFiles } from '@/lib/test-event/files';

export async function GET() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const filePath = resolved.files.mapImage;
        if (!filePath) {
            return NextResponse.json({ error: 'Map file not found' }, { status: 404 });
        }

        const content = await readFile(filePath);

        return new NextResponse(new Uint8Array(content), {
            headers: {
                'Content-Type': resolveMapImageMimeType(filePath),
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    } catch (error) {
        console.error('Error reading map file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
