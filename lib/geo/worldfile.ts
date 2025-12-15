// Utilities for working with World Files and georeferenced maps
// Supports .pgw, .jgw, .tfw (World file formats)

export interface WorldFile {
    pixelSizeX: number;     // Pixel size in X direction (in map units, e.g., meters for SWEREF99 TM)
    rotationY: number;      // Rotation about Y axis (usually 0)
    rotationX: number;      // Rotation about X axis (usually 0)
    pixelSizeY: number;     // Pixel size in Y direction (negative for north-up)
    originX: number;        // X coordinate of upper-left pixel center (easting)
    originY: number;        // Y coordinate of upper-left pixel center (northing)
}

export interface MapBounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    width: number;   // pixels
    height: number;  // pixels
}

/**
 * Parse a world file (.pgw, .jgw, .tfw)
 */
export function parseWorldFile(content: string): WorldFile {
    const lines = content.trim().split(/\r?\n/).map(l => parseFloat(l.trim()));

    if (lines.length < 6) {
        throw new Error('Invalid world file format - expected 6 lines');
    }

    return {
        pixelSizeX: lines[0],
        rotationY: lines[1],
        rotationX: lines[2],
        pixelSizeY: lines[3],
        originX: lines[4],
        originY: lines[5],
    };
}

/**
 * Convert pixel coordinates to SWEREF99 TM coordinates using world file
 */
export function pixelToSweref(wf: WorldFile, pixelX: number, pixelY: number): { x: number; y: number } {
    // World file formula:
    // X = originX + pixelX * pixelSizeX + pixelY * rotationY
    // Y = originY + pixelX * rotationX + pixelY * pixelSizeY
    return {
        x: wf.originX + pixelX * wf.pixelSizeX + pixelY * wf.rotationY,
        y: wf.originY + pixelX * wf.rotationX + pixelY * wf.pixelSizeY,
    };
}

/**
 * Convert SWEREF99 TM coordinates to pixel coordinates using world file
 */
export function swerefToPixel(wf: WorldFile, swerefX: number, swerefY: number): { x: number; y: number } {
    // Inverse of pixelToSweref
    // Assuming no rotation (rotationY = rotationX = 0)
    const det = wf.pixelSizeX * wf.pixelSizeY - wf.rotationX * wf.rotationY;

    if (Math.abs(det) < 1e-10) {
        throw new Error('Degenerate world file - cannot invert');
    }

    const dx = swerefX - wf.originX;
    const dy = swerefY - wf.originY;

    return {
        x: (wf.pixelSizeY * dx - wf.rotationY * dy) / det,
        y: (-wf.rotationX * dx + wf.pixelSizeX * dy) / det,
    };
}

/**
 * Convert SWEREF99 TM (EPSG:3006) to WGS84 lat/lng
 * Uses accurate transformation formulas
 */
export function sweref99tmToWgs84(x: number, y: number): { lat: number; lng: number } {
    // SWEREF99 TM parameters
    const axis = 6378137.0;                      // GRS 80
    const flattening = 1.0 / 298.257222101;      // GRS 80
    const centralMeridian = 15.0;                // For SWEREF99 TM
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

    const degToRad = Math.PI / 180.0;

    // Remove false coordinates
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

    const lonRadian = centralMeridian * degToRad + deltaLambda;
    const latRadian = phiStar + Math.sin(phiStar) * Math.cos(phiStar) * (
        Astar +
        Bstar * Math.pow(Math.sin(phiStar), 2) +
        Cstar * Math.pow(Math.sin(phiStar), 4) +
        Dstar * Math.pow(Math.sin(phiStar), 6)
    );

    return {
        lat: latRadian * (180.0 / Math.PI),
        lng: lonRadian * (180.0 / Math.PI),
    };
}

/**
 * Convert WGS84 lat/lng to SWEREF99 TM (EPSG:3006)
 */
