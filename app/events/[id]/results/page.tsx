'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Entry } from '@/types/entry';

interface EventClass {
    id: string;
    name: string;
}

export default function PublicResultsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<EventClass[]>([]);
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('all');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        let unsubscribeResults = () => { };

        const init = async () => {
            try {
                const { getEvent } = await import('@/lib/firestore/events');
                const { subscribeToResults } = await import('@/lib/firestore/results');

                const event = await getEvent(eventId);
                if (event) {
                    setEventName(event.name);
                    setEventDate(event.date);
                    setClasses(event.classes || []);

                    unsubscribeResults = subscribeToResults(eventId, (updatedResults) => {
                        setEntries(updatedResults as any);
                        setLastUpdated(new Date());
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error initializing results listener:', error);
                setLoading(false);
            }
        };

        init();

        return () => unsubscribeResults();
    }, [eventId]);

    // Results by class
    const resultsByClass = useMemo(() => {
        const byClass = new Map<string, Entry[]>();

        entries.forEach(entry => {
            if (!byClass.has(entry.classId)) {
                byClass.set(entry.classId, []);
            }
            byClass.get(entry.classId)!.push(entry);
        });

        // Sort by finish position
        byClass.forEach((classEntries) => {
            classEntries.sort((a, b) => {
                if (a.status === 'finished' && b.status !== 'finished') return -1;
                if (a.status !== 'finished' && b.status === 'finished') return 1;

                if (a.finishTime && b.finishTime && a.startTime && b.startTime) {
                    const timeA = new Date(a.finishTime).getTime() - new Date(a.startTime).getTime();
                    const timeB = new Date(b.finishTime).getTime() - new Date(b.startTime).getTime();
                    return timeA - timeB;
                }
                return 0;
            });
        });

        return byClass;
    }, [entries]);

    const filteredClasses = useMemo(() => {
        if (selectedClass === 'all') {
            return Array.from(resultsByClass.entries());
        }
        const classEntries = resultsByClass.get(selectedClass);
        return classEntries ? [[selectedClass, classEntries] as [string, Entry[]]] : [];
    }, [resultsByClass, selectedClass]);

    const stats = useMemo(() => ({
        total: entries.length,
        finished: entries.filter(e => e.status === 'finished').length,
        ok: entries.filter(e => e.resultStatus === 'ok').length,
        mp: entries.filter(e => e.resultStatus === 'mp').length,
    }), [entries]);

    const formatTime = (startTime?: string, finishTime?: string): string => {
        if (!startTime || !finishTime) return '-';
        const ms = new Date(finishTime).getTime() - new Date(startTime).getTime();
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getClassName = (classId: string): string => {
        return classes.find(c => c.id === classId)?.name || 'Okänd';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <Link href={`/events/${eventId}`} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-3 inline-block transition-colors">
                        ← Tillbaka till tävlingen
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold uppercase tracking-tight text-white">
                                {eventName}
                            </h1>
                            <p className="text-slate-400 mt-1">
                                {eventDate && new Date(eventDate).toLocaleDateString('sv-SE', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">
                            <div className="mb-1 text-emerald-500 font-black">🏃 {stats.finished} / {stats.total} i mål</div>
                            {lastUpdated && (
                                <div className="text-[10px] opacity-70">
                                    Uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Class Filter */}
                <div className="mb-8 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedClass('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${selectedClass === 'all'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                            }`}
                    >
                        Alla klasser
                    </button>
                    {classes.map(cls => (
                        <button
                            key={cls.id}
                            onClick={() => setSelectedClass(cls.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${selectedClass === cls.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                                }`}
                        >
                            {cls.name}
                        </button>
                    ))}
                </div>

                {/* Results */}
                {filteredClasses.length === 0 || entries.length === 0 ? (
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
                        <div className="text-6xl mb-6 opacity-30">⏳</div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-2">
                            Inga resultat ännu
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">
                            Resultat uppdateras automatiskt var 30:e sekund
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredClasses.map(([classId, classEntries]) => {
                            const finishedEntries = classEntries.filter(e => e.status === 'finished' && e.resultStatus === 'ok');
                            const winnerTime = finishedEntries[0]?.finishTime && finishedEntries[0]?.startTime
                                ? new Date(finishedEntries[0].finishTime).getTime() - new Date(finishedEntries[0].startTime).getTime()
                                : null;

                            return (
                                <div key={classId} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                    <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                                        <div>
                                            <h2 className="font-black text-2xl uppercase tracking-tight text-white">{getClassName(classId)}</h2>
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                {classEntries.filter(e => e.status === 'finished').length} av {classEntries.length} i mål
                                            </p>
                                        </div>
                                        <Link href={`/events/${eventId}/results/${classId}`} className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
                                            Visa detaljer →
                                        </Link>
                                    </div>

                                    <div className="divide-y divide-slate-800/50">
                                        {classEntries.slice(0, 50).map((entry, index) => {
                                            const isFinished = entry.status === 'finished';
                                            const isOK = entry.resultStatus === 'ok';
                                            const time = entry.startTime && entry.finishTime
                                                ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                                                : null;
                                            const diff = time && winnerTime && isOK ? time - winnerTime : null;
                                            const position = isOK ? finishedEntries.findIndex(e => e.id === entry.id) + 1 : null;

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className={`py-1 px-4 flex items-center justify-between transition-colors hover:bg-slate-800/30 ${position === 1 ? 'bg-emerald-500/5' :
                                                        position === 2 ? 'bg-slate-400/5' :
                                                            position === 3 ? 'bg-amber-500/5' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-[10px] ${position === 1 ? 'bg-emerald-500 text-slate-950' :
                                                            position === 2 ? 'bg-slate-400 text-slate-950' :
                                                                position === 3 ? 'bg-amber-500 text-slate-950' :
                                                                    position ? 'bg-slate-800 text-slate-400' :
                                                                        'bg-slate-800/50 text-slate-600'
                                                            }`}>
                                                            {position || '-'}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-white leading-tight">
                                                                {entry.firstName} {entry.lastName}
                                                            </div>
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                                                                {entry.clubName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {isFinished ? (
                                                            <>
                                                                <div className={`text-xl font-mono font-black ${isOK ? 'text-white' : 'text-red-500'
                                                                    }`}>
                                                                    {formatTime(entry.startTime, entry.finishTime)}
                                                                </div>
                                                                {!isOK && (
                                                                    <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-0.5">
                                                                        {entry.resultStatus}
                                                                    </div>
                                                                )}
                                                                {diff && diff > 0 && (
                                                                    <div className="text-xs font-bold text-slate-500 mt-0.5">
                                                                        +{formatTime(undefined, new Date(diff).toISOString())}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-slate-700 font-bold uppercase tracking-widest text-xs">På banan</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
