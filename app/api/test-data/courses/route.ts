import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'data', 'ans', 'courses.xml');
        const content = await readFile(filePath, 'utf-8');

        return new NextResponse(content, {
            headers: {
                'Content-Type': 'application/xml',
            },
        });
    } catch (error) {
        console.error('Error reading courses file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
