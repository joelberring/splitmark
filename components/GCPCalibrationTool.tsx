'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    solveAffine,
    applyAffine,
    getTransformationInfo,
    validateMatrix,
    type GCP,
    type AffineMatrix,
    type CalibrationResult,
} from '@/lib/geo/affine';

// ============================================================================
// Types
// ============================================================================

export interface GCPCalibrationProps {
    imageUrl: string;
    imageName?: string;
    initialGCPs?: GCP[];
    initialTransform?: AffineMatrix;
    onSave: (gcps: GCP[], transform: AffineMatrix) => void;
    onCancel: () => void;
}

type ActiveView = 'image' | 'map';

// ============================================================================
// Main Component
// ============================================================================

export default function GCPCalibrationTool({
    imageUrl,
    imageName = 'Orienteringskarta',
    initialGCPs = [],
    initialTransform,
    onSave,
    onCancel,
}: GCPCalibrationProps) {
    // State
    const [gcps, setGcps] = useState<GCP[]>(initialGCPs);
    const [activeView, setActiveView] = useState<ActiveView>('image');
    const [pendingPixel, setPendingPixel] = useState<{ x: number; y: number } | null>(null);
    const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([18.07, 59.33]); // Stockholm default
    const [mapZoom, setMapZoom] = useState(12);

    // Image state
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
    const [imageScale, setImageScale] = useState(1);

    // Refs
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    // ============================================================================
    // Calibration Calculation
    // ============================================================================

    useEffect(() => {
        if (gcps.length >= 3) {
            const result = solveAffine(gcps);
            setCalibration(result);
        } else {
            setCalibration(null);
        }
    }, [gcps]);

    // ============================================================================
    // Map Initialization (Lazy load OpenLayers)
    // ============================================================================

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Dynamically load OpenLayers CSS
        const cssId = 'ol-css';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/ol@8.2.0/ol.css';
            document.head.appendChild(link);
        }

        // Dynamically import OpenLayers to avoid SSR issues
        const initMap = async () => {
            const { default: OLMap } = await import('ol/Map');
            const { default: View } = await import('ol/View');
            const { default: TileLayer } = await import('ol/layer/Tile');
            const { default: OSM } = await import('ol/source/OSM');
            const { fromLonLat, toLonLat } = await import('ol/proj');
            const { default: VectorLayer } = await import('ol/layer/Vector');
            const { default: VectorSource } = await import('ol/source/Vector');
            const { default: Feature } = await import('ol/Feature');
            const { default: Point } = await import('ol/geom/Point');
            const { default: Style } = await import('ol/style/Style');
            const { default: Circle } = await import('ol/style/Circle');
            const { default: Fill } = await import('ol/style/Fill');
            const { default: Stroke } = await import('ol/style/Stroke');
            const { default: Text } = await import('ol/style/Text');

            // Create vector source for GCP markers
            const vectorSource = new VectorSource();

            // Create map
            const map = new OLMap({
                target: mapContainerRef.current!,
                layers: [
                    new TileLayer({ source: new OSM() }),
                    new VectorLayer({
                        source: vectorSource,
                        style: (feature) => {
                            const index = feature.get('index');
                            return new Style({
                                image: new Circle({
                                    radius: 12,
                                    fill: new Fill({ color: '#10B981' }),
                                    stroke: new Stroke({ color: '#ffffff', width: 2 }),
                                }),
                                text: new Text({
                                    text: String(index + 1),
                                    fill: new Fill({ color: '#ffffff' }),
                                    font: 'bold 12px sans-serif',
                                }),
                            });
                        },
                    }),
                ],
                view: new View({
                    center: fromLonLat(mapCenter),
                    zoom: mapZoom,
                }),
            });

            // Store references
            mapRef.current = { map, vectorSource, fromLonLat, toLonLat, Feature, Point };

            // Click handler
            map.on('click', (e) => {
                if (activeView !== 'map') return;

                const coords = toLonLat(e.coordinate);
                handleMapClick(coords[1], coords[0]); // lat, lon
            });
        };

        initMap();

        return () => {
            if (mapRef.current?.map) {
                mapRef.current.map.setTarget(undefined);
                mapRef.current = null;
            }
        };
    }, []);

    // Update GCP markers on map
    useEffect(() => {
        if (!mapRef.current) return;

        const { vectorSource, fromLonLat, Feature, Point } = mapRef.current;
        vectorSource.clear();

        gcps.forEach((gcp, index) => {
            const feature = new Feature({
                geometry: new Point(fromLonLat([gcp.geo.lon, gcp.geo.lat])),
                index,
            });
            vectorSource.addFeature(feature);
        });
    }, [gcps]);

    // ============================================================================
    // Event Handlers
    // ============================================================================

    const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (activeView !== 'image') return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - imageOffset.x) / imageScale;
        const y = (e.clientY - rect.top - imageOffset.y) / imageScale;

        if (imageSize && x >= 0 && y >= 0 && x <= imageSize.width && y <= imageSize.height) {
            setPendingPixel({ x, y });
            setActiveView('map');
        }
    };

    const handleMapClick = (lat: number, lon: number) => {
        if (!pendingPixel) return;

        const newGcp: GCP = {
            id: `gcp-${Date.now()}`,
            pixel: pendingPixel,
            geo: { lat, lon },
        };

        setGcps(prev => [...prev, newGcp]);
        setPendingPixel(null);
        setActiveView('image');
    };

    const removeGcp = (id: string) => {
        setGcps(prev => prev.filter(g => g.id !== id));
    };

    const handleSave = () => {
        if (!calibration?.isValid || !calibration.matrix) {
            alert('Minst 3 passpunkter krävs för att spara kalibreringen.');
            return;
        }
        onSave(gcps, calibration.matrix);
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });

        // Fit image to container
        if (imageContainerRef.current) {
            const container = imageContainerRef.current;
            const scaleX = container.clientWidth / img.naturalWidth;
            const scaleY = container.clientHeight / img.naturalHeight;
            const scale = Math.min(scaleX, scaleY, 1);
            setImageScale(scale);
        }
    };

    // ============================================================================
    // Render
    // ============================================================================

    const transformInfo = calibration?.matrix ? getTransformationInfo(calibration.matrix) : null;
    const validation = calibration?.matrix ? validateMatrix(calibration.matrix) : null;

    return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-white">🎯 Georeferering: {imageName}</h2>
                    <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${gcps.length >= 3 ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                            }`}>
                            {gcps.length}/3 punkter
                        </span>
                        {calibration?.isValid && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-600 text-white">
                                ✓ Kalibrerad
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!calibration?.isValid}
                        className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Spara kalibrering
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex">
                {/* Left: Image View */}
                <div
                    ref={imageContainerRef}
                    className={`flex-1 relative overflow-hidden cursor-crosshair ${activeView === 'image' ? 'ring-2 ring-blue-500' : ''
                        }`}
                    onClick={handleImageClick}
                >
                    <div className="absolute top-2 left-2 z-10 bg-black/70 text-white px-3 py-1 rounded text-sm">
                        📷 Kartbild {activeView === 'image' && pendingPixel === null && '(Klicka för att placera punkt)'}
                    </div>

                    <div
                        className="absolute"
                        style={{
                            transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageScale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt="Map"
                            onLoad={handleImageLoad}
                            className="max-w-none"
                            draggable={false}
                        />

                        {/* GCP markers on image */}
                        {gcps.map((gcp, index) => (
                            <div
                                key={gcp.id}
                                className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold border-2 border-white cursor-pointer hover:bg-red-500"
                                style={{ left: gcp.pixel.x, top: gcp.pixel.y }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeGcp(gcp.id);
                                }}
                                title="Klicka för att ta bort"
                            >
                                {index + 1}
                            </div>
                        ))}

                        {/* Pending point */}
                        {pendingPixel && (
                            <div
                                className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center rounded-full bg-yellow-500 text-white text-xs font-bold border-2 border-white animate-pulse"
                                style={{ left: pendingPixel.x, top: pendingPixel.y }}
                            >
                                ?
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Map View */}
                <div
                    className={`flex-1 relative ${activeView === 'map' ? 'ring-2 ring-blue-500' : ''
                        }`}
                >
                    <div className="absolute top-2 left-2 z-10 bg-black/70 text-white px-3 py-1 rounded text-sm">
                        🗺️ OpenStreetMap {activeView === 'map' && '(Klicka motsvarande punkt på kartan)'}
                    </div>
                    <div ref={mapContainerRef} className="absolute inset-0" />
                </div>
            </div>

            {/* Footer: GCP List & Stats */}
            <div className="bg-gray-800 border-t border-gray-700 p-4">
                <div className="flex gap-8">
                    {/* GCP List */}
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-300 mb-2">Passpunkter (GCPs)</h3>
                        <div className="flex flex-wrap gap-2">
                            {gcps.length === 0 ? (
                                <p className="text-gray-500 text-sm">Klicka på kartbilden för att placera första punkten</p>
                            ) : (
                                gcps.map((gcp, index) => (
                                    <div
                                        key={gcp.id}
                                        className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded text-sm"
                                    >
                                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="text-gray-300">
                                            ({Math.round(gcp.pixel.x)}, {Math.round(gcp.pixel.y)}) →
                                            ({gcp.geo.lat.toFixed(5)}, {gcp.geo.lon.toFixed(5)})
                                        </span>
                                        {calibration?.residuals[index] !== undefined && (
                                            <span className="text-gray-400 text-xs">
                                                ±{(calibration.residuals[index] * 111000).toFixed(1)}m
                                            </span>
                                        )}
                                        <button
                                            onClick={() => removeGcp(gcp.id)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Calibration Stats */}
                    {transformInfo && (
                        <div className="w-64">
                            <h3 className="text-sm font-bold text-gray-300 mb-2">Kalibreringskvalitet</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-400">Rotation:</span>
                                <span className="text-white">{transformInfo.rotation.toFixed(1)}°</span>
                                <span className="text-gray-400">Skala X:</span>
                                <span className="text-white">{transformInfo.scaleX.toFixed(6)}</span>
                                <span className="text-gray-400">Skala Y:</span>
                                <span className="text-white">{transformInfo.scaleY.toFixed(6)}</span>
                                <span className="text-gray-400">RMS-fel:</span>
                                <span className={`${calibration?.rmsError && calibration.rmsError < 0.001 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {calibration?.rmsError ? `${(calibration.rmsError * 111000).toFixed(1)}m` : '-'}
                                </span>
                            </div>
                            {validation && !validation.valid && (
                                <div className="mt-2 text-yellow-400 text-xs">
                                    ⚠️ {validation.warnings.join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="mt-4 p-3 bg-gray-700/50 rounded text-sm text-gray-300">
                    <strong>Instruktioner:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li>Klicka på en igenkännbar punkt på kartbilden (t.ex. vägkorsning, byggnadshörn)</li>
                        <li>Klicka på samma punkt på OpenStreetMap-kartan till höger</li>
                        <li>Upprepa för minst 3 punkter, gärna spridda över kartan</li>
                        <li>Klicka "Spara kalibrering" när du är nöjd</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
