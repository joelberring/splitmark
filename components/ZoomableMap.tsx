'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface Control {
    id: string;
    code: string;
    type: 'start' | 'control' | 'finish';
    order: number;
    lat?: number;
    lng?: number;
    relX?: number;  // Relative position 0-1 (from Purple Pen)
    relY?: number;  // Relative position 0-1 (from Purple Pen)
}

interface Course {
    id: string;
    name: string;
    length: number;
    controls: Control[];
}

export interface CalibrationTransform {
    a: number; b: number;  // rotation/scale matrix
    c: number; d: number;
    tx: number; ty: number;  // translation
}

export interface CalibrationAnchor {
    controlId: string;
    targetX: number;
    targetY: number;
}

export interface ZoomableMapProps {
    imageUrl: string;
    bounds?: MapBounds;
    course?: Course;
    calibration?: CalibrationTransform;  // Optional calibration transform
    calibrationAnchors?: CalibrationAnchor[];
    className?: string;
}

export default function ZoomableMap({ imageUrl, bounds, course, calibration, calibrationAnchors, className = '' }: ZoomableMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const MIN_SCALE = 0.5;
    const MAX_SCALE = 5;

    // Handle mouse wheel zoom
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)));
    }, []);

    // Mouse drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch handlers for mobile pinch-zoom
    const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
    const [lastTouchCenter, setLastTouchCenter] = useState<{ x: number; y: number } | null>(null);

    const getTouchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            setLastTouchDistance(getTouchDistance(e.touches));
            setLastTouchCenter(getTouchCenter(e.touches));
        } else if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && lastTouchDistance) {
            e.preventDefault();
            const newDistance = getTouchDistance(e.touches);
            if (newDistance) {
                const scaleChange = newDistance / lastTouchDistance;
                setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * scaleChange)));
                setLastTouchDistance(newDistance);
            }
        } else if (e.touches.length === 1 && isDragging) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setLastTouchDistance(null);
        setLastTouchCenter(null);
    };

    // Zoom controls
    const zoomIn = () => setScale(prev => Math.min(MAX_SCALE, prev * 1.3));
    const zoomOut = () => setScale(prev => Math.max(MIN_SCALE, prev / 1.3));
    const resetZoom = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Set up wheel listener
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // Get image dimensions when loaded
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    // Convert geo coordinates to pixel position
    const geoToPixel = (lat: number, lng: number): { x: number; y: number } | null => {
        if (!bounds || !imageSize.width || !imageSize.height) return null;

        const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * imageSize.width;
        const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * imageSize.height;

        return { x, y };
    };

    // Convert relative coords (0-1) to pixel position
    const relToPixel = (relX: number, relY: number): { x: number; y: number } | null => {
        if (!imageSize.width || !imageSize.height) return null;
        return {
            x: relX * imageSize.width,
            y: relY * imageSize.height,
        };
    };

    // Apply calibration transform to relative coords
    const getCalibratedPosition = (controlId: string, relX: number, relY: number): { x: number; y: number } => {
        // Check for anchor first
        const anchor = calibrationAnchors?.find(a => a.controlId === controlId);
        if (anchor) {
            return { x: anchor.targetX, y: anchor.targetY };
        }

        // Apply transform if available
        if (calibration) {
            return {
                x: calibration.a * relX + calibration.b * relY + calibration.tx,
                y: calibration.c * relX + calibration.d * relY + calibration.ty,
            };
        }

        // No calibration
        return { x: relX, y: relY };
    };

    // Get controls with pixel positions (supports GPS, relative coords, and calibration)
    const controlsWithPositions = course?.controls
        .map(c => {
            let pixel: { x: number; y: number } | null = null;

            // First try relative coords (from Purple Pen)
            if (c.relX !== undefined && c.relY !== undefined) {
                // Apply calibration (anchors or transform)
                const calibrated = getCalibratedPosition(c.id, c.relX, c.relY);
                pixel = relToPixel(calibrated.x, calibrated.y);
            }
            // Fallback to GPS coords
            else if (c.lat && c.lng) {
                pixel = geoToPixel(c.lat, c.lng);
            }

            return { ...c, pixel };
        })
        .filter(c => c.pixel !== null) || [];

    return (
        <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-900 ${className}`}>
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <button
                    onClick={zoomIn}
                    className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center text-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Zooma in"
                >
                    +
                </button>
                <button
                    onClick={zoomOut}
                    className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center text-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Zooma ut"
                >
                    −
                </button>
                <button
                    onClick={resetZoom}
                    className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Återställ"
                >
                    ⟲
                </button>
            </div>

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-white/80 dark:bg-gray-800/80 rounded-lg text-sm font-mono">
                {Math.round(scale * 100)}%
            </div>

            {/* Map Container */}
            <div
                ref={containerRef}
                className="cursor-grab active:cursor-grabbing"
                style={{ height: '70vh' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="relative inline-block"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    }}
                >
                    {/* Map Image */}
                    <img
                        src={imageUrl}
                        alt="Orienteringskarta"
                        className="max-w-none"
                        style={{ maxHeight: '70vh', width: 'auto' }}
                        onLoad={handleImageLoad}
                        draggable={false}
                    />

                    {/* SVG Course Overlay */}
                    {course && controlsWithPositions.length > 0 && imageSize.width > 0 && (
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                            style={{ width: '100%', height: '100%' }}
                        >
                            {/* Course lines */}
                            <polyline
                                points={controlsWithPositions
                                    .sort((a, b) => a.order - b.order)
                                    .map(c => `${c.pixel!.x},${c.pixel!.y}`)
                                    .join(' ')}
                                stroke="#d926a9"
                                strokeWidth={3}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Control circles */}
                            {controlsWithPositions.map((control, idx) => (
                                <g key={control.id}>
                                    {control.type === 'start' ? (
                                        // Start triangle
                                        <polygon
                                            points={`${control.pixel!.x},${control.pixel!.y - 20} ${control.pixel!.x - 17},${control.pixel!.y + 10} ${control.pixel!.x + 17},${control.pixel!.y + 10}`}
                                            stroke="#d926a9"
                                            strokeWidth={3}
                                            fill="none"
                                        />
                                    ) : control.type === 'finish' ? (
                                        // Finish double circle
                                        <>
                                            <circle
                                                cx={control.pixel!.x}
                                                cy={control.pixel!.y}
                                                r={18}
                                                stroke="#d926a9"
                                                strokeWidth={3}
                                                fill="none"
                                            />
                                            <circle
                                                cx={control.pixel!.x}
                                                cy={control.pixel!.y}
                                                r={12}
                                                stroke="#d926a9"
                                                strokeWidth={3}
                                                fill="none"
                                            />
                                        </>
                                    ) : (
                                        // Regular control circle
                                        <>
                                            <circle
                                                cx={control.pixel!.x}
                                                cy={control.pixel!.y}
                                                r={20}
                                                stroke="#d926a9"
                                                strokeWidth={3}
                                                fill="none"
                                            />
                                            {/* Control number */}
                                            <text
                                                x={control.pixel!.x + 25}
                                                y={control.pixel!.y - 15}
                                                fill="#d926a9"
                                                fontSize={16}
                                                fontWeight="bold"
                                            >
                                                {control.order}
                                            </text>
                                        </>
                                    )}
                                </g>
                            ))}
                        </svg>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-4 right-4 z-10 text-xs text-gray-500 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
                Scroll för zoom • Dra för panorering
            </div>
        </div>
    );
}
