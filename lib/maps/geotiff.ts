/**
 * GeoTIFF Parser
 * Parse GeoTIFF files and extract georeferencing information
 */

import type {
    ImportedMap,
    MapGeoreferencing,
    GeoPoint,
} from '@/types/maps';

interface GeoTIFFMetadata {
    width: number;
    height: number;
    origin: [number, number]; // [x, y] in CRS units
    resolution: [number, number]; // [x, y] pixel size
    crs: string;
    bounds: {
        west: number;
        south: number;
        east: number;
        north: number;
    };
}

/**
 * Parse GeoTIFF file without external library
 * Uses TIFF tag parsing for basic georeferencing
 */
export async function parseGeoTIFF(file: File): Promise<ImportedMap> {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Check TIFF magic number
    const byteOrder = view.getUint16(0);
    const isLittleEndian = byteOrder === 0x4949; // 'II'
    const get16 = (offset: number) => view.getUint16(offset, isLittleEndian);
    const get32 = (offset: number) => view.getUint32(offset, isLittleEndian);
    const getFloat64 = (offset: number) => view.getFloat64(offset, isLittleEndian);

    const magic = get16(2);
    if (magic !== 42 && magic !== 43) {
        throw new Error('Not a valid TIFF file');
    }

    // Find GeoTIFF tags
    const ifdOffset = get32(4);
    const numEntries = get16(ifdOffset);

    let width = 0;
    let height = 0;
    let modelPixelScale: number[] = [];
    let modelTiepoint: number[] = [];
    let geoKeyDirectory: number[] = [];

    for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = get16(entryOffset);
        const type = get16(entryOffset + 2);
        const count = get32(entryOffset + 4);
        const valueOffset = entryOffset + 8;

        switch (tag) {
            case 256: // ImageWidth
                width = type === 3 ? get16(valueOffset) : get32(valueOffset);
                break;
            case 257: // ImageHeight
                height = type === 3 ? get16(valueOffset) : get32(valueOffset);
                break;
            case 33550: // ModelPixelScaleTag
                const scaleOffset = get32(valueOffset);
                modelPixelScale = [
                    getFloat64(scaleOffset),
                    getFloat64(scaleOffset + 8),
                    getFloat64(scaleOffset + 16),
                ];
                break;
            case 33922: // ModelTiepointTag
                const tiepointOffset = get32(valueOffset);
                modelTiepoint = [];
                for (let j = 0; j < count; j++) {
                    modelTiepoint.push(getFloat64(tiepointOffset + j * 8));
                }
                break;
            case 34735: // GeoKeyDirectoryTag
                const geoKeyOffset = get32(valueOffset);
                geoKeyDirectory = [];
                for (let j = 0; j < count; j++) {
                    geoKeyDirectory.push(get16(geoKeyOffset + j * 2));
                }
                break;
        }
    }

    // Extract georeferencing
    let crs = 'EPSG:3006'; // Default to SWEREF99 TM

    // Check GeoKey for CRS
    if (geoKeyDirectory.length >= 4) {
        const numKeys = geoKeyDirectory[3];
        for (let i = 0; i < numKeys; i++) {
            const keyOffset = 4 + i * 4;
            const keyId = geoKeyDirectory[keyOffset];
            const keyValue = geoKeyDirectory[keyOffset + 3];

            if (keyId === 3072) { // ProjectedCSTypeGeoKey
                crs = `EPSG:${keyValue}`;
            }
        }
    }

    // Calculate bounds
    let bounds = { west: 0, south: 0, east: 0, north: 0 };

    if (modelTiepoint.length >= 6 && modelPixelScale.length >= 2) {
        // Tiepoint format: [i, j, k, x, y, z]
        const tieX = modelTiepoint[3];
        const tieY = modelTiepoint[4];
        const pixelX = modelPixelScale[0];
        const pixelY = modelPixelScale[1];

        bounds = {
            west: tieX,
            north: tieY,
            east: tieX + width * pixelX,
            south: tieY - height * pixelY,
        };
    }

    const georeferencing: MapGeoreferencing = {
        crs,
        scale: 10000, // Default, will be refined
        bounds: {
            topLeft: { lat: bounds.north, lng: bounds.west },
            bottomRight: { lat: bounds.south, lng: bounds.east },
        },
    };

    // Estimate scale from pixel resolution
    if (modelPixelScale.length >= 2) {
        // Pixels per meter to map scale
        const metersPerPixel = modelPixelScale[0];
        // Assuming printed at 300 DPI, 1 pixel = 0.0846mm
        const printedPixelSize = 0.0846; // mm
        georeferencing.scale = Math.round(metersPerPixel * 1000 / printedPixelSize);
    }

    return {
        name: file.name,
        source: 'GeoTIFF',
        scale: georeferencing.scale,
        georeferencing,
        rawData: buffer,
    };
}

