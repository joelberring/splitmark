'use client';

import { useState } from 'react';
import Link from 'next/link';

// Helper for formatting time
const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface Props {
    event: any;
}

export default function ResultsTab({ event }: Props) {
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const entries = event.entries || [];
    const classes = event.classes || [];

    if (entries.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-sm">
                <div className="text-6xl mb-6 opacity-20 grayscale">🏆</div>
                <p className="text-slate-500 text-lg font-medium uppercase tracking-wide">Inga resultat än.</p>
            </div>
        );
    }

    // Filter by selected class
    const filteredClasses = selectedClassId === 'all'
        ? classes
        : classes.filter((c: any) => c.id === selectedClassId);

    // Sort entries: OK results by position, then non-OK results at the end
    const sortEntries = (entries: any[]) => {
        const okResults = entries
            .filter((e: any) => e.status === 'OK' || e.status === 'finished')
            .sort((a: any, b: any) => (a.position || 999) - (b.position || 999));

        const nonOkResults = entries
            .filter((e: any) => e.status !== 'OK' && e.status !== 'finished')
            .sort((a: any, b: any) => {
                // Sort by status priority: MP > DNF > DNS > DSQ
                const statusOrder: Record<string, number> = { 'MP': 1, 'DNF': 2, 'DNS': 3, 'DSQ': 4 };
                return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
            });

        return [...okResults, ...nonOkResults];
    };

    // Group entries by class
    const entriesByClass = filteredClasses.map((cls: any) => {
        const classEntries = entries.filter((e: any) => e.classId === cls.id);
        const sortedEntries = sortEntries(classEntries);
        const winnerTime = sortedEntries.find((e: any) => e.status === 'OK' || e.status === 'finished')?.time || 0;

        return {
            class: cls,
            entries: sortedEntries,
            winnerTime,
        };
    }).filter((g: any) => g.entries.length > 0);

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
                    <option value="all">Alla klasser</option>
                    {classes.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                </select>
            </div>

            {/* Results by Class */}
            {entriesByClass.map((group: any) => (
                <div key={group.class.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wide leading-tight">{group.class.name}</h3>
                                <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">{group.entries.length} Deltagare</p>
                            </div>
                            <Link
                                href={`/events/${event.id}/results/${group.class.id}`}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-[9px] font-black uppercase tracking-widest border border-slate-700 transition-all shadow-sm"
                            >
                                Analysera (WinSplits) →
                            </Link>
                        </div>
                        {group.class.hasPool && (
                            <span className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-[10px] font-mono border border-purple-800/50 uppercase tracking-widest">
                                Pool: {group.class.forkKeys?.join(', ')}
                            </span>
                        )}
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {group.entries.map((entry: any, idx: number) => {
                            const isWinner = idx === 0 && (entry.status === 'OK' || entry.status === 'finished');
                            return (
                                <button
                                    key={entry.id}
                                    onClick={() => setSelectedEntry(entry)}
                                    className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-800/50 transition-colors text-left group"
                                >
                                    {/* Position Badge */}
                                    <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-110 ${idx === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' :
                                        idx === 1 ? 'bg-slate-300 text-slate-900' :
                                            idx === 2 ? 'bg-amber-600 text-white' :
                                                'bg-slate-800 text-slate-500'
                                        }`}>
                                        {entry.position || idx + 1}
                                    </div>

                                    {/* Name & Club */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm transition-colors ${isWinner ? 'text-emerald-400' : 'text-slate-200 group-hover:text-emerald-400'}`}>
                                                {entry.name || `${entry.firstName} ${entry.lastName}`}
                                            </span>
                                            {/* Fork key badge */}
                                            {entry.forkKey && (
                                                <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 text-[10px] rounded border border-purple-800/50">
                                                    {entry.forkKey}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none">{entry.clubName || entry.club}</div>
                                    </div>

                                    {/* Time */}
                                    <div className="text-right min-w-[80px]">
                                        {entry.status === 'OK' || entry.status === 'finished' ? (
                                            <>
                                                {/* Time behind winner for non-winners - show first */}
                                                {idx > 0 && group.winnerTime && entry.time > group.winnerTime && (
                                                    <div className="text-[10px] text-slate-500 font-mono mb-0.5">
                                                        +{formatTime(entry.time - group.winnerTime)}
                                                    </div>
                                                )}
                                                <div className={`font-mono font-bold tracking-tight ${isWinner ? 'text-emerald-500 text-lg' : 'text-slate-200 group-hover:text-white'}`}>
                                                    {formatTime(entry.time)}
                                                </div>
                                            </>
                                        ) : (
                                            /* Non-OK status display */
                                            <div className="text-red-500 font-bold font-mono text-sm tracking-wider">
                                                {entry.status === 'MP' && 'MP'}
                                                {entry.status === 'DNF' && 'DNF'}
                                                {entry.status === 'DNS' && 'DNS'}
                                                {entry.status === 'DSQ' && 'DSQ'}
                                                {!['MP', 'DNF', 'DNS', 'DSQ'].includes(entry.status) && entry.status}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        👉
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Split Times Modal */}
            {selectedEntry && (
                <SplitTimesModal
                    entry={selectedEntry}
                    event={event}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
}

function SplitTimesModal({ entry, event, onClose }: { entry: any; event: any; onClose: () => void }) {
    const splitTimes = entry.splitTimes || [];

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-lg shadow-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                            {entry.name || `${entry.firstName} ${entry.lastName}`}
                        </h2>
                        <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">{entry.club} • {entry.className}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {/* Summary */}
                <div className="px-6 py-4 bg-slate-900 grid grid-cols-3 gap-4 text-center border-b border-slate-800">
                    <div>
                        <div className="text-2xl font-bold text-white">
                            {entry.position || '-'}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Position</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-mono text-emerald-500">
                            {formatTime(entry.time)}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Total Tid</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">
                            {splitTimes.length}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Kontroller</div>
                    </div>
                </div>

                {/* Split Times Table */}
                <div className="overflow-auto flex-1 p-0">
                    <table className="w-full">
                        <thead className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest">#</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500 tracking-widest">Kontroll</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase text-slate-500 tracking-widest">Sträcka</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase text-slate-500 tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {splitTimes.map((split: any, idx: number) => {
                                const prevTime = idx > 0 ? splitTimes[idx - 1].time : 0;
                                const legTime = split.time - prevTime;

                                return (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{idx + 1}</td>
                                        <td className="px-4 py-3 font-bold text-sm text-slate-300">{split.controlCode}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                                            {formatTime(legTime)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-500">
                                            {formatTime(split.time)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Finish */}
                            <tr className="bg-emerald-950/20">
                                <td className="px-4 py-3 font-mono text-xs text-emerald-700">M</td>
                                <td className="px-4 py-3 font-bold text-sm text-emerald-500">Mål</td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600/70">
                                    {splitTimes.length > 0 ? formatTime(entry.time - splitTimes[splitTimes.length - 1].time) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500 text-sm">
                                    {formatTime(entry.time)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-900">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold uppercase tracking-widest text-xs transition-colors border border-slate-700 hover:border-slate-600"
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
