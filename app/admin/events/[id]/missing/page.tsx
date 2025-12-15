'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import type { Entry } from '@/types/entry';

export default function MissingPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadData();
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
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

    // Calculate missing runners
    const missingRunners = useMemo(() => {
        const now = currentTime;

        return entries
            .filter(entry => {
                // Started but not finished
                if (entry.startTime && !entry.finishTime) {
                    const started = new Date(entry.startTime);
                    return started < now && entry.status !== 'dns' && entry.status !== 'finished';
                }
                return false;
            })
            .map(entry => {
                const startTime = new Date(entry.startTime!);
                const elapsedMs = now.getTime() - startTime.getTime();

                // Find class for expected time
                const entryClass = classes.find((c: any) => c.id === entry.classId);
                const expectedTimeMs = entryClass?.expectedTime || 60 * 60 * 1000; // Default 1 hour
                const overtimeMs = elapsedMs - expectedTimeMs;

                return {
                    ...entry,
                    elapsedMs,
                    expectedTimeMs,
                    overtimeMs,
                    overtimePercent: (elapsedMs / expectedTimeMs) * 100,
                };
            })
            .sort((a, b) => b.overtimeMs - a.overtimeMs); // Most overdue first
    }, [entries, classes, currentTime]);

    // Stats
    const stats = useMemo(() => ({
        total: entries.length,
        started: entries.filter(e => e.status === 'started' || (e.startTime && !e.finishTime)).length,
        finished: entries.filter(e => e.status === 'finished').length,
        missing: missingRunners.length,
        overdue: missingRunners.filter(r => r.overtimeMs > 0).length,
        critical: missingRunners.filter(r => r.overtimePercent > 150).length,
    }), [entries, missingRunners]);

    const formatElapsed = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m ${seconds}s`;
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
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            🌲 Kvar i Skogen
                            <HelpButton topic="missing" />
                        </h1>
                        <div className="text-lg font-mono text-gray-600 dark:text-gray-400">
                            {currentTime.toLocaleTimeString('sv-SE')}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats */}
                <div className="grid grid-cols-6 gap-4 mb-6">
                    <StatCard label="Anmälda" value={stats.total} color="gray" />
                    <StatCard label="Startade" value={stats.started} color="blue" />
                    <StatCard label="I mål" value={stats.finished} color="emerald" />
                    <StatCard label="Kvar" value={stats.missing} color="yellow" />
                    <StatCard label="Försenade" value={stats.overdue} color="orange" />
                    <StatCard label="Kritiska" value={stats.critical} color="red" highlight={stats.critical > 0} />
                </div>

                {/* Missing Runners */}
                {missingRunners.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Alla i mål!
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Inga deltagare saknas just nu
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Namn</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Klubb</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Klass</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Starttid</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Ute</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Förväntat</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Kontakt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {missingRunners.map((runner) => (
                                    <tr
                                        key={runner.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${runner.overtimePercent > 150
                                            ? 'bg-red-50 dark:bg-red-900/20'
                                            : runner.overtimeMs > 0
                                                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                                                : ''
                                            }`}
                                    >
                                        <td className="px-4 py-4">
                                            <StatusIndicator overtimePercent={runner.overtimePercent} />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-800 dark:text-gray-100">
                                                {runner.firstName} {runner.lastName}
                                            </div>
                                            {runner.siCard && (
                                                <div className="text-xs text-gray-500 font-mono">
                                                    SI: {runner.siCard}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                                            {runner.clubName}
                                        </td>
                                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                                            {getClassName(runner.classId)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-gray-600 dark:text-gray-400">
                                            {runner.startTime
                                                ? new Date(runner.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className={`font-mono font-bold ${runner.overtimePercent > 150
                                                ? 'text-red-600 dark:text-red-400'
                                                : runner.overtimeMs > 0
                                                    ? 'text-yellow-600 dark:text-yellow-400'
                                                    : 'text-gray-800 dark:text-gray-100'
                                                }`}>
                                                {formatElapsed(runner.elapsedMs)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right text-gray-500 font-mono">
                                            ~{formatElapsed(runner.expectedTimeMs)}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {runner.phone ? (
                                                <a
                                                    href={`tel:${runner.phone}`}
                                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm"
                                                >
                                                    📞 Ring
                                                </a>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Export Button */}
                {missingRunners.length > 0 && (
                    <div className="mt-4 flex gap-4">
                        <button
                            onClick={() => exportToCSV(missingRunners)}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        >
                            📄 Exportera till CSV
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                        >
                            🖨️ Skriv ut
                        </button>
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        💡 Statusindikering
                    </h3>
                    <div className="flex gap-6 text-sm text-blue-700 dark:text-blue-300">
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Normal
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-500"></span> Försenad (100-150%)
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Kritisk (&gt;150%)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    function exportToCSV(runners: typeof missingRunners) {
        const headers = ['Namn', 'Klubb', 'Klass', 'Starttid', 'Ute', 'Förväntat', 'Telefon', 'Email'];
        const rows = runners.map(r => [
            `${r.firstName} ${r.lastName}`,
            r.clubName || '',
            getClassName(r.classId),
            r.startTime ? new Date(r.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '',
            formatElapsed(r.elapsedMs),
            formatElapsed(r.expectedTimeMs),
            r.phone || '',
            r.email || ''
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `kvar-i-skogen-${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
    }
}

function StatCard({
    label,
    value,
    color,
    highlight = false
}: {
    label: string;
    value: number;
    color: string;
    highlight?: boolean;
}) {
    const colors: Record<string, string> = {
        gray: 'text-gray-600 dark:text-gray-400',
        blue: 'text-blue-600 dark:text-blue-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        yellow: 'text-yellow-600 dark:text-yellow-400',
        orange: 'text-orange-600 dark:text-orange-400',
        red: 'text-red-600 dark:text-red-400',
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center ${highlight ? 'ring-2 ring-red-500 animate-pulse' : ''
            }`}>
            <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        </div>
    );
}

function StatusIndicator({ overtimePercent }: { overtimePercent: number }) {
    if (overtimePercent > 150) {
        return (
            <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400">KRITISK</span>
            </div>
        );
    }
    if (overtimePercent > 100) {
        return (
            <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
                <span className="text-xs text-yellow-600 dark:text-yellow-400">Försenad</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">OK</span>
        </div>
    );
}
