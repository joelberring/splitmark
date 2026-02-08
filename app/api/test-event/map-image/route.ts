import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { resolveMapImageMimeType, resolveTestCompetitionFiles } from '@/lib/test-event/files';

export async function GET() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const imagePath = resolved.files.mapImage;

        if (!imagePath) {
            return NextResponse.json({ error: 'Map image not found' }, { status: 404 });
        }

        const [stats, imageBuffer] = await Promise.all([
            stat(imagePath),
            readFile(imagePath),
        ]);

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': resolveMapImageMimeType(imagePath),
                'Content-Length': stats.size.toString(),
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Error serving map image:', error);
        return NextResponse.json({ error: 'Failed to serve map image' }, { status: 500 });
    }
}
