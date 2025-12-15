'use client';

import { useEffect, useRef } from 'react';
import type { AffineMatrix } from '@/lib/geo/affine';

// We need to import OL types dynamically or use 'any' to avoid build issues if types aren't perfect
// For this artifact, we'll assume the environment is set up like GCPCalibrationTool

interface WarpedMapLayerProps {
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    matrix: AffineMatrix;
    opacity?: number;
}

export default function WarpedMapLayer({
    imageUrl,
    imageWidth,
    imageHeight,
    matrix,
    opacity = 0.7
}: WarpedMapLayerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const olRef = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current || olRef.current) return;

        const initMap = async () => {
            const { default: Map } = await import('ol/Map');
            const { default: View } = await import('ol/View');
            const { default: TileLayer } = await import('ol/layer/Tile');
            const { default: OSM } = await import('ol/source/OSM');
            const { default: ImageLayer } = await import('ol/layer/Image');
            const { default: Static } = await import('ol/source/ImageStatic');
            const { default: Projection } = await import('ol/proj/Projection');
            const { addProjection } = await import('ol/proj');

            // Calculate center of the warped image to center the view
            // Center pixel (w/2, h/2) -> World Coord
            const cx = imageWidth / 2;
            const cy = imageHeight / 2;
            const centerLon = matrix.a * cx + matrix.b * cy + matrix.c;
            const centerLat = matrix.d * cx + matrix.e * cy + matrix.f;

            // Define a custom projection for the image
            // This is the "magic" that allows arbitrary affine warping
            // We define a projection where "meters" are image pixels, usually called 'pixels'
            // And we need code to transform from 'pixels' to 'EPSG:3857' (or 4326)

            // NOTE: OpenLayers ImageStatic imageExtent expects a bounding box in the target projection.
            // If the image is rotated, a simple extent doesn't work well. 
            // The "proper" way to warp in client-side JS is often setting the image CSS transform 
            // OR using a custom projection code.

            // For this artifact, we will use a simpler approximation if rotation is small,
            // OR we use the strategy of defining the projection extent to match the lat/lon bounds.

            // Calculating the extent of the warped image in Lat/Lon
            const p00 = { x: 0, y: 0 };
            const p10 = { x: imageWidth, y: 0 };
            const p01 = { x: 0, y: imageHeight };
            const p11 = { x: imageWidth, y: imageHeight };

            const apply = (p: { x: number, y: number }) => ({
                lon: matrix.a * p.x + matrix.b * p.y + matrix.c,
                lat: matrix.d * p.x + matrix.e * p.y + matrix.f
            });

            const c00 = apply(p00);
            const c10 = apply(p10);
            const c01 = apply(p01);
            const c11 = apply(p11);

            // For ImageStatic, we pass the image extent.
            // WARNING: ImageStatic only supports axis-aligned images in the target projection.
            // If there is rotation, we must rotate the View, or use a data transformation.

            // Alternative: Use an ImageCanvas source where we draw the image transformed on a canvas.
            // This is much more robust for rotation/shear.

            const { default: ImageCanvasSource } = await import('ol/source/ImageCanvas');
            const { toLonLat, fromLonLat } = await import('ol/proj');

            const canvasSource = new ImageCanvasSource({
                canvasFunction: (extent, resolution, pixelRatio, size, projection): HTMLCanvasElement => {
                    const canvas = document.createElement('canvas');
                    canvas.width = size[0];
                    canvas.height = size[1];
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return canvas;

                    // Fill transparent
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // We need to draw the image such that its pixels map to the correct geographic location.
                    // This involves inverting the map-to-screen transform and combining it with the pixel-to-geo transform.

                    // But simpler: We have the image. We want to draw it on the map.
                    // The map wants to draw "Screen Pixels".
                    // For every screen pixel (sx, sy), we can find its Lat/Lon.
                    // From Lat/Lon, we can find the Image Pixel (ix, iy) using the Inverse Affine.
                    // Then we copy pixel (ix, iy) to (sx, sy).
                    // This is "inverse mapping" and is slow in JS.

                    // Forward mapping (drawing the image onto the canvas with a transform):
                    // We know where the image corners are in Lat/Lon (c00, c10, ...).
                    // We can project these Lat/Lon to Screen Pixels.

                    // 1. Project Image Corners to Screen Coordinates
                    // Note: 'extent' tells us the geo bounds of the current view.

                    // Helper to get screen pixel from Lat/Lon
                    // OL doesn't expose the transform easily inside canvasFunction without using map methods.
                    // But we don't have the map instance inside easily? 
                    // Wait, we do have access to the map instance if we close over it, but canvasFunction is pure-ish.

                    // Actually, let's step back.
                    // The most robust "Preview" is to calculate the 4 corners in Lat/Lon (which we did),
                    // And if rotation is small, just use ImageStatic with the bounding box.
                    // If rotation is large, the user will see a skewed box.

                    // FOR THIS ARTIFACT: We will implement the ImageStatic overlay
                    // accepting that it might not handle extreme rotation perfectly
                    // but it proves we can overlay the image.

                    // Calculate extent
                    const lons = [c00.lon, c10.lon, c01.lon, c11.lon];
                    const lats = [c00.lat, c10.lat, c01.lat, c11.lat];
                    const _extent = [
                        Math.min(...lons), Math.min(...lats),
                        Math.max(...lons), Math.max(...lats)
                    ];

                    // Just draw to canvas
                    // This is a placeholder for the complex warping logic
                    // In production this might need the GDAL pipeline or WebGL.

                    return canvas;
                }
            });

            // RE-STRATEGY for Artifact:
            // Use ImageStatic with the projected extent. 
            // It's the standard OL way for simple georeferencing.

            // We need to project the extent to Web Mercator (EPSG:3857) because the View is default 3857
            const p1 = fromLonLat([c00.lon, c00.lat]); // Bottom-Left? No, 0,0 top-left in image usually implies specific mapping
            const p2 = fromLonLat([c11.lon, c11.lat]);

            const imageExtent = [
                Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]),
                Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])
            ];

            const layer = new ImageLayer({
                source: new Static({
                    url: imageUrl,
                    imageExtent: imageExtent,
                    projection: 'EPSG:3857'
                }),
                opacity: opacity
            });

            const map = new Map({
                target: mapRef.current!,
                layers: [
                    new TileLayer({ source: new OSM() }),
                    layer
                ],
                view: new View({
                    center: fromLonLat([centerLon, centerLat]),
                    zoom: 13
                })
            });

            olRef.current = map;
        }

        initMap();

        return () => {
            if (olRef.current) {
                olRef.current.setTarget(undefined);
                olRef.current = null;
            }
        };
    }, [imageUrl, matrix]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapRef} className="absolute inset-0" />
            <div className="absolute top-2 left-2 bg-black/70 text-white p-2 text-xs rounded z-10">
                Live Preview (Approximation)
            </div>
        </div>
    );
}
