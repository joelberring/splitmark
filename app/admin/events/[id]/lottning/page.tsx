'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import type { Entry } from '@/types/entry';
import {
    lottaMeOS,
    lottaRandom,
    lottaSOFT,
    lottaKlungor,
    gemensamStart,
    calculateLottningStats,
    type StartAssignment,
    type LottningOptions
} from '@/lib/lottning/algorithms';

interface EventClass {
    id: string;
    name: string;
    courseId?: string;
}

export default function LottningPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<EventClass[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    // Lottning options
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [method, setMethod] = useState<'meos' | 'random' | 'soft' | 'klungor' | 'mass'>('meos');
    const [firstStart, setFirstStart] = useState('10:00');
    const [interval, setInterval] = useState(120); // seconds
    const [klungSize, setKlungSize] = useState(5);
    const [clubSeparation, setClubSeparation] = useState(true);
    const [minSeparation, setMinSeparation] = useState(2);

    // Preview
    const [preview, setPreview] = useState<Map<string, StartAssignment[]>>(new Map());
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setClasses(event.classes || []);
                setEntries(event.entries || []);
            }
        }
        setLoading(false);
    };

    const entriesByClass = useMemo(() => {
        const map = new Map<string, Entry[]>();
        entries.forEach(entry => {
            if (!map.has(entry.classId)) {
                map.set(entry.classId, []);
            }
            map.get(entry.classId)!.push(entry);
        });
        return map;
    }, [entries]);

    const handleGeneratePreview = () => {
        const newPreview = new Map<string, StartAssignment[]>();

        let currentStartTime = new Date();
        const [hours, minutes] = firstStart.split(':').map(Number);
        currentStartTime.setHours(hours, minutes, 0, 0);

        const options: LottningOptions = {
            firstStart: currentStartTime,
            interval,
            vacancies: 0,
            clubSeparation,
            minClubSeparation: minSeparation,
        };

        selectedClasses.forEach(classId => {
            const classEntries = entriesByClass.get(classId) || [];

            let assignments: StartAssignment[];

            switch (method) {
                case 'meos':
                    assignments = lottaMeOS(classEntries, options);
                    break;
                case 'random':
                    assignments = lottaRandom(classEntries, options);
                    break;
                case 'soft':
                    assignments = lottaSOFT(classEntries, options);
                    break;
                case 'klungor':
                    assignments = lottaKlungor(classEntries, klungSize, options);
                    break;
                case 'mass':
                    assignments = gemensamStart(classEntries, options.firstStart);
                    break;
                default:
                    assignments = lottaMeOS(classEntries, options);
            }

            newPreview.set(classId, assignments);

            // Update start time for next class
            if (assignments.length > 0) {
                const lastStart = assignments[assignments.length - 1].startTime;
                currentStartTime = new Date(lastStart.getTime() + interval * 1000 * 3); // Gap between classes
            }
        });

        setPreview(newPreview);
        setShowPreview(true);
    };

    const handleApplyLottning = () => {
        const storedEvents = localStorage.getItem('events');
        if (!storedEvents) return;

        const events = JSON.parse(storedEvents);
        const eventIndex = events.findIndex((e: any) => e.id === eventId);
        if (eventIndex < 0) return;

        // Update entries with start times
        const updatedEntries = entries.map(entry => {
            const classAssignments = preview.get(entry.classId);
            if (!classAssignments) return entry;

            const assignment = classAssignments.find(a => a.entryId === entry.id);
            if (!assignment) return entry;

            return {
                ...entry,
                startTime: assignment.startTime.toISOString(),
                updatedAt: new Date().toISOString(),
            };
        });

        events[eventIndex].entries = updatedEntries;
        localStorage.setItem('events', JSON.stringify(events));
        setEntries(updatedEntries);

        alert('Lottning genomförd! Starttider har tilldelats.');
        setShowPreview(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block">
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            🎲 Lottning
                            <HelpButton topic="lottning" />
                        </h1>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {entries.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">📝</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga anmälningar
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Du behöver lägga till anmälningar innan du kan lotta
                        </p>
                        <Link
                            href={`/admin/events/${eventId}/entries`}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold"
                        >
                            Gå till anmälningar
                        </Link>
                    </div>
                ) : !showPreview ? (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Options */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Method Selection */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    Lottningsmetod
                                </h2>

                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { id: 'meos', label: 'MeOS', desc: 'Klubbseparering', icon: '🎯' },
                                        { id: 'random', label: 'Slumpmässig', desc: 'Ren permutation', icon: '🎲' },
                                        { id: 'soft', label: 'SOFT', desc: 'Äldre standard', icon: '📋' },
                                        { id: 'klungor', label: 'Klungstart', desc: 'Gruppstarter', icon: '👥' },
                                        { id: 'mass', label: 'Gemensam', desc: 'Massstart', icon: '🚀' },
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMethod(m.id as any)}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${method === m.id
                                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="text-2xl">{m.icon}</span>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100 mt-1">
                                                {m.label}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {m.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Settings */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    Tidseinställningar
                                </h2>

                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Första start
                                        </label>
                                        <input
                                            type="time"
                                            value={firstStart}
                                            onChange={(e) => setFirstStart(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Startintervall (sek)
                                        </label>
                                        <input
                                            type="number"
                                            value={interval}
                                            onChange={(e) => setInterval(parseInt(e.target.value) || 120)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    {method === 'klungor' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Klungstorlek
                                            </label>
                                            <input
                                                type="number"
                                                value={klungSize}
                                                onChange={(e) => setKlungSize(parseInt(e.target.value) || 5)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                    )}
                                </div>

                                {method === 'meos' && (
                                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={clubSeparation}
                                                    onChange={(e) => setClubSeparation(e.target.checked)}
                                                    className="w-4 h-4 text-emerald-500 rounded"
                                                />
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    Klubbseparering
                                                </span>
                                            </label>
                                            {clubSeparation && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500">Min avstånd:</span>
                                                    <input
                                                        type="number"
                                                        value={minSeparation}
                                                        onChange={(e) => setMinSeparation(parseInt(e.target.value) || 2)}
                                                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <span className="text-sm text-gray-500">starter</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Class Selection */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                                Välj klasser
                            </h2>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                <button
                                    onClick={() => setSelectedClasses(classes.map(c => c.id))}
                                    className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                                >
                                    ✓ Välj alla
                                </button>
                                <button
                                    onClick={() => setSelectedClasses([])}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                >
                                    ✕ Avmarkera alla
                                </button>

                                <hr className="dark:border-gray-700" />

                                {classes.map(cls => {
                                    const count = entriesByClass.get(cls.id)?.length || 0;
                                    return (
                                        <label
                                            key={cls.id}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedClasses.includes(cls.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedClasses([...selectedClasses, cls.id]);
                                                        } else {
                                                            setSelectedClasses(selectedClasses.filter(id => id !== cls.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-emerald-500 rounded"
                                                />
                                                <span className="font-semibold text-gray-800 dark:text-gray-100">
                                                    {cls.name}
                                                </span>
                                            </div>
                                            <span className="text-sm text-gray-500">
                                                {count} st
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={handleGeneratePreview}
                                    disabled={selectedClasses.length === 0}
                                    className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                                >
                                    🎲 Lotta valda klasser
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Preview */
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Förhandsgranskning
                            </h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold"
                                >
                                    ← Tillbaka
                                </button>
                                <button
                                    onClick={handleApplyLottning}
                                    className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                                >
                                    ✓ Verkställ lottning
                                </button>
                            </div>
                        </div>

                        {selectedClasses.map(classId => {
                            const cls = classes.find(c => c.id === classId);
                            const assignments = preview.get(classId) || [];
                            const classEntries = entriesByClass.get(classId) || [];
                            const stats = calculateLottningStats(assignments, classEntries);

                            return (
                                <div key={classId} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                    <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-gray-100">
                                                {cls?.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {stats.totalEntries} deltagare · {stats.clubCount} klubbar ·
                                                Första: {stats.firstStart} · Sista: {stats.lastStart}
                                            </p>
                                        </div>
                                        {method === 'meos' && (
                                            <div className="text-sm text-gray-500">
                                                Klubbsep: min {stats.minClubSeparation}, snitt {stats.avgClubSeparation.toFixed(1)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="max-h-80 overflow-y-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">#</th>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Starttid</th>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Namn</th>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Klubb</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-gray-700 text-sm">
                                                {assignments.map((assignment, index) => {
                                                    const entry = classEntries.find(e => e.id === assignment.entryId);
                                                    return (
                                                        <tr key={assignment.entryId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                                                            <td className="px-4 py-2 font-mono text-gray-800 dark:text-gray-100">
                                                                {assignment.startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-2 font-semibold text-gray-800 dark:text-gray-100">
                                                                {entry ? `${entry.firstName} ${entry.lastName}` : 'Okänd'}
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                                                {entry?.clubName || '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
