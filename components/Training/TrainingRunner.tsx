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

interface TrainingRunnerProps {
    eventId: string;
    eventName: string;
    controls: VirtualControl[];
    onSessionComplete?: (session: VirtualTrainingSession) => void;
}

/**
 * Full-screen GPS training runner with virtual control punching
 */
export default function TrainingRunner({
    eventId,
    eventName,
    controls,
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

    // Refs
    const cleanupRef = useRef<(() => void) | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize GPS tracking
    useEffect(() => {
        return () => {
            // Cleanup on unmount
            cleanupRef.current?.();
            if (timerRef.current) clearInterval(timerRef.current);
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

    // Handle punch
    const handlePunch = useCallback((punch: VirtualPunch, control: VirtualControl) => {
        setPunches((prev) => [...prev, punch]);
        setLastPunch({ punch, control });

        // Update next control
        const detector = gpsTracker.getPunchDetector();
        if (detector) {
            setNextControl(detector.getNextControl());

            // Check if finished
            if (control.type === 'finish') {
                setStatus('finished');
            }
        }
    }, []);

    // Start session
    const handleStart = async () => {
        try {
            // Start GPS tracking
            await gpsTracker.startTracking(`Träning ${eventName}`, eventId);

            // Enable virtual punching
            gpsTracker.enableVirtualPunching(controls, {
                onPunch: handlePunch,
                onApproaching: (control, distance) => {
                    console.log(`Approaching ${control.code}: ${distance.toFixed(0)}m`);
                },
                onAccuracyWarning: (acc) => {
                    console.warn(`Poor GPS accuracy: ${acc.toFixed(0)}m`);
                },
            });

            // Register position callback
            cleanupRef.current = gpsTracker.onPositionUpdate((point) => {
                setCurrentPosition(point);
                setAccuracy(point.accuracy || 0);
                setTrack((prev) => [...prev, point]);
            });

            // Find first control (start)
            const detector = gpsTracker.getPunchDetector();
            setNextControl(detector?.getNextControl() || null);

            setStartTime(new Date());
            setStatus('running');
        } catch (error) {
            console.error('Failed to start tracking:', error);
            alert('Kunde inte starta GPS-spårning. Ge appen tillgång till din position.');
        }
    };

    // Stop session
    const handleStop = async () => {
        cleanupRef.current?.();
        gpsTracker.disableVirtualPunching();
        await gpsTracker.stopTracking();
        setStatus('finished');

        // Create session summary
        if (onSessionComplete) {
            const detector = gpsTracker.getPunchDetector();
            const validation = detector?.validatePunches();

            const session: VirtualTrainingSession = {
                id: crypto.randomUUID(),
                eventId,
                courseId: '', // Would come from props
                userId: '', // Would come from auth
                status: 'finished',
                startTime: startTime || new Date(),
                finishTime: new Date(),
                punches,
                expectedControls: controls.map((c) => c.code),
                track,
                result: validation?.valid ? 'ok' : 'mp',
                missingControls: validation?.missing,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            onSessionComplete(session);
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

    return (
        <div className="fixed inset-0 bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
                <button
                    onClick={() => {
                        if (status === 'running') {
                            if (confirm('Vill du avbryta träningen?')) {
                                handleStop();
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
                <div className={`flex items-center gap-2 ${getAccuracyColor()}`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-sm">±{accuracy.toFixed(0)}m</span>
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
                                onClick={handleStop}
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
