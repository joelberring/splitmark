'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { parseWorldFile, latlngToPixel, type WorldFile } from '@/lib/geo/worldfile';
import type { EventCourse, EventEntry } from '@/lib/firestore/events';

interface MapOverlayProps {
    worldFileContent: string;
    mapImageUrl: string;
    course?: EventCourse;
    results?: EventEntry[];
    selectedRunnerId?: string;
}

const ORIGINAL_WIDTH = 21124; // Standard for this test map
const COMPRESSED_WIDTH = 3500;
const SCALE_FACTOR = ORIGINAL_WIDTH / COMPRESSED_WIDTH;

export default function MapOverlay({
    worldFileContent,
    mapImageUrl,
    course,
    results,
    selectedRunnerId
}: MapOverlayProps) {
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [worldFile, setWorldFile] = useState<WorldFile | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (worldFileContent) {
            const wf = parseWorldFile(worldFileContent);
            setWorldFile({
                ...wf,
                pixelSizeX: wf.pixelSizeX * SCALE_FACTOR,
                pixelSizeY: wf.pixelSizeY * SCALE_FACTOR
            });
        }
    }, [worldFileContent]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    // Interaction Handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.5), 5));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    // Course Rendering Helpers
    const getControlPixelPosition = (controlId: string) => {
        // This is simplified: in a real app we'd need the control's lat/lng
        // For the ANS demo, we'll need to make sure the course object has them
        // or look them up from a shared pool.
        return null;
    };

    return (
        <div className="relative w-full h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing">
            <div
                className="absolute inset-0 transition-transform duration-75"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center'
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <img
                    src={mapImageUrl}
                    alt="Orienteringskarta"
                    className="max-w-none select-none"
                    draggable={false}
                    onLoad={handleImageLoad}
                />

                {/* SVG Overlay for Courses */}
                {imageSize.width > 0 && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                    >
                        {/* Course rendering logic would go here */}
                    </svg>
                )}
            </div>

            {/* Controls Info */}
            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-700 text-[10px] font-bold text-slate-400">
                {Math.round(zoom * 100)}% ZOOM | Dra för att panorera
            </div>

            <div className="absolute top-4 left-4 flex gap-2">
                <button
                    onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                    className="px-3 py-1.5 bg-slate-800/80 backdrop-blur-md rounded border border-slate-700 text-[10px] font-bold hover:bg-slate-700"
                >
                    ÅTERSTÄLL VY
                </button>
            </div>
        </div>
    );
}
