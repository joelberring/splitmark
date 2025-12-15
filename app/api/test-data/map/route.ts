import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'testtävling', 'äns', 'karta_bildfil.png');
        const content = await readFile(filePath);

        return new NextResponse(content, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    } catch (error) {
        console.error('Error reading map file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
