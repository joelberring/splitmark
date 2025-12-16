'use client';

import { useState } from 'react';
import HelpButton from '@/components/HelpButton';
import { EventData, Entry, saveEvent } from './shared';

export default function EntriesTab({ event, setEvent }: { event: EventData; setEvent: (e: EventData) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEntry, setNewEntry] = useState({ name: '', club: '', className: '', siCard: '' });

    const handleAddEntry = () => {
        if (!newEntry.name.trim()) return;

        const entry: Entry = {
            id: `entry-${Date.now()}`,
            name: newEntry.name,
            club: newEntry.club,
            className: newEntry.className || event.classes[0]?.name || 'Öppen',
            siCard: newEntry.siCard,
            startTime: undefined,
            status: 'registered',
        };

        const updatedEvent = {
            ...event,
            entries: [...event.entries, entry],
        };

        setEvent(updatedEvent);
        saveEvent(updatedEvent);
        setNewEntry({ name: '', club: '', className: '', siCard: '' });
        setShowAddModal(false);
    };

    const handleDeleteEntry = (entryId: string) => {
        const updatedEvent = {
            ...event,
            entries: event.entries.filter(e => e.id !== entryId),
        };
        setEvent(updatedEvent);
        saveEvent(updatedEvent);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    Anmälningar ({event.entries.length})
                    <HelpButton topic="entries" size="sm" />
                </h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500"
                >
                    + Lägg till deltagare
                </button>
            </div>

            {event.entries.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4 opacity-30">📝</div>
                    <h3 className="text-lg font-bold text-white mb-2">Inga anmälningar ännu</h3>
                    <p className="text-slate-500 mb-6 text-sm">Importera anmälningar från Eventor eller lägg till manuellt</p>
                    <div className="flex gap-3 justify-center">
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-500">
                            📥 Importera från Eventor
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500"
                        >
                            + Manuell anmälan
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Namn</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Klubb</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Klass</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">SI-Bricka</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {event.entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-bold text-white">{entry.name}</td>
                                    <td className="px-4 py-3 text-slate-400">{entry.club || '-'}</td>
                                    <td className="px-4 py-3 text-slate-400">{entry.className}</td>
                                    <td className="px-4 py-3 font-mono text-slate-500">{entry.siCard || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded ${entry.status === 'finished' ? 'bg-emerald-900/30 text-emerald-400' :
                                                entry.status === 'started' ? 'bg-blue-900/30 text-blue-400' :
                                                    'bg-slate-800 text-slate-500'
                                            }`}>
                                            {entry.status === 'finished' ? 'I mål' : entry.status === 'started' ? 'Startat' : 'Anmäld'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteEntry(entry.id)}
                                            className="text-red-500 hover:text-red-400 text-xs"
                                        >
                                            Ta bort
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Entry Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Lägg till deltagare</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Namn *
                                </label>
                                <input
                                    type="text"
                                    value={newEntry.name}
                                    onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                                    placeholder="Förnamn Efternamn"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Klubb
                                </label>
                                <input
                                    type="text"
                                    value={newEntry.club}
                                    onChange={(e) => setNewEntry({ ...newEntry, club: e.target.value })}
                                    placeholder="OK Linné"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Klass
                                </label>
                                <select
                                    value={newEntry.className}
                                    onChange={(e) => setNewEntry({ ...newEntry, className: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value="">Välj klass...</option>
                                    {event.classes.map((cls) => (
                                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                                    ))}
                                    <option value="Öppen">Öppen</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    SI-Bricka
                                </label>
                                <input
                                    type="text"
                                    value={newEntry.siCard}
                                    onChange={(e) => setNewEntry({ ...newEntry, siCard: e.target.value })}
                                    placeholder="12345678"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleAddEntry}
                                disabled={!newEntry.name.trim()}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                            >
                                Lägg till
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
