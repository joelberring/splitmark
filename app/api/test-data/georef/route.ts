import { NextResponse } from 'next/server';
import {
    readMapImageMetadata,
    readTextFileIfExists,
    resolveTestCompetitionFiles,
} from '@/lib/test-event/files';
import {
    getMapBoundsWgs84,
    parseWorldFile,
    pixelToSweref,
    sweref99tmToWgs84,
} from '@/lib/geo/worldfile';

export async function GET() {
    try {
        const resolved = await resolveTestCompetitionFiles();
        const imageMetadata = await readMapImageMetadata(resolved.files.mapImage);

        if (!imageMetadata) {
            return NextResponse.json({ error: 'Map image not found' }, { status: 404 });
        }

        const worldFileContent = await readTextFileIfExists(resolved.files.worldFile);
        if (!worldFileContent) {
            return NextResponse.json({
                georeferenced: false,
                manualCalibrationRequired: true,
                imageWidth: imageMetadata.width,
                imageHeight: imageMetadata.height,
                mapImageUrl: '/api/test-data/map',
            });
        }

        const worldFile = parseWorldFile(worldFileContent);
        const topLeftSweref = pixelToSweref(worldFile, 0, 0);
        const bottomRightSweref = pixelToSweref(worldFile, imageMetadata.width, imageMetadata.height);
        const topLeft = sweref99tmToWgs84(topLeftSweref.x, topLeftSweref.y);
        const bottomRight = sweref99tmToWgs84(bottomRightSweref.x, bottomRightSweref.y);
        const bounds = getMapBoundsWgs84(worldFile, imageMetadata.width, imageMetadata.height);

        return NextResponse.json({
            georeferenced: true,
            manualCalibrationRequired: false,
            worldFile,
            sweref99: {
                topLeft: topLeftSweref,
                bottomRight: bottomRightSweref,
            },
            wgs84: {
                topLeft,
                bottomRight,
            },
            bounds: {
                north: bounds.maxLat,
                south: bounds.minLat,
                west: bounds.minLng,
                east: bounds.maxLng,
            },
            imageWidth: imageMetadata.width,
            imageHeight: imageMetadata.height,
            mapImageUrl: '/api/test-data/map',
        });
    } catch (error) {
        console.error('Error reading georef file:', error);
        return NextResponse.json({ error: 'Failed to parse map georeferencing' }, { status: 500 });
    }
}
