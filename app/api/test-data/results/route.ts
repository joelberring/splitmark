import { NextResponse } from 'next/server';
import { resolveTestCompetitionFiles, readTextFileIfExists } from '@/lib/test-event/files';

export async function GET() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const content = await readTextFileIfExists(resolved.files.resultsXml);

        if (!content) {
            return NextResponse.json({ error: 'Results file not found' }, { status: 404 });
        }

        return new NextResponse(content, {
            headers: {
                'Content-Type': 'application/xml',
            },
        });
    } catch (error) {
        console.error('Error reading results file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
