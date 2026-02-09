'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrainingRunner from '@/components/Training/TrainingRunner';
import { getEvent } from '@/lib/firestore/events';
import type { StoredEvent } from '@/types/event';
import type { AffineMatrix } from '@/lib/geo/affine';
import type { VirtualTrainingSession } from '@/types/virtual-controls';
import { useAuthState } from '@/lib/auth/hooks';
import {
    saveTrainingSession,
    subscribeToTrainingSessions,
    type TrainingSessionRecord,
} from '@/lib/firestore/training-sessions';
import {
    buildVirtualControls,
    getCourseControls,
    isFiniteNumber,
    normalizePlanningControls,
    normalizePlanningCourses,
} from '@/lib/events/course-planning';

interface LoadedImageSize {
    width: number;
    height: number;
}

function formatDate(value?: string): string {
    if (!value) return 'Okänt datum';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('sv-SE');
}

function formatDistance(distanceMeters?: number): string {
    if (!isFiniteNumber(distanceMeters) || distanceMeters <= 0) return 'okänd';
    return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatElapsed(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeStoredSession(
    eventId: string,
    raw: Partial<TrainingSessionRecord> & { id: string; courseId: string; courseName: string }
): TrainingSessionRecord {
    const nowIso = new Date().toISOString();
    const finishedIso = raw.finishedAt && !Number.isNaN(new Date(raw.finishedAt).getTime())
        ? new Date(raw.finishedAt).toISOString()
        : nowIso;

    const result = raw.result === 'ok' || raw.result === 'mp' || raw.result === 'dnf'
        ? raw.result
        : 'dnf';

    return {
        id: String(raw.id),
        eventId,
        courseId: String(raw.courseId),
        courseName: String(raw.courseName || 'Okänd bana'),
        userId: typeof raw.userId === 'string' ? raw.userId : undefined,
        userName: typeof raw.userName === 'string' ? raw.userName : undefined,
        finishedAt: finishedIso,
        elapsedSeconds: Math.max(0, Math.round(Number(raw.elapsedSeconds || 0))),
        punchedCount: Math.max(0, Math.round(Number(raw.punchedCount || 0))),
        expectedCount: Math.max(0, Math.round(Number(raw.expectedCount || 0))),
        result,
        missingControls: Array.isArray(raw.missingControls)
            ? raw.missingControls.map((value) => String(value))
            : [],
        createdAt: raw.createdAt && !Number.isNaN(new Date(raw.createdAt).getTime())
            ? new Date(raw.createdAt).toISOString()
            : finishedIso,
        updatedAt: nowIso,
    };
}

function sessionResultRank(result: TrainingSessionRecord['result']): number {
    if (result === 'ok') return 0;
    if (result === 'mp') return 1;
    return 2;
}

export default function EventTrainingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const eventId = params.id as string;
    const initialCourseId = searchParams.get('course') || '';

    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<StoredEvent | null>(null);
    const [imageSize, setImageSize] = useState<LoadedImageSize | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [startRunner, setStartRunner] = useState(false);
    const [sessionHistory, setSessionHistory] = useState<TrainingSessionRecord[]>([]);
    const [sharedSessions, setSharedSessions] = useState<TrainingSessionRecord[]>([]);
    const { user } = useAuthState();

    const storageKey = `splitmark-training-sessions-${eventId}`;

    useEffect(() => {
        const load = async () => {
            try {
                const found = await getEvent(eventId);
                if (found) {
                    const nextEvent = found as unknown as StoredEvent;
                    setEvent(nextEvent);

                    const normalizedCourses = normalizePlanningCourses((nextEvent as any).ppenCourses);
                    if (normalizedCourses.length > 0) {
                        const requested = normalizedCourses.find((course) => course.id === initialCourseId);
                        setSelectedCourseId(requested?.id || normalizedCourses[0].id);
                    }
                }
            } catch (error) {
                console.error('Kunde inte läsa träningsdata:', error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [eventId, initialCourseId]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                setSessionHistory([]);
                return;
            }
            const parsed = JSON.parse(raw) as TrainingSessionRecord[];
            if (!Array.isArray(parsed)) {
                setSessionHistory([]);
                return;
            }
            const normalized = parsed
                .filter((entry) => entry && typeof entry === 'object' && entry.id && entry.courseId)
                .map((entry) => normalizeStoredSession(eventId, entry as TrainingSessionRecord))
                .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
            setSessionHistory(normalized);
        } catch (error) {
            console.error('Kunde inte läsa tidigare träningspass:', error);
            setSessionHistory([]);
        }
    }, [eventId, storageKey]);

    useEffect(() => {
        return subscribeToTrainingSessions(
            eventId,
            (sessions) => setSharedSessions(sessions),
            { courseId: selectedCourseId, limit: 100 }
        );
    }, [eventId, selectedCourseId]);

    useEffect(() => {
        const imageUrl = event?.map?.imageUrl;
        if (!imageUrl) return;

        const image = new Image();
        image.onload = () => {
            setImageSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };
        image.src = imageUrl;
    }, [event?.map?.imageUrl]);

    const controls = useMemo(
        () => normalizePlanningControls((event as any)?.ppenControls),
        [event]
    );

    const courses = useMemo(
        () => normalizePlanningCourses((event as any)?.ppenCourses),
        [event]
    );

    const selectedCourse = useMemo(
        () => courses.find((course) => course.id === selectedCourseId) || null,
        [courses, selectedCourseId]
    );

    const selectedCourseControls = useMemo(
        () => getCourseControls(selectedCourse, controls),
        [selectedCourse, controls]
    );

    const calibration = ((event as any)?.calibration || null) as AffineMatrix | null;

    const virtualCourse = useMemo(() => {
        if (!selectedCourse) {
            return { controls: [], missingControlCodes: [] as string[] };
        }

        return buildVirtualControls(selectedCourse, controls, {
            calibration,
            imageWidth: imageSize?.width,
            imageHeight: imageSize?.height,
        });
    }, [selectedCourse, controls, calibration, imageSize?.width, imageSize?.height]);

    const overlayControls = useMemo(() => {
        return selectedCourseControls
            .map((control, index) => ({
                id: control.id,
                code: control.code,
                type: control.type,
                relX: control.relX,
                relY: control.relY,
                order: index,
            }))
            .filter((control) =>
                typeof control.relX === 'number'
                && Number.isFinite(control.relX)
                && typeof control.relY === 'number'
                && Number.isFinite(control.relY)
            );
    }, [selectedCourseControls]);

    const sharedCourseResults = useMemo(() => {
        return [...sharedSessions]
            .sort((left, right) => {
                const resultDelta = sessionResultRank(left.result) - sessionResultRank(right.result);
                if (resultDelta !== 0) return resultDelta;
                const timeDelta = left.elapsedSeconds - right.elapsedSeconds;
                if (timeDelta !== 0) return timeDelta;
                return left.finishedAt.localeCompare(right.finishedAt);
            })
            .slice(0, 12);
    }, [sharedSessions]);

    const handleSessionComplete = useCallback((session: VirtualTrainingSession) => {
        if (!selectedCourse) return;

        const start = session.startTime instanceof Date
            ? session.startTime.getTime()
            : new Date(session.startTime || new Date()).getTime();
        const finish = session.finishTime instanceof Date
            ? session.finishTime.getTime()
            : new Date(session.finishTime || new Date()).getTime();

        const elapsedSeconds = Math.max(0, Math.floor((finish - start) / 1000));
        const nowIso = new Date().toISOString();
        const nextRecord: TrainingSessionRecord = {
            id: session.id,
            eventId,
            courseId: selectedCourse.id,
            courseName: selectedCourse.name,
            userId: user?.uid || undefined,
            userName: user?.displayName || undefined,
            finishedAt: new Date(finish).toISOString(),
            elapsedSeconds,
            punchedCount: session.punches.length,
            expectedCount: session.expectedControls.length,
            result: session.result || 'dnf',
            missingControls: session.missingControls || [],
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        setSessionHistory((previous) => {
            const next = [nextRecord, ...previous].slice(0, 20);
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });

        if (user?.uid) {
            void saveTrainingSession(eventId, nextRecord);
        }
    }, [eventId, selectedCourse, storageKey, user?.displayName, user?.uid]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="text-5xl opacity-30 mb-4">❌</div>
                    <p className="font-bold text-xl mb-2">Träningen hittades inte</p>
                    <Link href="/events" className="text-emerald-400 hover:underline">
                        Till tävlingar
                    </Link>
                </div>
            </div>
        );
    }

    if (!selectedCourse || courses.length === 0) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-6">
                <div className="max-w-3xl mx-auto">
                    <Link href={`/events/${event.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400">
                        ← Tillbaka till eventet
                    </Link>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mt-4 text-center">
                        <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
                        <p className="text-slate-400">
                            Inga banor finns än. Be arrangören skapa en bana i adminläge.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const missingCodes = virtualCourse.missingControlCodes;
    const canStart = selectedCourse.gpsMode.enabled && missingCodes.length === 0 && virtualCourse.controls.length >= 2;

    if (startRunner) {
        return (
            <TrainingRunner
                eventId={event.id}
                eventName={`${event.name} · ${selectedCourse.name}`}
                courseId={selectedCourse.id}
                userId={user?.uid || ''}
                controls={virtualCourse.controls}
                mapImageUrl={event.map?.imageUrl}
                mapControls={overlayControls}
                showMobileMap={selectedCourse.mobileOptions.allowMobileMap}
                hideRunnerDot={selectedCourse.mobileOptions.hideRunnerDot}
                onSessionComplete={handleSessionComplete}
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <Link href={`/events/${event.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400">
                            ← Tillbaka till eventet
                        </Link>
                        <h1 className="text-3xl font-bold mt-2">{event.name}</h1>
                        <p className="text-slate-400 text-sm">
                            Träningsläge · {formatDate(event.date)} · {event.location || 'Plats saknas'}
                        </p>
                    </div>
                    <a
                        href={`/events/${event.id}/print?course=${selectedCourse.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-500"
                    >
                        PDF/Utskrift
                    </a>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Välj bana
                        </label>
                        <select
                            value={selectedCourseId}
                            onChange={(eventObject) => setSelectedCourseId(eventObject.target.value)}
                            className="w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setStartRunner(true)}
                        disabled={!canStart}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Starta GPS-träning
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Baninformation</h2>
                        <div className="space-y-2 text-sm text-slate-300">
                            <p><strong className="text-white">{selectedCourse.name}</strong></p>
                            <p>{selectedCourse.controlIds.length} kontroller</p>
                            <p>Längd: {formatDistance(selectedCourse.lengthMeters)}</p>
                            <p>GPS-läge: {selectedCourse.gpsMode.enabled ? 'Aktivt' : 'Avstängt'}</p>
                            <p>Mobilkarta: {selectedCourse.mobileOptions.allowMobileMap ? 'Visas' : 'Dold'}</p>
                            <p>Egen GPS-punkt: {selectedCourse.mobileOptions.hideRunnerDot ? 'Dold' : 'Kan visas'}</p>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">GPS-kontroller</h2>
                        <div className="text-sm text-slate-300 space-y-2">
                            <p>{virtualCourse.controls.length} av {selectedCourse.controlIds.length} kontroller har GPS-koordinat.</p>
                            {missingCodes.length > 0 ? (
                                <p className="text-amber-400">
                                    Saknar koordinat: {missingCodes.join(', ')}. Lägg in lat/lng i admin för att aktivera start.
                                </p>
                            ) : (
                                <p className="text-emerald-400">Alla kontroller har koordinater och är klara för träningsläge.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Resultatlista ({selectedCourse.name})
                        </h2>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500">
                            Delad per bana
                        </p>
                    </div>
                    {sharedCourseResults.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            Inga delade pass för banan ännu.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {sharedCourseResults.map((session, index) => (
                                <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {index + 1}. {session.userName || 'Löpare'}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(session.finishedAt).toLocaleString('sv-SE')}
                                            {' · '}
                                            {session.punchedCount}/{session.expectedCount} kontroller
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-emerald-300">{formatElapsed(session.elapsedSeconds)}</p>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                            session.result === 'ok'
                                                ? 'text-emerald-400'
                                                : session.result === 'mp'
                                                    ? 'text-orange-400'
                                                    : 'text-red-400'
                                        }`}>
                                            {session.result}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Senaste träningspass (denna enhet)</h2>
                        {sessionHistory.length > 0 && (
                            <button
                                onClick={() => {
                                    localStorage.removeItem(storageKey);
                                    setSessionHistory([]);
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white"
                            >
                                Rensa
                            </button>
                        )}
                    </div>
                    {sessionHistory.length === 0 ? (
                        <p className="text-sm text-slate-500">Inga pass sparade ännu.</p>
                    ) : (
                        <div className="space-y-2">
                            {sessionHistory.slice(0, 8).map((session) => (
                                <div key={session.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-white">{session.courseName}</p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(session.finishedAt).toLocaleString('sv-SE')}
                                            {' · '}
                                            {session.punchedCount}/{session.expectedCount} kontroller
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-emerald-300">{formatElapsed(session.elapsedSeconds)}</p>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                            session.result === 'ok'
                                                ? 'text-emerald-400'
                                                : session.result === 'mp'
                                                    ? 'text-orange-400'
                                                    : 'text-red-400'
                                        }`}>
                                            {session.result}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {event.map?.imageUrl && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-800">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Kartförhandsvisning</h2>
                        </div>
                        <div className="relative">
                            <img src={event.map.imageUrl} alt="Bankarta" className="w-full h-auto" />
                            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                                {overlayControls.length > 1 && (
                                    <polyline
                                        points={overlayControls.map((control) => `${(control.relX ?? 0) * 100}%,${(control.relY ?? 0) * 100}%`).join(' ')}
                                        stroke="#d926a9"
                                        strokeWidth={2}
                                        fill="none"
                                    />
                                )}
                                {overlayControls.map((control, index) => (
                                    <g key={`${control.id}-${index}`}>
                                        <circle
                                            cx={`${(control.relX ?? 0) * 100}%`}
                                            cy={`${(control.relY ?? 0) * 100}%`}
                                            r={9}
                                            stroke="#d926a9"
                                            strokeWidth={2}
                                            fill="none"
                                        />
                                        <text
                                            x={`${(control.relX ?? 0) * 100}%`}
                                            y={`${(control.relY ?? 0) * 100}%`}
                                            dx={11}
                                            dy={-8}
                                            fill="#ffffff"
                                            stroke="#000000"
                                            strokeWidth={3}
                                            paintOrder="stroke"
                                            fontSize={12}
                                            fontWeight="bold"
                                        >
                                            {control.code}
                                        </text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
