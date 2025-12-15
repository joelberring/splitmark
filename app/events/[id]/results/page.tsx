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
        loadData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setEventDate(event.date);
                setClasses(event.classes || []);
                setEntries(event.entries || []);
                setLastUpdated(new Date());
            }
        }
        setLoading(false);
    };

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
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <Link href={`/events/${eventId}`} className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block">
                        ← Tillbaka till tävlingen
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                                {eventName}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {eventDate && new Date(eventDate).toLocaleDateString('sv-SE', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                            <div>🏃 {stats.finished} / {stats.total} i mål</div>
                            {lastUpdated && (
                                <div className="text-xs">
                                    Uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Class Filter */}
                <div className="mb-6 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedClass('all')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${selectedClass === 'all'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                    >
                        Alla klasser
                    </button>
                    {classes.map(cls => (
                        <button
                            key={cls.id}
                            onClick={() => setSelectedClass(cls.id)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${selectedClass === cls.id
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            {cls.name}
                        </button>
                    ))}
                </div>

                {/* Results */}
                {filteredClasses.length === 0 || entries.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">⏳</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga resultat ännu
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Resultat uppdateras automatiskt var 30:e sekund
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredClasses.map(([classId, classEntries]) => {
                            const finishedEntries = classEntries.filter(e => e.status === 'finished' && e.resultStatus === 'ok');
                            const winnerTime = finishedEntries[0]?.finishTime && finishedEntries[0]?.startTime
                                ? new Date(finishedEntries[0].finishTime).getTime() - new Date(finishedEntries[0].startTime).getTime()
                                : null;

                            return (
                                <div key={classId} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                    <div className="p-4 border-b dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                                        <h2 className="font-bold text-xl">{getClassName(classId)}</h2>
                                        <p className="text-emerald-100 text-sm">
                                            {classEntries.filter(e => e.status === 'finished').length} av {classEntries.length} i mål
                                        </p>
                                    </div>

                                    <div className="divide-y dark:divide-gray-700">
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
                                                    className={`p-4 flex items-center justify-between ${position === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                                                            position === 2 ? 'bg-gray-50 dark:bg-gray-700/50' :
                                                                position === 3 ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${position === 1 ? 'bg-yellow-400 text-yellow-900' :
                                                                position === 2 ? 'bg-gray-300 text-gray-700' :
                                                                    position === 3 ? 'bg-orange-400 text-orange-900' :
                                                                        position ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                                                                            'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                                            }`}>
                                                            {position || '-'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                                {entry.firstName} {entry.lastName}
                                                            </div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                {entry.clubName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {isFinished ? (
                                                            <>
                                                                <div className={`text-xl font-mono font-bold ${isOK ? 'text-gray-800 dark:text-gray-100' : 'text-red-600'
                                                                    }`}>
                                                                    {formatTime(entry.startTime, entry.finishTime)}
                                                                </div>
                                                                {!isOK && (
                                                                    <div className="text-xs text-red-500 uppercase">
                                                                        {entry.resultStatus}
                                                                    </div>
                                                                )}
                                                                {diff && diff > 0 && (
                                                                    <div className="text-sm text-gray-500">
                                                                        +{formatTime(undefined, new Date(diff).toISOString())}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-gray-400">-</div>
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
