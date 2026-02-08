import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    extractEventMetadataFromResultXml,
    readMapImageMetadata,
    resolveMapImageMimeType,
} from '@/lib/test-event/files';

const ONE_BY_ONE_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1kAAAAASUVORK5CYII=';

let tempDirectory: string | null = null;

afterEach(async () => {
    if (!tempDirectory) return;
    await rm(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
});

describe('test-event file helpers', () => {
    it('extracts event name and date from ResultList XML', () => {
        const xml = `
            <ResultList>
                <Event>
                    <Name>ANS Night Sprint</Name>
                    <StartTime>
                        <Date>2025-12-02</Date>
                    </StartTime>
                </Event>
            </ResultList>
        `;

        const metadata = extractEventMetadataFromResultXml(xml);

        expect(metadata.eventName).toBe('ANS Night Sprint');
        expect(metadata.eventDate).toBe('2025-12-02');
    });

    it('reads PNG metadata for map image dimensions', async () => {
        tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'splitmark-map-test-'));
        const mapPath = path.join(tempDirectory, 'map.png');
        await writeFile(mapPath, Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'));

        const metadata = await readMapImageMetadata(mapPath);

        expect(metadata).toEqual({
            width: 1,
            height: 1,
            mimeType: 'image/png',
        });
    });

    it('resolves mime types from map file path', () => {
        expect(resolveMapImageMimeType('/tmp/map.png')).toBe('image/png');
        expect(resolveMapImageMimeType('/tmp/map.jpg')).toBe('image/jpeg');
        expect(resolveMapImageMimeType('/tmp/map.webp')).toBe('image/webp');
        expect(resolveMapImageMimeType('/tmp/map.bin')).toBe('application/octet-stream');
    });
});
