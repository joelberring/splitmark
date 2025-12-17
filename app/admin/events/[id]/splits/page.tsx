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
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 backdrop-blur-md bg-opacity-80 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <Link href={`/admin/events/${eventId}`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors mb-2 inline-block">
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                            <span className="text-emerald-500">📊</span> Sträcktider
                        </h1>
                        <div className="flex gap-3">
                            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-700">
                                📥 WinSplits Export
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Class Selection */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-20"></div>
                    <div className="flex gap-2 flex-wrap">
                        {classes.map((cls: any) => (
                            <button
                                key={cls.id}
                                onClick={() => setSelectedClass(cls.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedClass === cls.id
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                                    }`}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Splits Table */}
                {classEntries.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-24 text-center shadow-2xl">
                        <div className="text-7xl mb-8 opacity-10">📊</div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
                            Inga sträcktider
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Inga deltagare i mål för {getClassName(selectedClass)} ännu
                        </p>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950/50">
                                    <tr>
                                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 sticky left-0 bg-slate-900/95 backdrop-blur-sm z-10 w-12">#</th>
                                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 sticky left-12 bg-slate-900/95 backdrop-blur-sm z-10 min-w-[200px]">Namn</th>
                                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 text-right min-w-[100px]">Total</th>
                                        {controls.map(ctrl => (
                                            <th key={ctrl} className="px-2 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 text-center min-w-[80px]">
                                                {ctrl}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {classEntries.map((entry, index) => {
                                        const totalTime = entry.finishTime && entry.startTime
                                            ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                                            : 0;
                                        const winnerTime = classEntries[0]?.finishTime && classEntries[0]?.startTime
                                            ? new Date(classEntries[0].finishTime).getTime() - new Date(classEntries[0].startTime).getTime()
                                            : 0;

                                        return (
                                            <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-4 py-3 font-black text-slate-600 group-hover:text-slate-400 text-xs sticky left-0 bg-slate-900/95 backdrop-blur-sm z-10">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 sticky left-12 bg-slate-900/95 backdrop-blur-sm z-10">
                                                    <div className="font-black uppercase tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                                                        {entry.firstName} {entry.lastName}
                                                    </div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.clubName}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-mono font-black text-white">{formatTime(totalTime)}</div>
                                                    {index > 0 && (
                                                        <div className="text-[10px] font-mono font-black text-slate-600">
                                                            +{formatTime(totalTime - winnerTime)}
                                                        </div>
                                                    )}
                                                </td>
                                                {entry.splits.map((split: any, i: number) => (
                                                    <td key={i} className="px-2 py-3 text-center">
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
                    </div>
                )}

                {/* Legend */}
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Förklaring</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-6 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">1</span>
                            <span className="text-slate-400">Bästa sträcktid</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-6 flex items-center justify-center bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">2-3</span>
                            <span className="text-slate-400">Topp 3</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-300">Överst:</span>
                            <span className="text-slate-500">Sträcktid</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-300">Underst:</span>
                            <span className="text-slate-500">Total (placering)</span>
                        </div>
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
        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        : position <= 3
            ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
            : 'border border-transparent';

    return (
        <div className={`px-2 py-1.5 rounded-xl transition-all ${positionClass}`}>
            <div className={`font-mono text-[11px] ${isBest ? 'font-black' : 'font-bold'}`}>
                {formatTime(legTime)}
            </div>
            <div className="font-mono text-[9px] font-black opacity-50">
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
