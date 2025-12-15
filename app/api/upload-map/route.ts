import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const raceId = data.get('raceId');

    if (!file) {
        return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads/maps');
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename
    const filename = `${raceId}-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const filepath = path.join(uploadDir, filename);

    try {
        await writeFile(filepath, buffer);
        console.log(`Saved file to ${filepath}`);

        // Return URL relative to public
        const url = `/uploads/maps/${filename}`;

        return NextResponse.json({ success: true, url });
    } catch (e) {
        console.error('Error saving file:', e);
        return NextResponse.json({ success: false, message: 'Failed to save file' }, { status: 500 });
    }
}
