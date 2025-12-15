'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import type { Entry, EntryStatus } from '@/types/entry';

interface EventClass {
    id: string;
    name: string;
}

export default function EntriesPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<EventClass[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = () => {
        // Load event
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

    // Filtered entries
    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const fullName = `${entry.firstName} ${entry.lastName}`.toLowerCase();
                const club = entry.clubName.toLowerCase();
                const siCard = entry.siCard?.toLowerCase() || '';
                if (!fullName.includes(query) && !club.includes(query) && !siCard.includes(query)) {
                    return false;
                }
            }

            // Class filter
            if (filterClass !== 'all' && entry.classId !== filterClass) {
                return false;
            }

            // Status filter
            if (filterStatus !== 'all' && entry.status !== filterStatus) {
                return false;
            }

            return true;
        });
    }, [entries, searchQuery, filterClass, filterStatus]);

    // Stats
    const stats = useMemo(() => ({
        total: entries.length,
        registered: entries.filter(e => e.status === 'registered').length,
        started: entries.filter(e => e.status === 'started').length,
        finished: entries.filter(e => e.status === 'finished').length,
        dns: entries.filter(e => e.status === 'dns').length,
        late: entries.filter(e => e.entryType === 'late').length,
    }), [entries]);

    const handleAddEntry = (entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newEntry: Entry = {
            ...entry,
            id: `entry-${Date.now()}`,
            eventId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        saveEntries([...entries, newEntry]);
        setShowAddModal(false);
    };

    const handleUpdateEntry = (entry: Entry) => {
        const updated = entries.map(e =>
            e.id === entry.id
                ? { ...entry, updatedAt: new Date().toISOString() }
                : e
        );
        saveEntries(updated);
        setEditingEntry(null);
    };

    const handleDeleteEntry = (entryId: string) => {
        if (confirm('Ta bort denna anmälan?')) {
            saveEntries(entries.filter(e => e.id !== entryId));
        }
    };

    const handleImportCSV = (csvData: string) => {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

        const newEntries: Entry[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
            });

            // Map common column names
            const firstName = row['förnamn'] || row['firstname'] || row['first'] || '';
            const lastName = row['efternamn'] || row['lastname'] || row['last'] || row['surname'] || '';
            const club = row['klubb'] || row['club'] || row['organisation'] || '';
            const className = row['klass'] || row['class'] || '';
            const siCard = row['si'] || row['sicard'] || row['bricka'] || row['card'] || '';

            if (firstName && lastName) {
                // Find or create class
                let classId = classes.find(c => c.name.toLowerCase() === className.toLowerCase())?.id;
                if (!classId && className) {
                    // Add to message about missing classes
                }

                newEntries.push({
                    id: `entry-${Date.now()}-${i}`,
                    eventId,
                    firstName,
                    lastName,
                    clubId: undefined,
                    clubName: club,
                    classId: classId || '',
                    className: className,
                    siCard: siCard || undefined,
                    status: 'registered',
                    entryType: 'normal',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        if (newEntries.length > 0) {
            saveEntries([...entries, ...newEntries]);
            alert(`${newEntries.length} deltagare importerade!`);
        }
        setShowImportModal(false);
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
                            📝 Anmälningar
                            <HelpButton topic="entries" />
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
                            >
                                📥 Importera
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                            >
                                + Lägg till
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats */}
                <div className="grid grid-cols-6 gap-4 mb-6">
                    <StatCard label="Totalt" value={stats.total} color="gray" />
                    <StatCard label="Anmälda" value={stats.registered} color="blue" />
                    <StatCard label="Startade" value={stats.started} color="yellow" />
                    <StatCard label="I mål" value={stats.finished} color="emerald" />
                    <StatCard label="DNS" value={stats.dns} color="red" />
                    <StatCard label="Efteranm." value={stats.late} color="purple" />
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Sök namn, klubb eller SI-nummer..."
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="all">Alla klasser</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="all">Alla status</option>
                            <option value="registered">Anmäld</option>
                            <option value="started">Startad</option>
                            <option value="finished">I mål</option>
                            <option value="dns">DNS</option>
                            <option value="dnf">DNF</option>
                            <option value="dsq">DSQ</option>
                        </select>
                    </div>
                </div>

                {/* Entries Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                    {filteredEntries.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">📝</div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                {entries.length === 0 ? 'Inga anmälningar ännu' : 'Inga resultat för sökningen'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                {entries.length === 0
                                    ? 'Importera från Eventor eller lägg till manuellt'
                                    : 'Prova att ändra sökvillkoren'
                                }
                            </p>
                            {entries.length === 0 && (
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setShowImportModal(true)}
                                        className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold"
                                    >
                                        📥 Importera CSV
                                    </button>
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold"
                                    >
                                        + Lägg till manuellt
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Namn</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Klubb</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Klass</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">SI-bricka</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Starttid</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Åtgärder</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {entry.firstName} {entry.lastName}
                                            </div>
                                            {entry.entryType === 'late' && (
                                                <span className="text-xs text-purple-600 dark:text-purple-400">Efteranmälan</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                            {entry.clubName || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                            {entry.className || '-'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                                            {entry.siCard || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                            {entry.startTime ? new Date(entry.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={entry.status} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingEntry(entry)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                >
                                                    Redigera
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEntry(entry.id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Ta bort
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {(showAddModal || editingEntry) && (
                <EntryModal
                    entry={editingEntry}
                    classes={classes}
                    onSave={editingEntry ? handleUpdateEntry : handleAddEntry}
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingEntry(null);
                    }}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportModal
                    onImport={handleImportCSV}
                    onClose={() => setShowImportModal(false)}
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
        yellow: 'text-yellow-600 dark:text-yellow-400',
        red: 'text-red-600 dark:text-red-400',
        purple: 'text-purple-600 dark:text-purple-400',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: EntryStatus }) {
    const styles: Record<EntryStatus, string> = {
        registered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        started: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        finished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        dns: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        dnf: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        dsq: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };

    const labels: Record<EntryStatus, string> = {
        registered: 'Anmäld',
        confirmed: 'Bekräftad',
        started: 'Startad',
        finished: 'I mål',
        dns: 'DNS',
        dnf: 'DNF',
        dsq: 'DSQ',
        cancelled: 'Återbud',
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

function EntryModal({
    entry,
    classes,
    onSave,
    onClose,
}: {
    entry: Entry | null;
    classes: EventClass[];
    onSave: (entry: any) => void;
    onClose: () => void;
}) {
    const [formData, setFormData] = useState({
        firstName: entry?.firstName || '',
        lastName: entry?.lastName || '',
        clubName: entry?.clubName || '',
        classId: entry?.classId || '',
        className: entry?.className || '',
        siCard: entry?.siCard || '',
        email: entry?.email || '',
        phone: entry?.phone || '',
        status: entry?.status || 'registered' as EntryStatus,
        entryType: entry?.entryType || 'normal' as 'normal' | 'late',
        startTime: entry?.startTime || '',
        comment: entry?.comment || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Find class name if classId selected
        const selectedClass = classes.find(c => c.id === formData.classId);

        onSave({
            ...entry,
            ...formData,
            className: selectedClass?.name || formData.className,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {entry ? 'Redigera deltagare' : 'Lägg till deltagare'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Förnamn *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Efternamn *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Klubb
                        </label>
                        <input
                            type="text"
                            value={formData.clubName}
                            onChange={(e) => setFormData({ ...formData, clubName: e.target.value })}
                            placeholder="T.ex. OK Linné"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Klass *
                            </label>
                            <select
                                required
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Välj klass</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                SI-bricka
                            </label>
                            <input
                                type="text"
                                value={formData.siCard}
                                onChange={(e) => setFormData({ ...formData, siCard: e.target.value })}
                                placeholder="T.ex. 1234567"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                E-post
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Telefon
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as EntryStatus })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="registered">Anmäld</option>
                                <option value="confirmed">Bekräftad</option>
                                <option value="dns">DNS</option>
                                <option value="cancelled">Återbud</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Anmälningstyp
                            </label>
                            <select
                                value={formData.entryType}
                                onChange={(e) => setFormData({ ...formData, entryType: e.target.value as 'normal' | 'late' })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="normal">Normal</option>
                                <option value="late">Efteranmälan</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Starttid (HH:MM:SS)
                        </label>
                        <input
                            type="time"
                            step="1"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Lämna tomt för fri starttid</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Kommentar
                        </label>
                        <textarea
                            value={formData.comment}
                            onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            {entry ? 'Spara ändringar' : 'Lägg till'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ImportModal({
    onImport,
    onClose,
}: {
    onImport: (csv: string) => void;
    onClose: () => void;
}) {
    const [csvData, setCsvData] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCsvData(e.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCsvData(e.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full">
                <div className="p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        📥 Importera anmälningar
                    </h2>
                </div>

                <div className="p-6 space-y-4">
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        <div className="text-4xl mb-2">📄</div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Dra och släpp CSV-fil här
                        </p>
                        <p className="text-sm text-gray-500">eller</p>
                        <label className="mt-2 inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                            Välj fil
                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>CSV-format:</strong> förnamn, efternamn, klubb, klass, si<br />
                            Första raden ska innehålla kolumnnamn.
                        </p>
                    </div>

                    {csvData && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Förhandsvisning:
                            </label>
                            <textarea
                                value={csvData}
                                onChange={(e) => setCsvData(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={() => onImport(csvData)}
                            disabled={!csvData}
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            Importera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
