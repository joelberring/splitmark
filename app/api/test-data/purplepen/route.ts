import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'testtävling', 'äns', 'ÄNS 20251202.ppen');
        const content = await readFile(filePath, 'utf-8');

        return new NextResponse(content, {
            headers: {
                'Content-Type': 'application/xml',
            },
        });
    } catch (error) {
        console.error('Error reading Purple Pen file:', error);
        return NextResponse.json({ error: 'Purple Pen file not found' }, { status: 404 });
    }
}
