'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Course {
    name: string;
    controls: Array<{ code: string; lat: number; lng: number }>;
    startPoint?: { lat: number; lng: number };
    finishPoint?: { lat: number; lng: number };
}

interface GPSTrack {
    id: string;
    name: string;
    color: string;
    points: Array<{ lat: number; lng: number; timestamp: Date }>;
}

export default function MapViewerPage() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showOSM, setShowOSM] = useState(true);
    const [showCourse, setShowCourse] = useState(true);
    const [showTracks, setShowTracks] = useState(true);
    const [center] = useState<[number, number]>([18.0686, 59.3293]);

    const demoCourse: Course = {
        name: 'Demo Bana',
        startPoint: { lat: 59.335, lng: 18.055 },
        finishPoint: { lat: 59.328, lng: 18.075 },
        controls: [
            { code: '101', lat: 59.333, lng: 18.058 },
            { code: '102', lat: 59.330, lng: 18.062 },
            { code: '103', lat: 59.328, lng: 18.058 },
            { code: '104', lat: 59.329, lng: 18.070 },
        ],
    };

    const demoTrack: GPSTrack = {
        id: 'demo-track',
        name: 'Anna Svensson',
        color: '#10b981',
        points: [
            { lat: 59.335, lng: 18.055, timestamp: new Date() },
            { lat: 59.334, lng: 18.056, timestamp: new Date() },
            { lat: 59.333, lng: 18.058, timestamp: new Date() },
            { lat: 59.332, lng: 18.060, timestamp: new Date() },
            { lat: 59.330, lng: 18.062, timestamp: new Date() },
            { lat: 59.329, lng: 18.060, timestamp: new Date() },
            { lat: 59.328, lng: 18.058, timestamp: new Date() },
            { lat: 59.328, lng: 18.065, timestamp: new Date() },
            { lat: 59.329, lng: 18.070, timestamp: new Date() },
            { lat: 59.328, lng: 18.074, timestamp: new Date() },
            { lat: 59.328, lng: 18.075, timestamp: new Date() },
        ],
    };

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap',
                    },
                },
                layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
            },
            center,
            zoom: 14,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        map.current.on('load', () => {
            setIsLoaded(true);
            addCourseToMap();
            addTrackToMap();
        });

        return () => { map.current?.remove(); map.current = null; };
    }, []);

    const addCourseToMap = () => {
        if (!map.current) return;
        const courseCoords = [
            demoCourse.startPoint && [demoCourse.startPoint.lng, demoCourse.startPoint.lat],
            ...demoCourse.controls.map(c => [c.lng, c.lat]),
            demoCourse.finishPoint && [demoCourse.finishPoint.lng, demoCourse.finishPoint.lat],
        ].filter(Boolean);

        map.current.addSource('course-line', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: courseCoords as [number, number][] }, properties: {} },
        });

        map.current.addLayer({
            id: 'course-line-layer', type: 'line', source: 'course-line',
            paint: { 'line-color': '#ff00ff', 'line-width': 2, 'line-dasharray': [4, 2] },
        });

        map.current.addSource('controls', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: demoCourse.controls.map((c, i) => ({
                    type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
                    properties: { code: c.code, number: i + 1 },
                })),
            },
        });

        map.current.addLayer({
            id: 'controls-layer', type: 'circle', source: 'controls',
            paint: { 'circle-radius': 12, 'circle-color': 'transparent', 'circle-stroke-width': 3, 'circle-stroke-color': '#ff00ff' },
        });

        map.current.addLayer({
            id: 'controls-labels', type: 'symbol', source: 'controls',
            layout: { 'text-field': ['get', 'code'], 'text-size': 10, 'text-offset': [1.5, 0], 'text-anchor': 'left' },
            paint: { 'text-color': '#ff00ff', 'text-halo-color': '#fff', 'text-halo-width': 2 },
        });

        if (demoCourse.startPoint) {
            new maplibregl.Marker({ color: '#10b981' })
                .setLngLat([demoCourse.startPoint.lng, demoCourse.startPoint.lat])
                .setPopup(new maplibregl.Popup().setHTML('<strong>Start</strong>'))
                .addTo(map.current);
        }

        if (demoCourse.finishPoint) {
            new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([demoCourse.finishPoint.lng, demoCourse.finishPoint.lat])
                .setPopup(new maplibregl.Popup().setHTML('<strong>Mål</strong>'))
                .addTo(map.current);
        }
    };

    const addTrackToMap = () => {
        if (!map.current) return;
        const trackCoords = demoTrack.points.map(p => [p.lng, p.lat]);
        map.current.addSource('gps-track', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: trackCoords }, properties: {} },
        });
        map.current.addLayer({
            id: 'gps-track-layer', type: 'line', source: 'gps-track',
            paint: { 'line-color': demoTrack.color, 'line-width': 4, 'line-opacity': 0.8 },
        });
    };

    const toggleLayer = (layerId: string, visible: boolean) => {
        if (!map.current || !map.current.getLayer(layerId)) return;
        map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    };

    useEffect(() => {
        if (!isLoaded) return;
        toggleLayer('course-line-layer', showCourse);
        toggleLayer('controls-layer', showCourse);
        toggleLayer('controls-labels', showCourse);
    }, [isLoaded, showCourse]);

    useEffect(() => {
        if (!isLoaded) return;
        toggleLayer('gps-track-layer', showTracks);
    }, [isLoaded, showTracks]);

    return (
        <div className="h-screen flex flex-col bg-slate-950">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 flex-shrink-0">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-slate-500 hover:text-emerald-400 text-xs font-bold uppercase tracking-wider">← Hem</Link>
                        <h1 className="text-lg font-bold text-white uppercase tracking-wide">🗺️ Kartvisning</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={showOSM} onChange={(e) => { setShowOSM(e.target.checked); toggleLayer('osm-layer', e.target.checked); }}
                                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-slate-400 font-bold uppercase tracking-wider">OSM</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={showCourse} onChange={(e) => setShowCourse(e.target.checked)}
                                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Bana</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={showTracks} onChange={(e) => setShowTracks(e.target.checked)}
                                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-slate-400 font-bold uppercase tracking-wider">GPS</span>
                        </label>
                    </div>
                </div>
            </header>

            {/* Map */}
            <div className="flex-1 relative">
                <div ref={mapContainer} className="absolute inset-0" />

                {/* Legend */}
                <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 z-10 backdrop-blur-sm">
                    <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-wider">Teckenförklaring</h4>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border-2 border-pink-500"></div>
                            <span className="text-slate-400">Kontroller</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-0.5 bg-pink-500 border-dashed"></div>
                            <span className="text-slate-400">Bana</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-emerald-500 rounded"></div>
                            <span className="text-slate-400">{demoTrack.name}</span>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 z-10 max-w-xs backdrop-blur-sm">
                    <h4 className="font-bold text-white mb-1 text-sm">{demoCourse.name}</h4>
                    <p className="text-xs text-slate-400">{demoCourse.controls.length} kontroller</p>
                    <div className="mt-2 pt-2 border-t border-slate-800">
                        <p className="text-xs text-slate-500">📍 GPS-spår: <strong className="text-emerald-400">{demoTrack.name}</strong></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
