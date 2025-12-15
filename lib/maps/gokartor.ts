/**
 * GoKartor WMTS Client
 * Integration with gokartor.se map service
 */

import { wgs84ToSweref99, sweref99ToWGS84 } from './geotiff';
import type { GeoPoint } from '@/types/maps';

export interface GoKartorConfig {
    username?: string;
    password?: string;
    baseUrl: string;
}

export interface GoKartorLayer {
    id: string;
    name: string;
    description: string;
}

export interface TileCoordinate {
    z: number;
    x: number;
    y: number;
}

/**
 * GoKartor WMTS Client
 * Provides access to Swedish orienteering map tiles
 * 
 * Note: Requires license for organizational use
 * Free for private use on kartor.gokartor.se
 */
export class GoKartorClient {
    private config: GoKartorConfig;
    private authenticated: boolean = false;

    // Available layers
    static readonly LAYERS: GoKartorLayer[] = [
        { id: 'laserkarta', name: 'Laserkartan', description: 'Detaljerad LiDAR-baserad karta' },
        { id: 'terrangkarta', name: 'Terrängkartan', description: 'Generaliserad terrängkarta' },
        { id: 'namnlager', name: 'Namnlager', description: 'Geografiska namn' },
        { id: 'skyddad_natur', name: 'Skyddad natur', description: 'Naturskyddsområden' },
    ];

    // EPSG:3006 SWEREF99 TM tile matrix set
    private readonly TILE_SIZE = 256;
    private readonly CRS = 'EPSG:3006';

    // Tile matrix origin and resolutions for SWEREF99 TM
    private readonly ORIGIN: [number, number] = [-1200000, 8500000];
    private readonly RESOLUTIONS = [
        4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25
    ];

    constructor(config?: Partial<GoKartorConfig>) {
        this.config = {
            baseUrl: 'https://wmts.gokartor.se',
            ...config,
        };
    }

    /**
     * Set credentials for authenticated access
     */
    setCredentials(username: string, password: string): void {
        this.config.username = username;
        this.config.password = password;
    }

    /**
     * Get tile URL for a specific layer and coordinates
     */
    getTileUrl(layer: string, tile: TileCoordinate): string {
        // WMTS URL pattern
        const params = new URLSearchParams({
            SERVICE: 'WMTS',
            REQUEST: 'GetTile',
            VERSION: '1.0.0',
            LAYER: layer,
            STYLE: 'default',
            FORMAT: 'image/png',
            TILEMATRIXSET: this.CRS,
            TILEMATRIX: tile.z.toString(),
            TILEROW: tile.y.toString(),
            TILECOL: tile.x.toString(),
        });

        return `${this.config.baseUrl}?${params.toString()}`;
    }

    /**
     * Convert WGS84 coordinates to tile coordinates
     */
    wgs84ToTile(point: GeoPoint, zoom: number): TileCoordinate {
        // Convert to SWEREF99 TM first
        const { x, y } = wgs84ToSweref99(point.lat, point.lng);

        // Calculate tile coordinates
        const resolution = this.RESOLUTIONS[zoom];
        const tileX = Math.floor((x - this.ORIGIN[0]) / (this.TILE_SIZE * resolution));
        const tileY = Math.floor((this.ORIGIN[1] - y) / (this.TILE_SIZE * resolution));

        return { z: zoom, x: tileX, y: tileY };
    }

    /**
     * Get tile bounds in WGS84
     */
    getTileBoundsWGS84(tile: TileCoordinate): {
        north: number;
        south: number;
        east: number;
        west: number;
    } {
        const resolution = this.RESOLUTIONS[tile.z];
        const tileWidth = this.TILE_SIZE * resolution;
        const tileHeight = this.TILE_SIZE * resolution;

        // SWEREF99 TM bounds
        const westX = this.ORIGIN[0] + tile.x * tileWidth;
        const eastX = westX + tileWidth;
        const northY = this.ORIGIN[1] - tile.y * tileHeight;
        const southY = northY - tileHeight;

        // Convert to WGS84
        const nw = sweref99ToWGS84(westX, northY);
        const se = sweref99ToWGS84(eastX, southY);

        return {
            north: nw.lat,
            south: se.lat,
            east: se.lng,
            west: nw.lng,
        };
    }

    /**
     * Get tiles for a bounding box
     */
    getTilesForBounds(
        bounds: { north: number; south: number; east: number; west: number },
        zoom: number
    ): TileCoordinate[] {
        const nw = this.wgs84ToTile({ lat: bounds.north, lng: bounds.west }, zoom);
        const se = this.wgs84ToTile({ lat: bounds.south, lng: bounds.east }, zoom);

        const tiles: TileCoordinate[] = [];
        for (let x = nw.x; x <= se.x; x++) {
            for (let y = nw.y; y <= se.y; y++) {
                tiles.push({ z: zoom, x, y });
            }
        }

        return tiles;
    }

    /**
     * Fetch tile as blob (for caching)
     */
    async fetchTile(layer: string, tile: TileCoordinate): Promise<Blob> {
        const url = this.getTileUrl(layer, tile);

        const headers: HeadersInit = {};
        if (this.config.username && this.config.password) {
            headers['Authorization'] = 'Basic ' + btoa(`${this.config.username}:${this.config.password}`);
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch tile: ${response.status}`);
        }

        return await response.blob();
    }

    /**
     * Get MapLibre GL source configuration
     */
    getMapLibreSource(layer: string = 'laserkarta'): object {
        return {
            type: 'raster',
            tiles: [this.getTileUrl(layer, { z: '{z}', x: '{x}', y: '{y}' } as any)],
            tileSize: this.TILE_SIZE,
            attribution: '© GoKartor, Lantmäteriet',
            bounds: [10.0, 55.0, 24.0, 69.0], // Sweden bounds in WGS84
        };
    }

    /**
     * Get available zoom levels
     */
    getZoomLevels(): { min: number; max: number } {
        return { min: 0, max: this.RESOLUTIONS.length - 1 };
    }

    /**
     * Check if a point is within Sweden (approximate bounds)
     */
    isInSweden(point: GeoPoint): boolean {
        return point.lat >= 55.0 && point.lat <= 69.0 &&
            point.lng >= 10.0 && point.lng <= 24.0;
    }
}

// Export singleton
export const gokartorClient = new GoKartorClient();

/**
 * Fallback map provider
 * Uses OpenStreetMap when GoKartor is not available
 */
export function getOSMTileUrl(tile: TileCoordinate): string {
    return `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
}

/**
 * Lantmäteriet topographic map (requires API key)
 */
export function getLantmaterietTileUrl(
    tile: TileCoordinate,
    apiKey: string,
    layer: string = 'topowebb'
): string {
    return `https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/1.0.0/${layer}/default/3006/${tile.z}/${tile.y}/${tile.x}.png?api_key=${apiKey}`;
}
