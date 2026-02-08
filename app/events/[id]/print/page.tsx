'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getEvent } from '@/lib/firestore/events';
import type { StoredEvent } from '@/types/event';
import {
    getCourseControls,
    normalizePlanningControls,
    normalizePlanningCourses,
} from '@/lib/events/course-planning';

export default function EventCoursePrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const eventId = params.id as string;
    const selectedCourseFromQuery = searchParams.get('course') || '';

    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<StoredEvent | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState(selectedCourseFromQuery);

    useEffect(() => {
        const load = async () => {
            try {
                const found = await getEvent(eventId);
                if (found) {
                    const nextEvent = found as unknown as StoredEvent;
                    setEvent(nextEvent);
                    const normalizedCourses = normalizePlanningCourses((nextEvent as any).ppenCourses);
                    if (normalizedCourses.length > 0) {
                        const firstCourseId = normalizedCourses[0].id;
                        setSelectedCourseId(selectedCourseFromQuery || firstCourseId);
                    }
                }
            } catch (error) {
                console.error('Kunde inte läsa event för utskrift:', error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [eventId, selectedCourseFromQuery]);

    const controls = useMemo(
        () => normalizePlanningControls((event as any)?.ppenControls),
        [event]
    );
    const courses = useMemo(
        () => normalizePlanningCourses((event as any)?.ppenCourses),
        [event]
    );
    const selectedCourse = useMemo(
        () => courses.find((course) => course.id === selectedCourseId) || courses[0] || null,
        [courses, selectedCourseId]
    );
    const selectedControls = useMemo(
        () => getCourseControls(selectedCourse, controls),
        [selectedCourse, controls]
    );
    const printableControls = useMemo(
        () =>
            selectedControls.filter((control) =>
                typeof control.relX === 'number'
                && Number.isFinite(control.relX)
                && typeof control.relY === 'number'
                && Number.isFinite(control.relY)
            ),
        [selectedControls]
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700" />
            </div>
        );
    }

    if (!event || !selectedCourse || !event.map?.imageUrl) {
        return (
            <div className="min-h-screen bg-white p-8">
                <div className="max-w-3xl mx-auto">
                    <p className="text-xl font-bold mb-4">Utskrift kunde inte skapas</p>
                    <p className="text-slate-600 mb-6">
                        Kontrollera att eventet har karta och minst en bana.
                    </p>
                    <Link href={`/events/${eventId}`} className="text-blue-600 hover:underline">
                        Tillbaka till eventet
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-black">
            <style jsx global>{`
                @media print {
                    .print-toolbar {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                    }
                    .print-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        max-width: none !important;
                    }
                }
            `}</style>

            <div className="print-toolbar sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-700">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link href={`/events/${event.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white">
                            ← Till event
                        </Link>
                        <Link href={`/events/${event.id}/training?course=${selectedCourse.id}`} className="text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white">
                            Träningsläge
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Bana
                        </label>
                        <select
                            value={selectedCourseId}
                            onChange={(eventObject) => setSelectedCourseId(eventObject.target.value)}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                        >
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-emerald-500"
                        >
                            Skriv ut / PDF
                        </button>
                    </div>
                </div>
            </div>

            <main className="print-page max-w-5xl mx-auto p-4 md:p-8">
                <header className="mb-4 border-b border-slate-300 pb-4">
                    <h1 className="text-2xl font-bold">{event.name}</h1>
                    <p className="text-slate-600 text-sm mt-1">
                        Bana: {selectedCourse.name}
                        {selectedCourse.lengthMeters ? ` · ${(selectedCourse.lengthMeters / 1000).toFixed(2)} km` : ''}
                        {selectedCourse.climbMeters ? ` · ${selectedCourse.climbMeters} m stigning` : ''}
                    </p>
                </header>

                <section className="border border-slate-300 rounded overflow-hidden">
                    <div className="relative">
                        <img src={event.map.imageUrl} alt="Utskriftskarta" className="w-full h-auto" />
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                            {printableControls.length > 1 && (
                                <polyline
                                    points={printableControls.map((control) => `${(control.relX ?? 0) * 100}%,${(control.relY ?? 0) * 100}%`).join(' ')}
                                    stroke="#d926a9"
                                    strokeWidth={2}
                                    fill="none"
                                />
                            )}
                            {printableControls.map((control, index) => (
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
                                        fill="#111827"
                                        stroke="#ffffff"
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
                </section>

                <section className="mt-4 border border-slate-300 rounded p-4">
                    <h2 className="font-bold text-sm uppercase tracking-widest text-slate-700 mb-3">Kontrollbeskrivning</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-300">
                                <th className="text-left py-2">#</th>
                                <th className="text-left py-2">Kod</th>
                                <th className="text-left py-2">Typ</th>
                                <th className="text-left py-2">Beskrivning</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedControls.map((control, index) => (
                                <tr key={`table-${control.id}-${index}`} className="border-b border-slate-200 last:border-b-0">
                                    <td className="py-2">{index + 1}</td>
                                    <td className="py-2 font-bold">{control.code}</td>
                                    <td className="py-2 capitalize">{control.type}</td>
                                    <td className="py-2">{control.description || '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </main>
        </div>
    );
}
