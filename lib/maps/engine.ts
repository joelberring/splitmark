/**
 * Map Engine Core
 * Handles orienteering map rendering with MapLibre GL JS
 */

import maplibregl from 'maplibre-gl';
import type { ImportedMap, MapGeoreferencing, GeoPoint, MapPoint } from '@/types/maps';
import { gokartorClient, getOSMTileUrl } from './gokartor';

export interface MapConfig {
    container: string | HTMLElement;
    center?: [number, number]; // [lng, lat]
    zoom?: number;
    bearing?: number;
    pitch?: number;
    style?: any;
    useGoKartor?: boolean; // Use GoKartor as base layer
    gokartorLayer?: 'laserkarta' | 'terrangkarta';
}

export class OrienteeringMapEngine {
    private map: maplibregl.Map;
    private georeferencing?: MapGeoreferencing;
    private currentMap?: ImportedMap;
    private config: MapConfig;

    constructor(config: MapConfig) {
        this.config = config;

        // Initialize MapLibre with style (GoKartor or default)
        this.map = new maplibregl.Map({
            container: config.container,
            center: config.center || [18.0686, 59.3293], // Stockholm default
            zoom: config.zoom || 13,
            bearing: config.bearing || 0,
            pitch: config.pitch || 0,
            style: config.style || this.getDefaultStyle(config.useGoKartor, config.gokartorLayer),
            attributionControl: false,
        });

        // Add controls
        this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
        this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        // Add attribution
        this.map.addControl(new maplibregl.AttributionControl({
            compact: true,
            customAttribution: config.useGoKartor
                ? '© <a href="https://gokartor.se">GoKartor</a>, Lantmäteriet'
                : '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        }), 'bottom-right');
    }

    /**
     * Add GoKartor base layer (Swedish laser map)
     */
    addGoKartorLayer(layer: 'laserkarta' | 'terrangkarta' = 'laserkarta'): void {
        if (this.map.getSource('gokartor')) return;

        this.map.addSource('gokartor', {
            type: 'raster',
            tiles: [
                `https://wmts.gokartor.se?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`
            ],
            tileSize: 256,
            attribution: '© GoKartor, Lantmäteriet',
            bounds: [10.0, 55.0, 24.0, 69.0], // Sweden bounds
        });

        this.map.addLayer({
            id: 'gokartor-layer',
            type: 'raster',
            source: 'gokartor',
        }, 'background'); // Add below other layers
    }

    /**
     * Add OpenStreetMap base layer (fallback)
     */
    addOSMLayer(): void {
        if (this.map.getSource('osm')) return;

        this.map.addSource('osm', {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
        });

        this.map.addLayer({
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
        }, 'background');
    }

    /**
     * Toggle base layer visibility
     */
    setBaseLayerVisible(layer: 'gokartor' | 'osm', visible: boolean): void {
        const layerId = `${layer}-layer`;
        if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    }

    /**
     * Load orienteering map from MBTiles or raster tiles
     */
    async loadMap(map: ImportedMap): Promise<void> {
        this.currentMap = map;
        this.georeferencing = map.georeferencing;

        return new Promise((resolve, reject) => {
            this.map.once('load', () => {
                try {
                    // Add raster source
                    this.map.addSource('orienteering-map', {
                        type: 'raster',
                        tiles: map.tiles?.tiles || [],
                        tileSize: map.tiles?.tileSize || 256,
                        bounds: [
                            map.georeferencing.bounds?.topLeft.lng || 0,
                            map.georeferencing.bounds?.bottomRight.lat || 0,
                            map.georeferencing.bounds?.bottomRight.lng || 0,
                            map.georeferencing.bounds?.topLeft.lat || 0,
                        ],
                        minzoom: map.tiles?.minZoom || 10,
                        maxzoom: map.tiles?.maxZoom || 18,
                    });

                    // Add raster layer
                    this.map.addLayer({
                        id: 'orienteering-map-layer',
                        type: 'raster',
                        source: 'orienteering-map',
                    });

                    // Fit map to bounds
                    if (map.georeferencing.bounds) {
                        this.fitToBounds(
                            map.georeferencing.bounds.topLeft,
                            map.georeferencing.bounds.bottomRight
                        );
                    }

                    // Apply magnetic declination if set
                    if (map.georeferencing.declination) {
                        this.rotateToDeclination(map.georeferencing.declination);
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Add course overlay (controls, start, finish)
     */
    addCourse(course: {
        name: string;
        controls: Array<{ code: string; position: GeoPoint }>;
        startPoint?: GeoPoint;
        finishPoint?: GeoPoint;
    }): void {
        // Create GeoJSON for controls
        const controlsGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: course.controls.map((control, index) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [control.position.lng, control.position.lat],
                },
                properties: {
                    code: control.code,
                    number: index + 1,
                    type: 'control',
                },
            })),
        };

        // Add start point
        if (course.startPoint) {
            controlsGeoJSON.features.unshift({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [course.startPoint.lng, course.startPoint.lat],
                },
                properties: {
                    type: 'start',
                },
            });
        }

        // Add finish point
        if (course.finishPoint) {
            controlsGeoJSON.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [course.finishPoint.lng, course.finishPoint.lat],
                },
                properties: {
                    type: 'finish',
                },
            });
        }

        // Add source
        this.map.addSource(`course-${course.name}`, {
            type: 'geojson',
            data: controlsGeoJSON,
        });

        // Add control rings (circles)
        this.map.addLayer({
            id: `course-${course.name}-rings`,
            type: 'circle',
            source: `course-${course.name}`,
            filter: ['==', ['get', 'type'], 'control'],
            paint: {
                'circle-radius': 15,
                'circle-color': 'transparent',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ff00ff',
            },
        });

        // Add control numbers
        this.map.addLayer({
            id: `course-${course.name}-numbers`,
            type: 'symbol',
            source: `course-${course.name}`,
            filter: ['==', ['get', 'type'], 'control'],
            layout: {
                'text-field': ['get', 'code'],
                'text-size': 12,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            },
            paint: {
                'text-color': '#ff00ff',
            },
        });

        // Add start triangle
        this.map.addLayer({
            id: `course-${course.name}-start`,
            type: 'symbol',
            source: `course-${course.name}`,
            filter: ['==', ['get', 'type'], 'start'],
            layout: {
                'icon-image': 'start-triangle', // TODO: Add custom icon
                'icon-size': 1.5,
            },
        });

        // Add finish circles
        this.map.addLayer({
            id: `course-${course.name}-finish`,
            type: 'circle',
            source: `course-${course.name}`,
            filter: ['==', ['get', 'type'], 'finish'],
            paint: {
                'circle-radius': 12,
                'circle-color': 'transparent',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ff00ff',
            },
        });
    }

    /**
     * Add GPS track overlay
     */
    addTrack(trackData: GeoPoint[], options?: {
        color?: string;
        width?: number;
        id?: string;
    }): void {
        const id = options?.id || 'gps-track';

        const trackGeoJSON: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: trackData.map(p => [p.lng, p.lat]),
            },
            properties: {},
        };

        this.map.addSource(id, {
            type: 'geojson',
            data: trackGeoJSON,
        });

        this.map.addLayer({
            id: `${id}-line`,
            type: 'line',
            source: id,
            paint: {
                'line-color': options?.color || '#0080ff',
                'line-width': options?.width || 3,
                'line-opacity': 0.8,
            },
        });
    }