/**
 * Parse world file (.tfw, .jgw, .pgw) for plain images
 */
export async function parseWorldFile(
    imageFile: File,
    worldFile: File
): Promise<ImportedMap> {
    const text = await worldFile.text();
    const lines = text.trim().split('\n');

    if (lines.length < 6) {
        throw new Error('Invalid world file format');
    }

    const A = parseFloat(lines[0]); // Pixel size X (rotation = 0)
    const D = parseFloat(lines[1]); // Rotation (usually 0)
    const B = parseFloat(lines[2]); // Rotation (usually 0)
    const E = parseFloat(lines[3]); // Pixel size Y (negative = north up)
    const C = parseFloat(lines[4]); // Upper-left X coordinate
    const F = parseFloat(lines[5]); // Upper-left Y coordinate

    // We need image dimensions - extract from filename or use defaults
    // In real implementation, we'd read image dimensions
    const width = 4000; // Placeholder
    const height = 3000; // Placeholder

    const bounds = {
        west: C,
        north: F,
        east: C + width * A,
        south: F + height * E, // E is negative
    };

    const georeferencing: MapGeoreferencing = {
        crs: 'EPSG:3006', // Default to SWEREF99 TM for Swedish maps
        scale: 10000,
        bounds: {
            topLeft: { lat: bounds.north, lng: bounds.west },
            bottomRight: { lat: bounds.south, lng: bounds.east },
        },
        transformation: {
            matrix: [A, B, C, D, E, F],
        },
    };

    return {
        name: imageFile.name,
        source: 'Image',
        scale: georeferencing.scale,
        georeferencing,
        rawData: await imageFile.arrayBuffer(),
    };
}

/**
 * Convert SWEREF99 TM (EPSG:3006) to WGS84 (EPSG:4326)
 */
export function sweref99ToWGS84(x: number, y: number): GeoPoint {
    // Gauss-Krüger inverse projection for SWEREF99 TM
    // Central meridian: 15°E, false easting: 500000, false northing: 0

    const axis = 6378137.0; // GRS80 semi-major axis
    const flattening = 1 / 298.257222101;
    const centralMeridian = 15.0;
    const scale = 0.9996;
    const falseNorthing = 0.0;
    const falseEasting = 500000.0;

    const e2 = flattening * (2.0 - flattening);
    const n = flattening / (2.0 - flattening);
    const aRoof = axis / (1.0 + n) * (1.0 + n * n / 4.0 + n * n * n * n / 64.0);

    const delta1 = n / 2.0 - 2.0 * n * n / 3.0 + 37.0 * n * n * n / 96.0;
    const delta2 = n * n / 48.0 + n * n * n / 15.0;
    const delta3 = 17.0 * n * n * n / 480.0;

    const Astar = e2 + e2 * e2 + e2 * e2 * e2 + e2 * e2 * e2 * e2;
    const Bstar = -(7.0 * e2 * e2 + 17.0 * e2 * e2 * e2 + 30.0 * e2 * e2 * e2 * e2) / 6.0;
    const Cstar = (224.0 * e2 * e2 * e2 + 889.0 * e2 * e2 * e2 * e2) / 120.0;
    const Dstar = -(4279.0 * e2 * e2 * e2 * e2) / 1260.0;

    const xi = (y - falseNorthing) / (scale * aRoof);
    const eta = (x - falseEasting) / (scale * aRoof);

    const xiPrim = xi - delta1 * Math.sin(2.0 * xi) * Math.cosh(2.0 * eta)
        - delta2 * Math.sin(4.0 * xi) * Math.cosh(4.0 * eta)
        - delta3 * Math.sin(6.0 * xi) * Math.cosh(6.0 * eta);

    const etaPrim = eta - delta1 * Math.cos(2.0 * xi) * Math.sinh(2.0 * eta)
        - delta2 * Math.cos(4.0 * xi) * Math.sinh(4.0 * eta)
        - delta3 * Math.cos(6.0 * xi) * Math.sinh(6.0 * eta);

    const phiStar = Math.asin(Math.sin(xiPrim) / Math.cosh(etaPrim));
    const deltaLambda = Math.atan(Math.sinh(etaPrim) / Math.cos(xiPrim));

    const lonRadian = centralMeridian * Math.PI / 180.0 + deltaLambda;
    const latRadian = phiStar + Math.sin(phiStar) * Math.cos(phiStar) * (
        Astar + Bstar * Math.pow(Math.sin(phiStar), 2) +
        Cstar * Math.pow(Math.sin(phiStar), 4) +
        Dstar * Math.pow(Math.sin(phiStar), 6)
    );

    return {
        lat: latRadian * 180.0 / Math.PI,
        lng: lonRadian * 180.0 / Math.PI,
    };
}

