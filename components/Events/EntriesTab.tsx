'use client';

import { useState } from 'react';
import { StoredEvent } from '@/types/event';

interface Entry {
    id: string;
    firstName: string;
    lastName: string;
    clubName?: string;
    classId: string;
    startTime?: string;
    status?: string;
    result?: string;
}

interface Class {
    id: string;
    name: string;
    entries?: any[];
}

interface Props {
    event: any;
    entries: any[];
    loading?: boolean;
}

export default function EntriesTab({ event, entries, loading }: Props) {
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const classes = event.classes || [];

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-6"></div>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Laddar anmälningar…</p>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-sm">
                <div className="text-6xl mb-6 opacity-20 grayscale">📋</div>
                <p className="text-slate-500 text-lg font-medium uppercase tracking-wide">Inga anmälningar än.</p>
            </div>
        );
    }

    // Filter by selected class
    const filteredEntries = selectedClassId === 'all'
        ? entries
        : entries.filter((e: any) => e.classId === selectedClassId);

    // Group by class
    const entriesByClass = classes
        .map((cls: any) => ({
            class: cls,
            entries: entries.filter((e: any) => e.classId === cls.id),
        }))
        .filter((g: any) => g.entries.length > 0 && (selectedClassId === 'all' || g.class.id === selectedClassId));

    return (
        <div className="space-y-8">
            {/* Class Filter */}
            <div className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-lg shadow-sm">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Klass:</label>
                <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-4 py-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all uppercase tracking-wide text-sm font-bold"
                >
                    <option value="all">Alla klasser ({entries.length})</option>
                    {classes.map((cls: any) => {
                        const count = entries.filter((e: any) => e.classId === cls.id).length;
                        return (
                            <option key={cls.id} value={cls.id}>{cls.name} ({count})</option>
                        );
                    })}
                </select>
            </div>

            {/* Entries by Class */}
            {entriesByClass.map((group: any) => (
                <div key={group.class.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">{group.class.name}</h3>
                            <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">{group.entries.length} Anmälda</p>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {group.entries.map((entry: any, idx: number) => (
                            <div key={entry.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-800/50 transition-colors group">
                                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-500 group-hover:text-emerald-400 group-hover:bg-emerald-950/30 transition-colors">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-200 group-hover:text-white transition-colors">
                                        {entry.firstName} {entry.lastName}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{entry.clubName || entry.club}</div>
                                </div>
                                {entry.startTime && (
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold uppercase text-slate-600">Start</div>
                                        <div className="font-mono font-bold text-emerald-500">{entry.startTime}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
