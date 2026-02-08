'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { GPSPoint } from '@/types/database';
import type {
    VirtualControl,
    VirtualPunch,
    VirtualTrainingSession,
    SessionStatus,
} from '@/types/virtual-controls';
import { getGPSAccuracyLevel, GPS_ACCURACY_THRESHOLDS } from '@/types/virtual-controls';
import { gpsTracker } from '@/lib/gps/tracker';
import { calculateDistance, calculateBearing } from '@/lib/gps/virtual-punch';
import VirtualPunchNotification, { PunchBadge } from './VirtualPunchNotification';

interface TrainingMapControl {
    id: string;
    code: string;
    type: 'start' | 'control' | 'finish';
    order: number;
    relX?: number;
    relY?: number;
}

type SessionStopReason = 'finish' | 'manual_stop' | 'abort';

interface SessionSummary {
    result: 'ok' | 'mp' | 'dnf';
    missingControls: string[];
}

interface TrainingRunnerProps {
    eventId: string;
    eventName: string;
    courseId?: string;
    userId?: string;
    controls: VirtualControl[];
    mapImageUrl?: string;
    mapControls?: TrainingMapControl[];
    showMobileMap?: boolean;
    hideRunnerDot?: boolean;
    onSessionComplete?: (session: VirtualTrainingSession) => void;
}

/**
 * Full-screen GPS training runner with virtual control punching
 */
