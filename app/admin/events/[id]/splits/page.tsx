'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Entry } from '@/types/entry';

export default function SplitsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('');

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
                if (event.classes?.length > 0) {
                    setSelectedClass(event.classes[0].id);
                }
            }
        }
        setLoading(false);
    };

    // Demo split data
    const classEntries = useMemo(() => {
        return entries
            .filter(e => e.classId === selectedClass && e.status === 'finished')
            .map(entry => ({
                ...entry,
                splits: generateDemoSplits(entry),
            }))
            .sort((a, b) => {
                const timeA = a.finishTime && a.startTime
                    ? new Date(a.finishTime).getTime() - new Date(a.startTime).getTime()
                    : Infinity;
                const timeB = b.finishTime && b.startTime
                    ? new Date(b.finishTime).getTime() - new Date(b.startTime).getTime()
                    : Infinity;
                return timeA - timeB;
            });
    }, [entries, selectedClass]);

    // Control headers (demo)
    const controls = ['S', '1', '2', '3', '4', '5', '6', 'F'];

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getClassName = (classId: string): string => {
        return classes.find((c: any) => c.id === classId)?.name || 'Okänd';
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
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                            📊 Sträcktider
                        </h1>
                        <div className="flex gap-3">
                            <button className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600">
                                📥 WinSplits Export
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Class Selection */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex gap-2 flex-wrap">
                        {classes.map((cls: any) => (
                            <button
                                key={cls.id}
                                onClick={() => setSelectedClass(cls.id)}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${selectedClass === cls.id
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Splits Table */}
                {classEntries.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">📊</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga sträcktider
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Inga deltagare i mål för {getClassName(selectedClass)} ännu
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-700">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 sticky left-8 bg-gray-50 dark:bg-gray-700 min-w-[150px]">Namn</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">Total</th>
                                    {controls.map(ctrl => (
                                        <th key={ctrl} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[60px]">
                                            {ctrl}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700 text-sm">
                                {classEntries.map((entry, index) => {
                                    const totalTime = entry.finishTime && entry.startTime
                                        ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                                        : 0;
                                    const winnerTime = classEntries[0]?.finishTime && classEntries[0]?.startTime
                                        ? new Date(classEntries[0].finishTime).getTime() - new Date(classEntries[0].startTime).getTime()
                                        : 0;

                                    return (
                                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800">
                                                {index + 1}
                                            </td>
                                            <td className="px-3 py-2 sticky left-8 bg-white dark:bg-gray-800">
                                                <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                    {entry.firstName} {entry.lastName}
                                                </div>
                                                <div className="text-xs text-gray-500">{entry.clubName}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-gray-800 dark:text-gray-100">
                                                {formatTime(totalTime)}
                                                {index > 0 && (
                                                    <div className="text-xs text-gray-500">
                                                        +{formatTime(totalTime - winnerTime)}
                                                    </div>
                                                )}
                                            </td>
                                            {entry.splits.map((split: any, i: number) => (
                                                <td key={i} className="px-2 py-2 text-center">
                                                    <SplitCell
                                                        legTime={split.legTime}
                                                        cumTime={split.cumTime}
                                                        position={split.position}
                                                        isBest={split.position === 1}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legend */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Förklaring</h3>
                    <div className="flex gap-6 text-sm">
                        <span className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">1</span>
                            Bästa sträcktid
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">2-3</span>
                            Topp 3
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Överst:</span> Sträcktid
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Underst:</span> Kumulativ (placering)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SplitCell({
    legTime,
    cumTime,
    position,
    isBest,
}: {
    legTime: number;
    cumTime: number;
    position: number;
    isBest: boolean;
}) {
    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const positionClass = position === 1
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        : position <= 3
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
            : '';

    return (
        <div className={`px-1 py-0.5 rounded ${positionClass}`}>
            <div className={`font-mono text-xs ${isBest ? 'font-bold' : ''}`}>
                {formatTime(legTime)}
            </div>
            <div className="font-mono text-[10px] text-gray-500">
                {formatTime(cumTime)} ({position})
            </div>
        </div>
    );
}

// Generate demo splits for testing
function generateDemoSplits(entry: Entry) {
    const controls = 8;
    const splits = [];
    let cumTime = 0;

    for (let i = 0; i < controls; i++) {
        const legTime = (180 + Math.random() * 120) * 1000; // 3-5 min per leg
        cumTime += legTime;
        splits.push({
            control: i === 0 ? 'S' : i === controls - 1 ? 'F' : i.toString(),
            legTime,
            cumTime,
            position: Math.floor(Math.random() * 10) + 1,
        });
    }

    return splits;
}
