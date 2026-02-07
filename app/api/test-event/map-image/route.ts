import { NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// Serve the map image from testtävling/äns
export async function GET() {
    try {
        const imagePath = join(process.cwd(), 'public', 'test-map.png');

        if (!existsSync(imagePath)) {
            return NextResponse.json({ error: 'Map image not found' }, { status: 404 });
        }

        const stats = statSync(imagePath);
        const imageBuffer = readFileSync(imagePath);

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': stats.size.toString(),
                'Cache-Control': 'public, max-age=3600',
            },
        });

    } catch (error) {
        console.error('Error serving map image:', error);
        return NextResponse.json({ error: 'Failed to serve map image' }, { status: 500 });
    }
}
