import { NextResponse } from 'next/server';
import { listTestDataFileCandidates } from '@/lib/test-event/files';

export async function GET() {
    try {
        const files = await listTestDataFileCandidates(4);
        return NextResponse.json({
            success: true,
            files: files.map((file) => ({
                id: file.id,
                name: file.name,
                relativePath: file.relativePath,
                extension: file.extension,
                kind: file.kind,
                sizeBytes: file.sizeBytes,
                url: `/api/test-data/file?id=${encodeURIComponent(file.id)}`,
            })),
        });
    } catch (error) {
        console.error('Error listing test data files:', error);
        return NextResponse.json({ success: false, message: 'Could not list test data files.' }, { status: 500 });
    }
}
