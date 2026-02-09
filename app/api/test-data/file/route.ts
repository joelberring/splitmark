import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import {
    isLikelyTextFile,
    resolveFileMimeTypeFromPath,
    resolveTestDataFileById,
} from '@/lib/test-event/files';

export async function GET(request: NextRequest) {
    try {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ success: false, message: 'Not available' }, { status: 404 });
        }

        const id = request.nextUrl.searchParams.get('id') || '';
        const resolved = await resolveTestDataFileById(id);
        if (!resolved) {
            return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
        }

        const content = await readFile(resolved.filePath);
        const mimeType = resolveFileMimeTypeFromPath(resolved.filePath);

        // Serve text as UTF-8 so browsers render xml/ppen in tooling if opened.
        if (isLikelyTextFile(resolved.filePath)) {
            return new NextResponse(content.toString('utf-8'), {
                headers: {
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-store',
                },
            });
        }

        return new NextResponse(new Uint8Array(content), {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('Error reading test data file:', error);
        return NextResponse.json({ success: false, message: 'Could not read file' }, { status: 500 });
    }
}
