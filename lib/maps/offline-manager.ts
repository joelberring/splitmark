import { db } from '../db';
import maplibregl from 'maplibre-gl';

/**
 * Manages offline map tiles for Splitmark.
 * Uses IndexedDB via Dexie to store raster/vector tiles.
 */
export class OfflineManager {
    private static CACHE_NAME = 'map-tiles-cache';

    /**
     * Registers a custom protocol with MapLibre to serve tiles from cache.
     */
    static registerOfflineProtocol(): void {
        maplibregl.addProtocol('offline', async (params) => {
            const url = params.url.replace('offline://', '');

            try {
                // Try to find in IndexedDB
                // Note: We'd need a dedicated table for tiles in db/index.ts
                // For now, illustrating the logic.
                const cachedTile = await db.mapTiles.get(url);

                if (cachedTile) {
                    return { data: cachedTile.data };
                } else {
                    // Fallback to fetch and cache
                    const response = await fetch(url);
                    const data = await response.arrayBuffer();
                    await db.mapTiles.put({ url, data, timestamp: new Date() });
                    return { data };
                }
            } catch (error) {
                throw error;
            }
        });
    }

    /**
     * Downloads all tiles within a bounding box for specified zoom levels.
     * @param bbox [minLng, minLat, maxLng, maxLat]
     * @param minZoom 
     * @param maxZoom 
     * @param urlTemplate Tile URL template (e.g. "https://tile.openstreetmap.org/{z}/{x}/{y}.png")
     */
    static async downloadMapPack(
        bbox: [number, number, number, number],
        minZoom: number,
        maxZoom: number,
        urlTemplate: string,
        onProgress?: (current: number, total: number) => void
    ): Promise<void> {
        const tiles = this.calculateTilesInBBox(bbox, minZoom, maxZoom);
        let count = 0;

        for (const tile of tiles) {
            const url = urlTemplate
                .replace('{z}', tile.z.toString())
                .replace('{x}', tile.x.toString())
                .replace('{y}', tile.y.toString());

            try {
                const response = await fetch(url);
                const data = await response.arrayBuffer();
                await db.mapTiles.put({ url, data, timestamp: new Date() });
            } catch (e) {
                console.warn(`Failed to cache tile: ${url}`, e);
            }

            count++;
            onProgress?.(count, tiles.length);
        }
    }

    private static calculateTilesInBBox(bbox: [number, number, number, number], minZoom: number, maxZoom: number) {
        const result: Array<{ z: number, x: number, y: number }> = [];

        for (let z = minZoom; z <= maxZoom; z++) {
            const minX = this.long2tile(bbox[0], z);
            const maxX = this.long2tile(bbox[2], z);
            const minY = this.lat2tile(bbox[3], z); // Latitude is inverted
            const maxY = this.lat2tile(bbox[1], z);

            for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
                for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
                    result.push({ z, x, y });
                }
            }
        }
        return result;
    }

    private static long2tile(lon: number, zoom: number) {
        return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    }

    private static lat2tile(lat: number, zoom: number) {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    }
}
