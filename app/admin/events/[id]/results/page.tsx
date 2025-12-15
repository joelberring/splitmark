'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import ExportPanel from '@/components/Admin/ExportPanel';
import type { Entry, EntryWithResult, ResultStatus } from '@/types/entry';

export default function ResultsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedClass, setSelectedClass] = useState('all');
    const [showStatus, setShowStatus] = useState<string>('all');

    // Edit modal
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
    const [showExportPanel, setShowExportPanel] = useState(false);

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

    const saveEntries = (newEntries: Entry[]) => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const index = events.findIndex((e: any) => e.id === eventId);
            if (index >= 0) {
                events[index].entries = newEntries;
                localStorage.setItem('events', JSON.stringify(events));
            }
        }
        setEntries(newEntries);
    };

    // Calculate results by class
    const resultsByClass = useMemo(() => {
        const byClass = new Map<string, Entry[]>();

        entries.forEach(entry => {
            if (!byClass.has(entry.classId)) {
                byClass.set(entry.classId, []);
            }
            byClass.get(entry.classId)!.push(entry);
        });

        // Sort each class by finish time or status
        byClass.forEach((classEntries, classId) => {
            classEntries.sort((a, b) => {
                // Finished entries first
                if (a.status === 'finished' && b.status !== 'finished') return -1;
                if (a.status !== 'finished' && b.status === 'finished') return 1;

                // Sort finished by time
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

    // Filtered results
    const filteredClasses = useMemo(() => {
        if (selectedClass === 'all') {
            return Array.from(resultsByClass.entries());
        }
        const classEntries = resultsByClass.get(selectedClass);
        return classEntries ? [[selectedClass, classEntries] as [string, Entry[]]] : [];
    }, [resultsByClass, selectedClass]);

    // Stats
    const stats = useMemo(() => ({
        total: entries.length,
        finished: entries.filter(e => e.status === 'finished').length,
        ok: entries.filter(e => e.resultStatus === 'ok').length,
        mp: entries.filter(e => e.resultStatus === 'mp').length,
        dnf: entries.filter(e => e.resultStatus === 'dnf' || e.status === 'dnf').length,
        dsq: entries.filter(e => e.resultStatus === 'dsq' || e.status === 'dsq').length,
        dns: entries.filter(e => e.status === 'dns').length,
    }), [entries]);

    const handleUpdateEntry = (entry: Entry, updates: Partial<Entry>) => {
        const updated = entries.map(e =>
            e.id === entry.id
                ? { ...e, ...updates, updatedAt: new Date().toISOString() }
                : e
        );
        saveEntries(updated);
        setEditingEntry(null);
    };

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
        return classes.find((c: any) => c.id === classId)?.name || 'Okänd';
    };

    const handleExport = (format: 'iof' | 'csv') => {
        if (format === 'iof') {
            // Generate IOF XML 3.0 ResultList
            let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ResultList xmlns="http://www.orienteering.org/datastandard/3.0" 
            iofVersion="3.0"
            createTime="${new Date().toISOString()}">
  <Event>
    <Name>${eventName}</Name>
  </Event>`;

            resultsByClass.forEach((classEntries, classId) => {
                xml += `
  <ClassResult>
    <Class>
      <Name>${getClassName(classId)}</Name>
    </Class>`;

                classEntries.forEach((entry, index) => {
                    const time = entry.startTime && entry.finishTime
                        ? Math.floor((new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()) / 1000)
                        : null;
                    const position = entry.resultStatus === 'ok'
                        ? classEntries.filter(e => e.resultStatus === 'ok').findIndex(e => e.id === entry.id) + 1
                        : null;
                    const status = entry.resultStatus === 'ok' ? 'OK'
                        : entry.resultStatus === 'mp' ? 'MissingPunch'
                            : entry.resultStatus === 'dnf' ? 'DidNotFinish'
                                : entry.resultStatus === 'dsq' ? 'Disqualified'
                                    : entry.status === 'dns' ? 'DidNotStart'
                                        : 'OK';

                    xml += `
    <PersonResult>
      <Person>
        <Name>
          <Family>${entry.lastName}</Family>
          <Given>${entry.firstName}</Given>
        </Name>
      </Person>
      <Organisation>
        <Name>${entry.clubName}</Name>
      </Organisation>
      <Result>
        <Status>${status}</Status>
        ${time ? `<Time>${time}</Time>` : ''}
        ${position ? `<Position>${position}</Position>` : ''}
      </Result>
    </PersonResult>`;
                });

                xml += `
  </ClassResult>`;
            });

            xml += `
</ResultList>`;

            // Download XML
            const blob = new Blob([xml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${eventName.replace(/\s+/g, '_')}_results.xml`;
            a.click();
            URL.revokeObjectURL(url);
        }
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
                            🏆 Resultat
                            <HelpButton topic="results" />
                        </h1>
                        <div className="flex gap-3">
                            <Link
                                href={`/admin/events/${eventId}/splits`}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600"
                            >
                                📊 Sträcktider
                            </Link>
                            <div className="relative flex gap-2">
                                <button
                                    onClick={() => setShowExportPanel(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                                >
                                    📤 Exportera
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats */}
                <div className="grid grid-cols-7 gap-4 mb-6">
                    <StatCard label="Totalt" value={stats.total} color="gray" />
                    <StatCard label="I mål" value={stats.finished} color="blue" />
                    <StatCard label="OK" value={stats.ok} color="emerald" />
                    <StatCard label="Felst." value={stats.mp} color="orange" />
                    <StatCard label="DNF" value={stats.dnf} color="red" />
                    <StatCard label="DSQ" value={stats.dsq} color="red" />
                    <StatCard label="DNS" value={stats.dns} color="gray" />
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex gap-4 items-center">
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="all">Alla klasser</option>
                            {classes.map((cls: any) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>

                        <div className="flex gap-2">
                            {['all', 'ok', 'mp', 'dnf', 'dsq', 'dns'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setShowStatus(status)}
                                    className={`px-3 py-1 rounded-lg text-sm font-semibold ${showStatus === status
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                >
                                    {status === 'all' ? 'Alla' : status.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Results by Class */}
                <div className="space-y-6">
                    {filteredClasses.map(([classId, classEntries]) => {
                        const className = getClassName(classId);
                        const finishedEntries = classEntries.filter(e => e.status === 'finished');
                        const winnerTime = finishedEntries[0]?.finishTime && finishedEntries[0]?.startTime
                            ? new Date(finishedEntries[0].finishTime).getTime() - new Date(finishedEntries[0].startTime).getTime()
                            : null;

                        // Apply status filter
                        const displayEntries = showStatus === 'all'
                            ? classEntries
                            : classEntries.filter(e =>
                                e.resultStatus === showStatus ||
                                e.status === showStatus ||
                                (showStatus === 'ok' && e.resultStatus === 'ok')
                            );

                        if (displayEntries.length === 0) return null;

                        return (
                            <div key={classId} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                    <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                                        {className}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {finishedEntries.length} av {classEntries.length} i mål
                                    </p>
                                </div>

                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-16">Plac.</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Namn</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Klubb</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Tid</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Diff</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Åtgärd</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700 text-sm">
                                        {displayEntries.map((entry, index) => {
                                            const time = entry.startTime && entry.finishTime
                                                ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                                                : null;
                                            const diff = time && winnerTime ? time - winnerTime : null;
                                            const position = entry.status === 'finished' && entry.resultStatus === 'ok'
                                                ? finishedEntries.filter(e => e.resultStatus === 'ok').findIndex(e => e.id === entry.id) + 1
                                                : null;

                                            return (
                                                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">
                                                        {position || '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                            {entry.firstName} {entry.lastName}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                                        {entry.clubName}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-800 dark:text-gray-100">
                                                        {formatTime(entry.startTime, entry.finishTime)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                                                        {diff && diff > 0 ? `+${formatTime(undefined, new Date(diff).toISOString())}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <StatusBadge status={entry.resultStatus || entry.status} />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => setEditingEntry(entry)}
                                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                                        >
                                                            Redigera
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>

                {entries.length === 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga resultat ännu
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Anslut SportIdent-station och läs av brickor för att registrera resultat
                        </p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingEntry && (
                <EditResultModal
                    entry={editingEntry}
                    onSave={(updates) => handleUpdateEntry(editingEntry, updates)}
                    onClose={() => setEditingEntry(null)}
                />
            )}

            {/* Export Panel */}
            {showExportPanel && (
                <ExportPanel
                    entries={entries}
                    classes={classes}
                    eventName={eventName}
                    eventDate={new Date().toISOString().slice(0, 10)}
                    onClose={() => setShowExportPanel(false)}
                />
            )}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        gray: 'text-gray-600 dark:text-gray-400',
        blue: 'text-blue-600 dark:text-blue-400',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        orange: 'text-orange-600 dark:text-orange-400',
        red: 'text-red-600 dark:text-red-400',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
            <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        mp: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        dnf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        dsq: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        dns: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        finished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        registered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || styles.registered}`}>
            {status?.toUpperCase() || 'REG'}
        </span>
    );
}

function EditResultModal({
    entry,
    onSave,
    onClose,
}: {
    entry: Entry;
    onSave: (updates: Partial<Entry>) => void;
    onClose: () => void;
}) {
    const [status, setStatus] = useState<string>(entry.resultStatus || entry.status || 'registered');
    const [comment, setComment] = useState(entry.comment || '');

    const handleSave = () => {
        const updates: Partial<Entry> = { comment };

        if (['ok', 'mp', 'dnf', 'dsq'].includes(status)) {
            updates.resultStatus = status as ResultStatus;
            updates.status = 'finished';
        } else if (status === 'dns') {
            updates.status = 'dns';
            updates.resultStatus = 'dns';
        }

        onSave(updates);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    Redigera resultat
                </h2>

                <div className="mb-4">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                        {entry.firstName} {entry.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{entry.clubName}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Status
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'ok', label: 'OK', color: 'emerald' },
                                { id: 'mp', label: 'Felst.', color: 'orange' },
                                { id: 'dnf', label: 'DNF', color: 'red' },
                                { id: 'dsq', label: 'DSQ', color: 'red' },
                                { id: 'dns', label: 'DNS', color: 'gray' },
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setStatus(s.id)}
                                    className={`px-3 py-2 rounded-lg font-semibold text-sm ${status === s.id
                                        ? s.color === 'emerald' ? 'bg-emerald-500 text-white'
                                            : s.color === 'orange' ? 'bg-orange-500 text-white'
                                                : s.color === 'red' ? 'bg-red-500 text-white'
                                                    : 'bg-gray-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Kommentar
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                            placeholder="T.ex. orsak till DSQ..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            Spara
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
