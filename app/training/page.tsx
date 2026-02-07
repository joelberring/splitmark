'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth/hooks';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface TrainingEntry {
    id: string;
    date: string;
    type: 'training' | 'competition' | 'rest';
    title: string;
    duration: number;
    distance: number;
    notes: string;
    feeling: 1 | 2 | 3 | 4 | 5;
}

export default function TrainingLogPage() {
    const { user, loading: authLoading } = useRequireAuth('/login');
    const [entries, setEntries] = useState<TrainingEntry[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    const [newEntry, setNewEntry] = useState<Omit<TrainingEntry, 'id'>>({
        date: new Date().toISOString().split('T')[0],
        type: 'training',
        title: '',
        duration: 60,
        distance: 0,
        notes: '',
        feeling: 3,
    });

    useEffect(() => { loadEntries(); }, [selectedMonth]);

    const loadEntries = async () => {
        const mockEntries: TrainingEntry[] = [
            { id: '1', date: '2025-12-10', type: 'training', title: 'Intervaller Hagaparken', duration: 75, distance: 12.5, notes: 'Bra fart, lite trött i slutet', feeling: 4 },
            { id: '2', date: '2025-12-08', type: 'competition', title: 'Nattcupen #4', duration: 48, distance: 6.2, notes: 'Bra löpning, 2:a plats!', feeling: 5 },
            { id: '3', date: '2025-12-06', type: 'training', title: 'Lugn löpning', duration: 45, distance: 8.0, notes: '', feeling: 3 },
        ];
        setEntries(mockEntries);
    };

    const handleAddEntry = async () => {
        const entry: TrainingEntry = { ...newEntry, id: Date.now().toString() };
        setEntries([entry, ...entries]);
        setShowAddForm(false);
        setNewEntry({ date: new Date().toISOString().split('T')[0], type: 'training', title: '', duration: 60, distance: 0, notes: '', feeling: 3 });
    };

    const totalStats = entries.reduce((acc, entry) => ({
        duration: acc.duration + entry.duration,
        distance: acc.distance + entry.distance,
        sessions: acc.sessions + 1,
    }), { duration: 0, distance: 0, sessions: 0 });

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title="Träningsdagbok"
                showLogo
                rightAction={
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-emerald-500 transition-colors"
                    >
                        + Lägg till
                    </button>
                }
            />

            <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
                        <div className="text-2xl font-bold text-emerald-400">{totalStats.sessions}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Pass</div>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
                        <div className="text-2xl font-bold text-blue-400">{totalStats.distance.toFixed(1)}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Kilometer</div>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800">
                        <div className="text-2xl font-bold text-purple-400">
                            {Math.floor(totalStats.duration / 60)}h {totalStats.duration % 60}m
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total tid</div>
                    </div>
                </div>

                {/* Month Selector */}
                <div className="mb-4">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    />
                </div>

                {/* Entries List */}
                <div className="space-y-3">
                    {entries.map((entry) => (
                        <div key={entry.id} className="bg-slate-900 rounded-xl p-4 border-l-4 border-emerald-500 hover:bg-slate-800/80 transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${entry.type === 'competition' ? 'bg-amber-900/30 text-amber-400' :
                                        entry.type === 'rest' ? 'bg-slate-700 text-slate-400' :
                                            'bg-emerald-900/30 text-emerald-400'
                                        }`}>
                                        <span className="text-xl">
                                            {entry.type === 'competition' ? '🏆' : entry.type === 'rest' ? '😴' : '🏃'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white">{entry.title}</h3>
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <span key={star} className={star <= entry.feeling ? 'text-amber-400 text-xs' : 'text-slate-600 text-xs'}>★</span>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {new Date(entry.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                        {entry.notes && <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-emerald-400">{entry.distance > 0 ? `${entry.distance} km` : '—'}</div>
                                    <div className="text-xs text-slate-500">{entry.duration} min</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {entries.length === 0 && (
                    <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
                        <div className="text-5xl mb-4 opacity-30">📝</div>
                        <p className="text-slate-500 uppercase tracking-wide text-sm font-bold mb-4">Inga träningspass</p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors"
                        >
                            Lägg till pass
                        </button>
                    </div>
                )}
            </main>

            {/* Add Entry Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold uppercase tracking-wider">Lägg till träningspass</h2>
                            <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Type */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Typ</label>
                                <div className="flex gap-2">
                                    {(['training', 'competition', 'rest'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewEntry({ ...newEntry, type })}
                                            className={`flex-1 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${newEntry.type === type ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {type === 'training' ? '🏃 Träning' : type === 'competition' ? '🏆 Tävling' : '😴 Vila'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Datum</label>
                                <input
                                    type="date"
                                    value={newEntry.date}
                                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Titel</label>
                                <input
                                    type="text"
                                    value={newEntry.title}
                                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                                    placeholder="T.ex. Intervaller, Långpass..."
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>

                            {/* Duration & Distance */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Tid (min)</label>
                                    <input
                                        type="number"
                                        value={newEntry.duration}
                                        onChange={(e) => setNewEntry({ ...newEntry, duration: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Distans (km)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={newEntry.distance}
                                        onChange={(e) => setNewEntry({ ...newEntry, distance: parseFloat(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    />
                                </div>
                            </div>

                            {/* Feeling */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Känsla</label>
                                <div className="flex gap-2">
                                    {([1, 2, 3, 4, 5] as const).map((feeling) => (
                                        <button
                                            key={feeling}
                                            onClick={() => setNewEntry({ ...newEntry, feeling })}
                                            className={`flex-1 py-2 rounded-lg text-xl transition-all ${newEntry.feeling >= feeling ? 'bg-amber-900/30 text-amber-400' : 'bg-slate-800 text-slate-600'
                                                }`}
                                        >★</button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Anteckningar</label>
                                <textarea
                                    value={newEntry.notes}
                                    onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                                    placeholder="Hur gick passet?"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                ></textarea>
                            </div>

                            <button
                                onClick={handleAddEntry}
                                disabled={!newEntry.title}
                                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50"
                            >
                                Spara
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
