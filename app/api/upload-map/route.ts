import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { sanitizeFilename } from '@/lib/import/filename-utils';

const MAX_UPLOAD_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB

export async function POST(request: NextRequest) {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const raceId = data.get('raceId');

    if (!file) {
        return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    if (!raceId || typeof raceId !== 'string') {
        return NextResponse.json({ success: false, message: 'Missing raceId' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ success: false, message: 'Only image files are supported' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        return NextResponse.json({
            success: false,
            message: 'File is too large. Compress or crop the map before upload.',
        }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads/maps');
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename
    const safeFilename = sanitizeFilename(file.name);
    const filename = `${sanitizeFilename(raceId)}-${Date.now()}-${safeFilename}`;
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