    /**
     * Show live GPS position
     */
    updateGPSPosition(position: GeoPoint): void {
        const source = this.map.getSource('gps-position') as maplibregl.GeoJSONSource;

        const geoJSON: GeoJSON.Feature = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [position.lng, position.lat],
            },
            properties: {},
        };

        if (source) {
            source.setData(geoJSON);
        } else {
            this.map.addSource('gps-position', {
                type: 'geojson',
                data: geoJSON,
            });

            this.map.addLayer({
                id: 'gps-position-circle',
                type: 'circle',
                source: 'gps-position',
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#007cbf',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                },
            });
        }

        // Center map on position
        this.map.easeTo({
            center: [position.lng, position.lat],
            duration: 300,
        });
    }

    /**
     * Update multiple runner heads (live or replay)
     */
    updateMultipleTrackHeads(runners: Array<{ id: string; position: GeoPoint; color?: string }>): void {
        runners.forEach(runner => {
            const sourceId = `head-${runner.id}`;
            const layerId = `${sourceId}-circle`;
            const source = this.map.getSource(sourceId) as maplibregl.GeoJSONSource;

            const geoJSON: GeoJSON.Feature = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [runner.position.lng, runner.position.lat],
                },
                properties: {},
            };

            if (source) {
                source.setData(geoJSON);
            } else {
                this.map.addSource(sourceId, {
                    type: 'geojson',
                    data: geoJSON,
                });

                this.map.addLayer({
                    id: layerId,
                    type: 'circle',
                    source: sourceId,
                    paint: {
                        'circle-radius': 8,
                        'circle-color': runner.color || '#007cbf',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                    },
                });
            }
        });
    }

    /**
     * Rotate map to magnetic declination
     */
    rotateToDeclination(declination: number): void {
        this.map.setBearing(-declination);
    }

    /**
     * Fit map to bounds
     */
    fitToBounds(topLeft: GeoPoint, bottomRight: GeoPoint): void {
        this.map.fitBounds(
            [
                [topLeft.lng, bottomRight.lat],
                [bottomRight.lng, topLeft.lat],
            ],
            {
                padding: 20,
                duration: 1000,
            }
        );
    }

    /**
     * Get default MapLibre style with optional GoKartor
     */
    private getDefaultStyle(useGoKartor?: boolean, gokartorLayer?: string): any {
        const sources: any = {};
        const layers: any[] = [
            {
                id: 'background',
                type: 'background',
                paint: {
                    'background-color': '#f0f0f0',
                },
            },
        ];

        // Add OSM base layer
        sources['osm'] = {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
        };
        layers.push({
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
        });

        // Add GoKartor if requested (note: requires license for organizations)
        if (useGoKartor) {
            sources['gokartor'] = {
                type: 'raster',
                tiles: [
                    `https://wmts.gokartor.se?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${gokartorLayer || 'laserkarta'}&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`
                ],
                tileSize: 256,
                attribution: '© GoKartor, Lantmäteriet',
                bounds: [10.0, 55.0, 24.0, 69.0],
            };
            layers.push({
                id: 'gokartor-layer',
                type: 'raster',
                source: 'gokartor',
            });
        }

        return {
            version: 8,
            sources,
            layers,
        };
    }

    /**
     * Get MapLibre instance
     */
    getMap(): maplibregl.Map {
        return this.map;
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.map.remove();
    }
}
