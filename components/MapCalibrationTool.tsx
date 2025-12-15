'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Control {
    id: string;
    code: string;
    type: 'start' | 'control' | 'finish';
    relX?: number;
    relY?: number;
}

interface AnchorPoint {
    controlId: string;
    controlCode: string;
    sourceX: number;  // Original position (from Purple Pen or default)
    sourceY: number;
    targetX: number;  // Position on map (set by dragging)
    targetY: number;
}

interface CalibrationTransform {
    a: number; b: number;
    c: number; d: number;
    tx: number; ty: number;
}

interface CalibrationData {
    anchors: AnchorPoint[];
    transform?: CalibrationTransform;
}

interface MapCalibrationToolProps {
    imageUrl: string;
    controls: Control[];
    initialCalibration?: CalibrationData;
    onSave: (calibration: CalibrationData) => void;
    onCancel: () => void;
}

export default function MapCalibrationTool({
    imageUrl,
    controls,
    initialCalibration,
    onSave,
    onCancel,
}: MapCalibrationToolProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [anchors, setAnchors] = useState<AnchorPoint[]>(initialCalibration?.anchors || []);
    const [dragging, setDragging] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [imageRect, setImageRect] = useState<DOMRect | null>(null);

    // Sync anchors with initialCalibration when it changes
    useEffect(() => {
        if (initialCalibration?.anchors && initialCalibration.anchors.length > 0) {
            console.log('Loading saved anchors:', initialCalibration.anchors.length);
            setAnchors(initialCalibration.anchors);
        }
    }, [initialCalibration]);

    // Update image rect on resize
    useEffect(() => {
        const updateRect = () => {
            if (imageRef.current) {
                setImageRect(imageRef.current.getBoundingClientRect());
            }
        };
        updateRect();
        window.addEventListener('resize', updateRect);
        return () => window.removeEventListener('resize', updateRect);
    }, [imageSize]);

    // Calculate affine transform from anchors (need at least 2)
    const calculateTransform = useCallback((anchorList: AnchorPoint[]): CalibrationTransform | undefined => {
        if (anchorList.length < 2) return undefined;

        const [p1, p2] = anchorList;

        const srcDx = p2.sourceX - p1.sourceX;
        const srcDy = p2.sourceY - p1.sourceY;
        const tgtDx = p2.targetX - p1.targetX;
        const tgtDy = p2.targetY - p1.targetY;

        const srcLen = Math.sqrt(srcDx * srcDx + srcDy * srcDy);
        const tgtLen = Math.sqrt(tgtDx * tgtDx + tgtDy * tgtDy);

        if (srcLen === 0) return undefined;

        const scale = tgtLen / srcLen;
        const srcAngle = Math.atan2(srcDy, srcDx);
        const tgtAngle = Math.atan2(tgtDy, tgtDx);
        const rotation = tgtAngle - srcAngle;

        const cos = Math.cos(rotation) * scale;
        const sin = Math.sin(rotation) * scale;
        const tx = p1.targetX - (cos * p1.sourceX - sin * p1.sourceY);
        const ty = p1.targetY - (sin * p1.sourceX + cos * p1.sourceY);

        return { a: cos, b: -sin, c: sin, d: cos, tx, ty };
    }, []);

    const transform = calculateTransform(anchors);

    // Apply transform to get display position
    const getDisplayPosition = (control: Control): { x: number; y: number } => {
        // Check if this control is an anchor
        const anchor = anchors.find(a => a.controlId === control.id);
        if (anchor) {
            return { x: anchor.targetX, y: anchor.targetY };
        }

        // Apply transform if available
        const sourceX = control.relX ?? 0.5;
        const sourceY = control.relY ?? 0.5;

        if (transform) {
            return {
                x: transform.a * sourceX + transform.b * sourceY + transform.tx,
                y: transform.c * sourceX + transform.d * sourceY + transform.ty,
            };
        }

        // No transform yet - show at source position
        return { x: sourceX, y: sourceY };
    };

    // Handle drag start
    const handleDragStart = (controlId: string, e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(controlId);
    };

    // Handle drag
    const handleDrag = useCallback((e: MouseEvent) => {
        if (!dragging || !imageRect) return;

        const x = (e.clientX - imageRect.left) / imageRect.width;
        const y = (e.clientY - imageRect.top) / imageRect.height;

        // Clamp to image bounds
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));

        // Update or create anchor
        const control = controls.find(c => c.id === dragging);
        if (!control) return;

        const existingAnchor = anchors.find(a => a.controlId === dragging);

        if (existingAnchor) {
            setAnchors(anchors.map(a =>
                a.controlId === dragging
                    ? { ...a, targetX: clampedX, targetY: clampedY }
                    : a
            ));
        } else {
            // Create new anchor
            setAnchors([...anchors, {
                controlId: control.id,
                controlCode: control.code,
                sourceX: control.relX ?? 0.5,
                sourceY: control.relY ?? 0.5,
                targetX: clampedX,
                targetY: clampedY,
            }]);
        }
    }, [dragging, imageRect, anchors, controls]);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        setDragging(null);
    }, []);

    // Set up mouse listeners
    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', handleDragEnd);
            return () => {
                window.removeEventListener('mousemove', handleDrag);
                window.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [dragging, handleDrag, handleDragEnd]);

    // Remove anchor
    const removeAnchor = (controlId: string) => {
        setAnchors(anchors.filter(a => a.controlId !== controlId));
    };

    const handleSave = () => {
        console.log('MapCalibrationTool saving:', {
            anchorsCount: anchors.length,
            anchors: anchors.map(a => ({ controlId: a.controlId, targetX: a.targetX, targetY: a.targetY })),
            transform,
        });
        onSave({
            anchors,
            transform,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        🎯 Kalibrera Bana
                    </h2>
                    <p className="text-sm text-gray-500">
                        Dra kontrollerna till rätt position på kartan. Minst 2 kontroller krävs.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={anchors.length < 2}
                        className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Spara Kalibrering ({anchors.length}/2+)
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-gray-100 dark:bg-gray-900 p-4 overflow-y-auto shrink-0">
                    <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-300">
                        Ankarpunkter ({anchors.length})
                    </h3>

                    {anchors.length === 0 && (
                        <p className="text-sm text-gray-500 mb-4">
                            Dra kontroller på kartan för att skapa ankarpunkter
                        </p>
                    )}

                    <div className="space-y-2">
                        {anchors.map(anchor => (
                            <div
                                key={anchor.controlId}
                                className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-300 rounded-lg"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                                            {anchor.controlCode}
                                        </span>
                                        <span className="text-sm font-medium">Ankare</span>
                                    </div>
                                    <button
                                        onClick={() => removeAnchor(anchor.controlId)}
                                        className="text-red-500 text-sm hover:underline"
                                    >
                                        Ta bort
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {transform && (
                        <div className="mt-6 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                                ✓ Transformation
                            </h4>
                            <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                                <div>Rotation: {(Math.atan2(transform.c, transform.a) * 180 / Math.PI).toFixed(1)}°</div>
                                <div>Skalning: {Math.sqrt(transform.a * transform.a + transform.c * transform.c).toFixed(2)}x</div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        <strong>Tips:</strong> Välj kontroller långt ifrån varandra för bäst resultat.
                    </div>
                </div>

                {/* Map Area */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto bg-gray-800 flex items-center justify-center p-4"
                >
                    <div className="relative inline-block">
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Karta"
                            className="max-w-full max-h-[80vh]"
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
                                setImageRect(img.getBoundingClientRect());
                            }}
                            draggable={false}
                        />

                        {/* Controls overlay */}
                        {controls.map(control => {
                            const pos = getDisplayPosition(control);
                            const isAnchor = anchors.some(a => a.controlId === control.id);
                            const isDraggingThis = dragging === control.id;

                            return (
                                <div
                                    key={control.id}
                                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing
                                        ${isDraggingThis ? 'z-50 scale-125' : 'z-10'}
                                        ${isAnchor ? '' : 'opacity-70 hover:opacity-100'}
                                    `}
                                    style={{
                                        left: `${pos.x * 100}%`,
                                        top: `${pos.y * 100}%`,
                                    }}
                                    onMouseDown={(e) => handleDragStart(control.id, e)}
                                >
                                    {/* Control circle */}
                                    <div
                                        className={`w-10 h-10 rounded-full border-4 flex items-center justify-center text-xs font-bold
                                            ${control.type === 'start'
                                                ? 'border-green-500 bg-green-500/20 text-green-700'
                                                : control.type === 'finish'
                                                    ? 'border-red-500 bg-red-500/20 text-red-700'
                                                    : isAnchor
                                                        ? 'border-emerald-500 bg-emerald-500/30 text-emerald-700'
                                                        : 'border-orange-500 bg-orange-500/20 text-orange-700'
                                            }
                                            ${isDraggingThis ? 'ring-4 ring-white ring-opacity-50' : ''}
                                        `}
                                    >
                                        {control.code}
                                    </div>
                                    {/* Anchor indicator */}
                                    {isAnchor && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs">📌</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Connection lines between anchors */}
                        {anchors.length >= 2 && (
                            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                                {anchors.map((anchor, i) => {
                                    if (i === 0) return null;
                                    const prev = anchors[i - 1];
                                    return (
                                        <line
                                            key={anchor.controlId}
                                            x1={`${prev.targetX * 100}%`}
                                            y1={`${prev.targetY * 100}%`}
                                            x2={`${anchor.targetX * 100}%`}
                                            y2={`${anchor.targetY * 100}%`}
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            strokeDasharray="4"
                                        />
                                    );
                                })}
                            </svg>
                        )}
                    </div>
                </div>
            </div>

            {/* Instructions bar */}
            {dragging && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-900 px-6 py-3 rounded-lg font-semibold shadow-lg">
                    Dra kontrollen till rätt position på kartan
                </div>
            )}
        </div>
    );
}