/**
 * Convert WGS84 (EPSG:4326) to SWEREF99 TM (EPSG:3006)
 */
export function wgs84ToSweref99(lat: number, lng: number): { x: number; y: number } {
    const axis = 6378137.0;
    const flattening = 1 / 298.257222101;
    const centralMeridian = 15.0;
    const scale = 0.9996;
    const falseNorthing = 0.0;
    const falseEasting = 500000.0;

    const e2 = flattening * (2.0 - flattening);
    const n = flattening / (2.0 - flattening);
    const aRoof = axis / (1.0 + n) * (1.0 + n * n / 4.0 + n * n * n * n / 64.0);

    const A = e2 + e2 * e2 + e2 * e2 * e2 + e2 * e2 * e2 * e2;
    const B = -(7.0 * e2 * e2 + 17.0 * e2 * e2 * e2 + 30.0 * e2 * e2 * e2 * e2) / 6.0;
    const C = (224.0 * e2 * e2 * e2 + 889.0 * e2 * e2 * e2 * e2) / 120.0;
    const D = -(4279.0 * e2 * e2 * e2 * e2) / 1260.0;

    const beta1 = n / 2.0 - 2.0 * n * n / 3.0 + 5.0 * n * n * n / 16.0;
    const beta2 = 13.0 * n * n / 48.0 - 3.0 * n * n * n / 5.0;
    const beta3 = 61.0 * n * n * n / 240.0;

    const phi = lat * Math.PI / 180.0;
    const lambda = lng * Math.PI / 180.0;
    const lambdaZero = centralMeridian * Math.PI / 180.0;

    const phiStar = phi - Math.sin(phi) * Math.cos(phi) * (
        A + B * Math.pow(Math.sin(phi), 2) +
        C * Math.pow(Math.sin(phi), 4) +
        D * Math.pow(Math.sin(phi), 6)
    );

    const deltaLambda = lambda - lambdaZero;
    const xiPrim = Math.atan(Math.tan(phiStar) / Math.cos(deltaLambda));
    const etaPrim = Math.atanh(Math.cos(phiStar) * Math.sin(deltaLambda));

    const x = scale * aRoof * (
        etaPrim +
        beta1 * Math.cos(2.0 * xiPrim) * Math.sinh(2.0 * etaPrim) +
        beta2 * Math.cos(4.0 * xiPrim) * Math.sinh(4.0 * etaPrim) +
        beta3 * Math.cos(6.0 * xiPrim) * Math.sinh(6.0 * etaPrim)
    ) + falseEasting;

    const y = scale * aRoof * (
        xiPrim +
        beta1 * Math.sin(2.0 * xiPrim) * Math.cosh(2.0 * etaPrim) +
        beta2 * Math.sin(4.0 * xiPrim) * Math.cosh(4.0 * etaPrim) +
        beta3 * Math.sin(6.0 * xiPrim) * Math.cosh(6.0 * etaPrim)
    ) + falseNorthing;

    return { x, y };
}
