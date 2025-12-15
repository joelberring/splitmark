/**
 * Coordinate Transformation Utilities
 * Convert between WGS84, SWEREF 99 TM, and map coordinates
 */

import proj4 from 'proj4';
import type { GeoPoint, MapPoint, MapGeoreferencing } from '@/types/maps';

// Define common CRS projections
proj4.defs([
    [
        'EPSG:4326',
        '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees',
    ],
    [
        'EPSG:3006',
        '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
    ],
    [
        'EPSG:3021',
        '+proj=tmerc +lat_0=0 +lon_0=15.80827777777778 +k=1 +x_0=1500000 +y_0=0 +ellps=bessel +units=m +no_defs +type=crs',
    ],
]);

/**
 * Transform coordinates between CRS
 */
export function transformCoordinates(
    point: { x: number; y: number },
    fromCRS: string,
    toCRS: string
): { x: number; y: number } {
    const result = proj4(fromCRS, toCRS, [point.x, point.y]);
    return { x: result[0], y: result[1] };
}

/**
 * Convert lat/lng (WGS84) to SWEREF 99 TM
 */
export function wgs84ToSWEREF99(point: GeoPoint): MapPoint {
    const result = proj4('EPSG:4326', 'EPSG:3006', [point.lng, point.lat]);
    return { x: result[0], y: result[1] };
}

/**
 * Convert SWEREF 99 TM to lat/lng (WGS84)
 */
export function sweref99ToWGS84(point: MapPoint): GeoPoint {
    const result = proj4('EPSG:3006', 'EPSG:4326', [point.x, point.y]);
    return { lng: result[0], lat: result[1] };
}

/**
 * Convert GPS position to map coordinates using georeferencing
 */
export function gpsToMapCoordinates(
    gpsPoint: GeoPoint,
    georef: MapGeoreferencing
): MapPoint {
    // First convert GPS (WGS84) to the map's CRS
    const projected = transformCoordinates(
        { x: gpsPoint.lng, y: gpsPoint.lat },
        'EPSG:4326',
        georef.crs
    );

    // Apply transformation matrix if exists
    if (georef.transformation) {
        const [a, b, c, d, e, f] = georef.transformation.matrix;
        return {
            x: a * projected.x + b * projected.y + c,
            y: d * projected.x + e * projected.y + f,
        };
    }

    return projected;
}

/**
 * Convert map coordinates to GPS position using georeferencing
 */
export function mapToGPSCoordinates(
    mapPoint: MapPoint,
    georef: MapGeoreferencing
): GeoPoint {
    let projected = mapPoint;

    // Apply inverse transformation if exists
    if (georef.transformation) {
        const [a, b, c, d, e, f] = georef.transformation.matrix;

        // Calculate inverse transformation matrix
        const det = a * e - b * d;
        if (Math.abs(det) < 1e-10) {
            throw new Error('Transformation matrix is singular');
        }

        const invA = e / det;
        const invB = -b / det;
        const invC = (b * f - c * e) / det;
        const invD = -d / det;
        const invE = a / det;
        const invF = (c * d - a * f) / det;

        projected = {
            x: invA * mapPoint.x + invB * mapPoint.y + invC,
            y: invD * mapPoint.x + invE * mapPoint.y + invF,
        };
    }

    // Convert from map CRS to WGS84
    const wgs84 = transformCoordinates(projected, georef.crs, 'EPSG:4326');

    return { lng: wgs84.x, lat: wgs84.y };
}

/**
 * Calculate distance between two GPS points (Haversine formula)
 */
export function calculateDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Calculate bearing between two GPS points
 */
export function calculateBearing(p1: GeoPoint, p2: GeoPoint): number {
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);

    return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Apply magnetic declination to compass bearing
 */
export function applyDeclination(bearing: number, declination: number): number {
    return (bearing - declination + 360) % 360;
}

/**
 * Calculate affine transformation matrix from control points
 */
export function calculateTransformationMatrix(
    sourcePoints: MapPoint[],
    targetPoints: GeoPoint[]
): number[] {
    if (sourcePoints.length < 3 || targetPoints.length < 3) {
        throw new Error('At least 3 control points required');
    }

    if (sourcePoints.length !== targetPoints.length) {
        throw new Error('Source and target points must have same length');
    }

    // For now, use simple least squares fit
    // TODO: Implement robust affine transformation calculation

    return [1, 0, 0, 0, 1, 0]; // Identity matrix placeholder
}
