'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRaceTelemetry, TelemetryPacket } from '@/lib/live/useRaceTelemetry';

interface SpectatorLiveMapProps {
    raceId: string;
    mapStyle?: string; // URL to map style
}

// Configuration
const TAIL_DURATION_MS = 60000; // 60 seconds trail
const INTERPOLATION_DELAY_MS = 1000; // Delay to buffer for interpolation (1s)
// Note: For true live without delay, we extrapolate. For smoothness, we interpolate with delay.
// Given User Spec: "Livelox like", usually has small delay or specific interpolation.

export default function SpectatorLiveMap({ raceId, mapStyle }: SpectatorLiveMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const { status, setPacketHandler } = useRaceTelemetry(raceId);

    // State to hold runner history
    // [runner_id]: [{ lat, lon, timestamp }, ...]
    const runnerHistory = useRef<Record<string, TelemetryPacket[]>>({});

    // Animation Ref
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!mapContainer.current) return;

        // Initialize Map
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: mapStyle || 'https://demotiles.maplibre.org/style.json', // Fallback or use local style
            center: [18.0686, 59.3293], // Stockholm default
            zoom: 13,
            pitch: 0,
            bearing: 0,
        });

        map.current.on('load', () => {
            console.log('Spectator Map Loaded');

            // Add Source for Tails
            map.current?.addSource('runners-tails', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                lineMetrics: true // Crucial for line-gradient
            });

            // Add Layer for Tails (Snake Effect)
            map.current?.addLayer({
                id: 'runners-tails-layer',
                type: 'line',
                source: 'runners-tails',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-width': 5,
                    // Use line-gradient to fade the tail
                    // We need to set the 'lineGradient' property using setPaintProperty later purely based on progress?
                    // OR we map geometry properties.
                    // MapLibre line-gradient requires the source to be a lineString with 'lineMetrics': true.
                    // The gradient is applied along the line length (0..1).
                    // This is tricky for a moving snake where "0" is old tail and "1" is head.
                    // If we constantly update geometry, 0 is always end of tail, 1 is head.
                    'line-gradient': [
                        'interpolate',
                        ['linear'],
                        ['line-progress'],
                        0, 'rgba(255, 0, 0, 0)', // End of tail (faded out)
                        0.2, 'rgba(255, 0, 0, 0.5)',
                        1, 'rgba(255, 0, 0, 1)'   // Head (Opaque)
                    ]
                }
            });

            // Add Source/Layer for Heads (Dots)
            map.current?.addSource('runners-heads', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            map.current?.addLayer({
                id: 'runners-heads-layer',
                type: 'circle',
                source: 'runners-heads',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#FFFFFF',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FF0000'
                }
            });

            // Start Animation Loop
            startAnimation();
        });

        return () => {
            map.current?.remove();
            cancelAnimationFrame(rafRef.current);
        };
    }, [mapStyle]);

    // Handle incoming packets
    useEffect(() => {
        setPacketHandler((packet) => {
            if (!runnerHistory.current[packet.runner_id]) {
                runnerHistory.current[packet.runner_id] = [];
            }
            runnerHistory.current[packet.runner_id].push(packet);

            // Prune old history > 2 * TAIL_DURATION just to keep mem low
            const history = runnerHistory.current[packet.runner_id];
            const now = Date.now(); // Or packet time if we sync clocks
            // Keep it simple for now
            if (history.length > 200) {
                // Remove oldest
                history.shift();
            }
        });
    }, [setPacketHandler]);

    const startAnimation = () => {
        const animate = () => {
            renderFrame();
            rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
    };

    const renderFrame = () => {
        if (!map.current || !map.current.getSource('runners-tails')) return;

        const now = Date.now();
        // Virtual time for rendering (delayed by 1s to allow interpolation)
        // Adjust this logic for true "live" vs "smooth" trade-off
        const renderTime = now - 0; // Live mode for now (jumpy is ok for prototype) or smooth?

        // Construct GeoJSON features
        const tailFeatures: GeoJSON.Feature[] = [];
        const headFeatures: GeoJSON.Feature[] = [];

        Object.entries(runnerHistory.current).forEach(([runnerId, packets]) => {
            if (packets.length < 2) return;

            // 1. Calculate Tail (LineString)
            // Filter points within the last 60 seconds
            const recentPoints = packets
                .filter(p => now - p.timestamp < TAIL_DURATION_MS)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (recentPoints.length < 2) return;

            const coordinates = recentPoints.map(p => [p.lon, p.lat]);

            tailFeatures.push({
                type: 'Feature',
                properties: { runnerId },
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            });

            // 2. Calculate Head (Point) - Latest point
            const latest = recentPoints[recentPoints.length - 1];
            headFeatures.push({
                type: 'Feature',
                properties: { runnerId, name: runnerId },
                geometry: {
                    type: 'Point',
                    coordinates: [latest.lon, latest.lat]
                }
            });
        });

        // Update Sources
        (map.current.getSource('runners-tails') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: tailFeatures
        });

        (map.current.getSource('runners-heads') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: headFeatures
        });
    };

    return (
        <div className="relative w-full h-[600px] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
            {/* Map Container */}
            <div ref={mapContainer} className="absolute inset-0" />

            {/* Overlay Status */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm border border-gray-700">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="font-mono font-bold tracking-wider uppercase">Live Telemetry</span>
                </div>
                <div className="mt-1 text-gray-400 text-xs">
                    Runners: {Object.keys(runnerHistory.current).length} | Status: {status}
                </div>
            </div>

            {/* Overlay Controls (Placeholder) */}
            <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                    className="p-2 bg-gray-900/80 text-white rounded hover:bg-gray-800"
                    onClick={() => map.current?.flyTo({ zoom: 14 })}
                >
                    Zoom Focus
                </button>
            </div>
        </div>
    );
}
