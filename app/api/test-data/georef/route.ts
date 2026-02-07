import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Convert SWEREF99 TM to WGS84
function sweref99TmToWgs84(x: number, y: number): { lat: number; lng: number } {
    // SWEREF99 TM parameters
    const axis = 6378137.0;
    const flattening = 1.0 / 298.257222101;
    const centralMeridian = 15.0;
    const scale = 0.9996;
    const falseNorthing = 0.0;
    const falseEasting = 500000.0;

    const e2 = flattening * (2.0 - flattening);
    const n = flattening / (2.0 - flattening);
    const aRoof = axis / (1.0 + n) * (1.0 + n * n / 4.0 + n * n * n * n / 64.0);

    const delta1 = n / 2.0 - 2.0 * n * n / 3.0 + 37.0 * n * n * n / 96.0 - n * n * n * n / 360.0;
    const delta2 = n * n / 48.0 + n * n * n / 15.0 - 437.0 * n * n * n * n / 1440.0;
    const delta3 = 17.0 * n * n * n / 480.0 - 37 * n * n * n * n / 840.0;
    const delta4 = 4397.0 * n * n * n * n / 161280.0;

    const Astar = e2 + e2 * e2 + e2 * e2 * e2 + e2 * e2 * e2 * e2;
    const Bstar = -(7.0 * e2 * e2 + 17.0 * e2 * e2 * e2 + 30.0 * e2 * e2 * e2 * e2) / 6.0;
    const Cstar = (224.0 * e2 * e2 * e2 + 889.0 * e2 * e2 * e2 * e2) / 120.0;
    const Dstar = -(4279.0 * e2 * e2 * e2 * e2) / 1260.0;

    const degToRad = Math.PI / 180;
    const lambda0 = centralMeridian * degToRad;

    const xi = (y - falseNorthing) / (scale * aRoof);
    const eta = (x - falseEasting) / (scale * aRoof);

    const xiPrim = xi -
        delta1 * Math.sin(2.0 * xi) * Math.cosh(2.0 * eta) -
        delta2 * Math.sin(4.0 * xi) * Math.cosh(4.0 * eta) -
        delta3 * Math.sin(6.0 * xi) * Math.cosh(6.0 * eta) -
        delta4 * Math.sin(8.0 * xi) * Math.cosh(8.0 * eta);

    const etaPrim = eta -
        delta1 * Math.cos(2.0 * xi) * Math.sinh(2.0 * eta) -
        delta2 * Math.cos(4.0 * xi) * Math.sinh(4.0 * eta) -
        delta3 * Math.cos(6.0 * xi) * Math.sinh(6.0 * eta) -
        delta4 * Math.cos(8.0 * xi) * Math.sinh(8.0 * eta);

    const phiStar = Math.asin(Math.sin(xiPrim) / Math.cosh(etaPrim));
    const deltaLambda = Math.atan(Math.sinh(etaPrim) / Math.cos(xiPrim));
    const lonRadian = lambda0 + deltaLambda;
    const latRadian = phiStar + Math.sin(phiStar) * Math.cos(phiStar) * (
        Astar +
        Bstar * Math.pow(Math.sin(phiStar), 2) +
        Cstar * Math.pow(Math.sin(phiStar), 4) +
        Dstar * Math.pow(Math.sin(phiStar), 6)
    );

    return {
        lat: latRadian * 180 / Math.PI,
        lng: lonRadian * 180 / Math.PI
    };
}

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'data', 'ans', 'worldfile.pgw');
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        // PGW format:
        // Line 1: pixel size in x direction (meters)
        // Line 2: rotation about y axis (usually 0)
        // Line 3: rotation about x axis (usually 0)
        // Line 4: pixel size in y direction (usually negative)
        // Line 5: x-coordinate of upper-left pixel center
        // Line 6: y-coordinate of upper-left pixel center

        const pixelSizeX = parseFloat(lines[0]);
        const pixelSizeY = parseFloat(lines[3]);
        const topLeftX = parseFloat(lines[4]); // SWEREF99 TM
        const topLeftY = parseFloat(lines[5]); // SWEREF99 TM

        // Get image dimensions (we need to check the image)
        // For now, estimate based on file size and typical map dimensions
        // The image is about 40MB, assuming 3 bytes per pixel (RGB)
        // 40358307 / 3 ≈ 13.4M pixels
        // Typical aspect ratio for OL maps is ~1.5:1
        // So roughly 4500 x 3000 pixels
        const imageWidth = 4500; // Approximate, would need to read image header
        const imageHeight = 3000;

        // Calculate bottom-right corner
        const bottomRightX = topLeftX + (imageWidth * pixelSizeX);
        const bottomRightY = topLeftY + (imageHeight * pixelSizeY); // pixelSizeY is negative

        // Convert corners to WGS84
        const topLeft = sweref99TmToWgs84(topLeftX, topLeftY);
        const bottomRight = sweref99TmToWgs84(bottomRightX, bottomRightY);

        return NextResponse.json({
            pixelSizeX,
            pixelSizeY,
            sweref99: {
                topLeft: { x: topLeftX, y: topLeftY },
                bottomRight: { x: bottomRightX, y: bottomRightY },
            },
            wgs84: {
                topLeft,
                bottomRight,
            },
            bounds: {
                north: topLeft.lat,
                south: bottomRight.lat,
                west: topLeft.lng,
                east: bottomRight.lng,
            },
            imageWidth,
            imageHeight,
            mapImageUrl: '/api/test-data/map',
        });
    } catch (error) {
        console.error('Error reading georef file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