export default function TrainingRunner({
    eventId,
    eventName,
    courseId = '',
    userId = '',
    controls,
    mapImageUrl,
    mapControls = [],
    showMobileMap = false,
    hideRunnerDot = true,
    onSessionComplete,
}: TrainingRunnerProps) {
    const router = useRouter();

    // Session state
    const [status, setStatus] = useState<SessionStatus>('ready');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // GPS state
    const [currentPosition, setCurrentPosition] = useState<GPSPoint | null>(null);
    const [accuracy, setAccuracy] = useState<number>(0);
    const [track, setTrack] = useState<GPSPoint[]>([]);

    // Punch state
    const [punches, setPunches] = useState<VirtualPunch[]>([]);
    const [lastPunch, setLastPunch] = useState<{ punch: VirtualPunch; control: VirtualControl } | null>(null);
    const [nextControl, setNextControl] = useState<VirtualControl | null>(null);
    const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
    const [bearingToNext, setBearingToNext] = useState<number | null>(null);
    const [mapVisible, setMapVisible] = useState(showMobileMap);
    const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

    // Refs
    const cleanupRef = useRef<(() => void) | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const stoppingRef = useRef(false);
    const sessionCompletedRef = useRef(false);
    const trackRef = useRef<GPSPoint[]>([]);
    const punchesRef = useRef<VirtualPunch[]>([]);
    const startTimeRef = useRef<Date | null>(null);

    // Initialize GPS tracking
    useEffect(() => {
        return () => {
            cleanupRef.current?.();
            cleanupRef.current = null;
            if (timerRef.current) clearInterval(timerRef.current);
            if (gpsTracker.isRecording()) {
                void gpsTracker.stopTracking();
            }
            gpsTracker.disableVirtualPunching();
        };
    }, []);

    // Timer for elapsed time
    useEffect(() => {
        if (status === 'running' && startTime) {
            timerRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [status, startTime]);

    // Update distance/bearing to next control
    useEffect(() => {
        if (!currentPosition || !nextControl) {
            setDistanceToNext(null);
            setBearingToNext(null);
            return;
        }

        const dist = calculateDistance(
            currentPosition.lat,
            currentPosition.lng,
            nextControl.lat,
            nextControl.lng
        );
        const bear = calculateBearing(
            currentPosition.lat,
            currentPosition.lng,
            nextControl.lat,
            nextControl.lng
        );

        setDistanceToNext(dist);
        setBearingToNext(bear);
    }, [currentPosition, nextControl]);

    useEffect(() => {
        setMapVisible(showMobileMap);
    }, [showMobileMap]);

    const handleStop = useCallback(async (reason: SessionStopReason = 'manual_stop') => {
        if (stoppingRef.current) return;
        stoppingRef.current = true;

        const finishTime = new Date();
        const detector = gpsTracker.getPunchDetector();
        const detectorPunches = detector?.getPunches() || punchesRef.current;
        const validation = detector?.validatePunches();
        const expectedControls = controls
            .filter((control) => control.type === 'control' || control.type === 'finish')
            .map((control) => control.code);

        let result: SessionSummary['result'] = 'dnf';
        if (reason === 'finish') {
            result = validation?.valid ? 'ok' : 'mp';
        } else if (reason === 'manual_stop') {
            result = validation?.valid ? 'ok' : 'dnf';
        }

        const summary: SessionSummary = {
            result,
            missingControls: validation?.missing || [],
        };

        setSessionSummary(summary);
        setPunches(detectorPunches);
        punchesRef.current = detectorPunches;
        setStatus('finished');

        if (startTimeRef.current) {
            setElapsedTime(
                Math.max(0, Math.floor((finishTime.getTime() - startTimeRef.current.getTime()) / 1000))
            );
        }

        cleanupRef.current?.();
        cleanupRef.current = null;
        gpsTracker.disableVirtualPunching();
        await gpsTracker.stopTracking();

        if (onSessionComplete && !sessionCompletedRef.current) {
            const session: VirtualTrainingSession = {
                id: crypto.randomUUID(),
                eventId,
                courseId,
                userId,
                status: 'finished',
                startTime: startTimeRef.current || finishTime,
                finishTime,
                punches: detectorPunches,
                expectedControls,
                track: trackRef.current,
                result,
                missingControls: summary.missingControls,
                createdAt: finishTime,
                updatedAt: finishTime,
            };
            sessionCompletedRef.current = true;
            onSessionComplete(session);
        }

        stoppingRef.current = false;
    }, [controls, courseId, eventId, onSessionComplete, userId]);

    // Handle punch
    const handlePunch = useCallback((punch: VirtualPunch, control: VirtualControl) => {
        setPunches((previous) => {
            const nextPunches = [...previous, punch];
            punchesRef.current = nextPunches;
            return nextPunches;
        });
        setLastPunch({ punch, control });

        const detector = gpsTracker.getPunchDetector();
        if (detector) {
            setNextControl(detector.getNextControl());
        }

        if (control.type === 'finish') {
            void handleStop('finish');
        }
    }, [handleStop]);

    // Start session
    const handleStart = async () => {
        if (controls.length === 0) {
            alert('Banan saknar kontroller.');
            return;
        }

        try {
            setSessionSummary(null);
            sessionCompletedRef.current = false;
            punchesRef.current = [];
            trackRef.current = [];
            setPunches([]);
            setTrack([]);

            await gpsTracker.startTracking(`Träning ${eventName}`, eventId);

            gpsTracker.enableVirtualPunching(controls, {
                onPunch: handlePunch,
                onApproaching: (control, distance) => {
                    console.log(`Approaching ${control.code}: ${distance.toFixed(0)}m`);
                },
                onAccuracyWarning: (acc) => {
                    console.warn(`Poor GPS accuracy: ${acc.toFixed(0)}m`);
                },
            });

            cleanupRef.current = gpsTracker.onPositionUpdate((point) => {
                setCurrentPosition(point);
                setAccuracy(point.accuracy || 0);
                setTrack((previous) => {
                    const nextTrack = [...previous, point];
                    trackRef.current = nextTrack;
                    return nextTrack;
                });
            });

            const detector = gpsTracker.getPunchDetector();
            setNextControl(detector?.getNextControl() || null);

            const now = new Date();
            setStartTime(now);
            startTimeRef.current = now;
            setElapsedTime(0);
            setStatus('running');
        } catch (error) {
            console.error('Failed to start tracking:', error);
            alert('Kunde inte starta GPS-spårning. Ge appen tillgång till din position.');
        }
    };

    // Format elapsed time
    const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get accuracy color
    const getAccuracyColor = (): string => {
        const level = getGPSAccuracyLevel(accuracy);
        switch (level) {
            case 'excellent':
                return 'text-emerald-500';
            case 'good':
                return 'text-green-500';
            case 'acceptable':
                return 'text-yellow-500';
            case 'poor':
                return 'text-red-500';
        }
    };

    const overlayControls = mapControls
        .filter((control) =>
            typeof control.relX === 'number'
            && Number.isFinite(control.relX)
            && typeof control.relY === 'number'
            && Number.isFinite(control.relY)
        )
        .sort((left, right) => left.order - right.order);

    const showMapPanel = status === 'running'
        && mapVisible
        && !!mapImageUrl
        && overlayControls.length > 0;

    return (
        <div className="fixed inset-0 bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
                <button
                    onClick={async () => {
                        if (status === 'running') {
                            if (confirm('Vill du avbryta träningen?')) {
                                await handleStop('abort');
                                router.back();
                            }
                        } else {
                            router.back();
                        }
                    }}
                    className="text-gray-400 hover:text-white"
                >
                    ← Avbryt
                </button>
                <h1 className="text-lg font-bold truncate mx-4">{eventName}</h1>
                <div className="flex items-center gap-2">
                    {showMobileMap && mapImageUrl && (
                        <button
                            onClick={() => setMapVisible((previous) => !previous)}
                            className="px-2 py-1 bg-gray-700 rounded text-[10px] uppercase tracking-widest font-bold hover:bg-gray-600"
                        >
                            {mapVisible ? 'Dölj karta' : 'Visa karta'}
                        </button>
                    )}
                    <div className={`flex items-center gap-2 ${getAccuracyColor()}`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        <span className="text-sm">±{accuracy.toFixed(0)}m</span>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Status: Ready */}
                {status === 'ready' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="text-6xl mb-6">🏃</div>
                        <h2 className="text-2xl font-bold mb-2">GPS-träning</h2>
                        <p className="text-gray-400 text-center mb-8">
                            {controls.length} kontroller att hitta
                        </p>
                        <button
                            onClick={handleStart}
                            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl font-bold text-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl"
                        >
                            ▶ Starta
                        </button>
                    </div>
                )}

                {/* Status: Running */}
                {status === 'running' && (
                    <>
                        {/* Next control panel */}
                        <div className="bg-gray-800 p-4 border-b border-gray-700">
                            {nextControl ? (
                                <div className="text-center">
                                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                                        Nästa kontroll
                                    </div>
                                    <div className="text-5xl font-black mb-2">
                                        {nextControl.type === 'start'
                                            ? '▶'
                                            : nextControl.type === 'finish'
                                                ? '🏁'
                                                : nextControl.code}
                                    </div>
                                    {distanceToNext !== null && (
                                        <div className="text-2xl font-bold text-emerald-400">
                                            {distanceToNext < 1000
                                                ? `${distanceToNext.toFixed(0)} m`
                                                : `${(distanceToNext / 1000).toFixed(2)} km`}
                                        </div>
                                    )}
                                    {nextControl.description && (
                                        <div className="text-sm text-gray-400 mt-1">
                                            {nextControl.description}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400">
                                    Alla kontroller stämplade!
                                </div>
                            )}
                        </div>

                        {showMapPanel && mapImageUrl && (
                            <div className="border-b border-gray-700 bg-gray-900">
                                <div className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-gray-400 flex items-center justify-between">
                                    <span>Kartläge</span>
                                    <span>{hideRunnerDot ? 'Egen GPS-punkt dold' : 'Egen GPS-punkt tillåten'}</span>
                                </div>
                                <div className="relative">
                                    <img
                                        src={mapImageUrl}
                                        alt="Orienteringskarta"
                                        className="w-full h-auto max-h-[42vh] object-contain bg-black/30"
                                    />
                                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                                        {overlayControls.length > 1 && (
                                            <polyline
                                                points={overlayControls.map((control) => `${(control.relX ?? 0) * 100}%,${(control.relY ?? 0) * 100}%`).join(' ')}
                                                stroke="#d926a9"
                                                strokeWidth={2.5}
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeOpacity={0.85}
                                            />
                                        )}
                                        {overlayControls.map((control, index) => {
                                            const x = `${(control.relX ?? 0) * 100}%`;
                                            const y = `${(control.relY ?? 0) * 100}%`;
                                            const isStart = control.type === 'start';
                                            const isFinish = control.type === 'finish';

                                            return (
                                                <g key={`${control.id}-${index}`}>
                                                    {isStart ? (
                                                        <polygon
                                                            points={`${(control.relX ?? 0) * 100}%,${(control.relY ?? 0) * 100 - 2}% ${(control.relX ?? 0) * 100 - 1.4}%,${(control.relY ?? 0) * 100 + 1}% ${(control.relX ?? 0) * 100 + 1.4}%,${(control.relY ?? 0) * 100 + 1}%`}
                                                            stroke="#d926a9"
                                                            strokeWidth={2}
                                                            fill="none"
                                                        />
                                                    ) : isFinish ? (
                                                        <>
                                                            <circle cx={x} cy={y} r={12} stroke="#d926a9" strokeWidth={2.5} fill="none" />
                                                            <circle cx={x} cy={y} r={8} stroke="#d926a9" strokeWidth={2.5} fill="none" />
                                                        </>
                                                    ) : (
                                                        <circle cx={x} cy={y} r={10} stroke="#d926a9" strokeWidth={2.5} fill="none" />
                                                    )}
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        dx={12}
                                                        dy={-10}
                                                        fill="#ffffff"
                                                        stroke="#000000"
                                                        strokeWidth={3}
                                                        paintOrder="stroke"
                                                        fontSize={12}
                                                        fontWeight="bold"
                                                    >
                                                        {isStart ? 'S' : isFinish ? 'M' : control.code}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Timer */}
                        <div className="bg-gray-850 py-6 text-center border-b border-gray-700">
                            <div className="text-4xl font-mono font-bold">
                                {formatTime(elapsedTime)}
                            </div>
                        </div>

                        {/* Punch list */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
                                Stämplade kontroller ({punches.length}/{controls.length})
                            </div>
                            {punches.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <div className="text-3xl mb-2">📍</div>
                                    Gå till första kontrollen
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {punches.map((punch, i) => {
                                        const ctrl = controls.find((c) => c.id === punch.controlId);
                                        return (
                                            <PunchBadge
                                                key={i}
                                                punch={punch}
                                                control={ctrl}
                                                index={i + 1}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Stop button */}
                        <div className="p-4 border-t border-gray-700">
                            <button
                                onClick={() => void handleStop('manual_stop')}
                                className="w-full py-4 bg-red-600 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors"
                            >
                                ⏹ Avsluta träning
                            </button>
                        </div>
                    </>
                )}

                {/* Status: Finished */}
                {status === 'finished' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold mb-2">Träning klar!</h2>
                        <div className="text-4xl font-mono font-bold text-emerald-400 mb-4">
                            {formatTime(elapsedTime)}
                        </div>
                        <div className="text-gray-400 mb-8">
                            {punches.length} av {controls.length} kontroller
                        </div>
                        {sessionSummary && (
                            <div className="mb-6 text-center">
                                <div className={`inline-flex px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ${
                                    sessionSummary.result === 'ok'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : sessionSummary.result === 'mp'
                                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                                }`}>
                                    Resultat: {sessionSummary.result.toUpperCase()}
                                </div>
                                {sessionSummary.missingControls.length > 0 && (
                                    <p className="text-sm text-orange-300 mt-2">
                                        Saknade kontroller: {sessionSummary.missingControls.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Punch summary */}
                        <div className="w-full max-w-sm bg-gray-800 rounded-xl p-4 mb-6">
                            <div className="space-y-2">
                                {punches.slice(-5).map((punch, i) => {
                                    const ctrl = controls.find((c) => c.id === punch.controlId);
                                    return (
                                        <PunchBadge
                                            key={i}
                                            punch={punch}
                                            control={ctrl}
                                            index={punches.length - 4 + i}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={() => router.back()}
                            className="px-8 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                        >
                            ← Tillbaka
                        </button>
                    </div>
                )}
            </main>

            {/* Punch notification overlay */}
            <VirtualPunchNotification
                punch={lastPunch?.punch || null}
                control={lastPunch?.control || null}
                onDismiss={() => setLastPunch(null)}
            />

            {/* GPS accuracy warning */}
            {status === 'running' && accuracy > GPS_ACCURACY_THRESHOLDS.poor && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
                    ⚠️ Dålig GPS-signal ({accuracy.toFixed(0)}m)
                </div>
            )}
        </div>
    );
}