export function wgs84ToSweref99tm(lat: number, lng: number): { x: number; y: number } {
    const axis = 6378137.0;
    const flattening = 1.0 / 298.257222101;
    const centralMeridian = 15.0;
    const scale = 0.9996;
    const falseNorthing = 0.0;
    const falseEasting = 500000.0;

    const e2 = flattening * (2.0 - flattening);
    const n = flattening / (2.0 - flattening);
    const aRoof = axis / (1.0 + n) * (1.0 + n * n / 4.0 + n * n * n * n / 64.0);

    const A = e2;
    const B = (5.0 * e2 * e2 - e2 * e2 * e2) / 6.0;
    const C = (104.0 * e2 * e2 * e2 - 45.0 * e2 * e2 * e2 * e2) / 120.0;
    const D = (1237.0 * e2 * e2 * e2 * e2) / 1260.0;

    const beta1 = n / 2.0 - 2.0 * n * n / 3.0 + 5.0 * n * n * n / 16.0 + 41.0 * n * n * n * n / 180.0;
    const beta2 = 13.0 * n * n / 48.0 - 3.0 * n * n * n / 5.0 + 557.0 * n * n * n * n / 1440.0;
    const beta3 = 61.0 * n * n * n / 240.0 - 103.0 * n * n * n * n / 140.0;
    const beta4 = 49561.0 * n * n * n * n / 161280.0;

    const degToRad = Math.PI / 180.0;
    const phi = lat * degToRad;
    const lambda = lng * degToRad;
    const lambdaZero = centralMeridian * degToRad;

    const phiStar = phi - Math.sin(phi) * Math.cos(phi) * (A +
        B * Math.pow(Math.sin(phi), 2) +
        C * Math.pow(Math.sin(phi), 4) +
        D * Math.pow(Math.sin(phi), 6));

    const deltaLambda = lambda - lambdaZero;

    const xiPrim = Math.atan(Math.tan(phiStar) / Math.cos(deltaLambda));
    const etaPrim = Math.atanh(Math.cos(phiStar) * Math.sin(deltaLambda));

    const x = scale * aRoof * (etaPrim +
        beta1 * Math.cos(2.0 * xiPrim) * Math.sinh(2.0 * etaPrim) +
        beta2 * Math.cos(4.0 * xiPrim) * Math.sinh(4.0 * etaPrim) +
        beta3 * Math.cos(6.0 * xiPrim) * Math.sinh(6.0 * etaPrim) +
        beta4 * Math.cos(8.0 * xiPrim) * Math.sinh(8.0 * etaPrim)) + falseEasting;

    const y = scale * aRoof * (xiPrim +
        beta1 * Math.sin(2.0 * xiPrim) * Math.cosh(2.0 * etaPrim) +
        beta2 * Math.sin(4.0 * xiPrim) * Math.cosh(4.0 * etaPrim) +
        beta3 * Math.sin(6.0 * xiPrim) * Math.cosh(6.0 * etaPrim) +
        beta4 * Math.sin(8.0 * xiPrim) * Math.cosh(8.0 * etaPrim)) + falseNorthing;

    return { x, y };
}

/**
 * Convert lat/lng to pixel position using world file (for georeferenced map overlay)
 */
export function latlngToPixel(wf: WorldFile, lat: number, lng: number): { x: number; y: number } {
    const sweref = wgs84ToSweref99tm(lat, lng);
    return swerefToPixel(wf, sweref.x, sweref.y);
}

/**
 * Calculate map bounds in WGS84 from world file and image dimensions
 */
export function getMapBoundsWgs84(wf: WorldFile, imageWidth: number, imageHeight: number): MapBounds {
    // Get corner coordinates in SWEREF99
    const topLeft = pixelToSweref(wf, 0, 0);
    const topRight = pixelToSweref(wf, imageWidth, 0);
    const bottomLeft = pixelToSweref(wf, 0, imageHeight);
    const bottomRight = pixelToSweref(wf, imageWidth, imageHeight);

    // Convert to WGS84
    const tlWgs = sweref99tmToWgs84(topLeft.x, topLeft.y);
    const trWgs = sweref99tmToWgs84(topRight.x, topRight.y);
    const blWgs = sweref99tmToWgs84(bottomLeft.x, bottomLeft.y);
    const brWgs = sweref99tmToWgs84(bottomRight.x, bottomRight.y);

    return {
        minLat: Math.min(blWgs.lat, brWgs.lat),
        maxLat: Math.max(tlWgs.lat, trWgs.lat),
        minLng: Math.min(tlWgs.lng, blWgs.lng),
        maxLng: Math.max(trWgs.lng, brWgs.lng),
        width: imageWidth,
        height: imageHeight,
    };
}
