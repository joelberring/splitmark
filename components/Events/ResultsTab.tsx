'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import WinSplitsGrid from './WinSplitsGrid';
import {
    rankEntriesByClass,
    formatResultTime,
    formatTimeBehind,
    getEntryDurationSeconds,
    normalizeResultStatus,
} from '@/lib/results/ranking';

interface Props {
    event: any;
    results: any[];
    loading?: boolean;
}

interface DisplayClass {
    id: string;
    name: string;
    hasPool?: boolean;
    forkKeys?: string[];
}

interface DisplayGroup {
    class: DisplayClass;
    entries: any[];
    winnerTime?: number;
}

export default function ResultsTab({ event, results, loading }: Props) {
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const rankedClasses = useMemo<DisplayGroup[]>(() => {
        const base = rankEntriesByClass(results);
        const classMeta = new Map<string, DisplayClass>((event.classes || []).map((cls: any) => [cls.id, cls as DisplayClass]));

        return base.map((group) => {
            const cls = classMeta.get(group.classId) || {
                id: group.classId,
                name: group.className || group.classId,
                hasPool: false,
                forkKeys: [],
            };

            return {
                class: cls,
                entries: group.entries,
                winnerTime: group.winnerTimeSeconds,
            };
        });
    }, [results, event.classes]);

    const classOptions = useMemo<Array<{ id: string; name: string }>>(() => {
        const fromEvent = (event.classes || []).map((cls: any) => ({ id: String(cls.id), name: String(cls.name) }));
        const seen = new Set(fromEvent.map((item: { id: string; name: string }) => item.id));

        rankedClasses.forEach((group) => {
            if (!seen.has(group.class.id)) {
                seen.add(group.class.id);
                fromEvent.push({ id: group.class.id, name: group.class.name || group.class.id });
            }
        });

        return fromEvent;
    }, [event.classes, rankedClasses]);

    const filteredClasses = selectedClassId === 'all'
        ? rankedClasses
        : rankedClasses.filter((group) => group.class.id === selectedClassId);

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-6"></div>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Laddar resultat…</p>
            </div>
        );
    }

    if (results.length === 0 || rankedClasses.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center shadow-sm">
                <div className="text-6xl mb-6 opacity-20 grayscale">🏆</div>
                <p className="text-slate-500 text-lg font-medium uppercase tracking-wide">Inga resultat än.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Klass:</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="px-4 py-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all uppercase tracking-wide text-sm font-bold"
                    >
                        <option value="all">Alla klasser</option>
                        {classOptions.map((cls: any) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Lista
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        WinSplits
                    </button>
                </div>
            </div>

            {filteredClasses.map((group: any) => (
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
                    {viewMode === 'list' ? (
                        <div className="divide-y divide-slate-800/50">
                            {group.entries.map((ranked: any, idx: number) => {
                                const entry = ranked.entry;
                                const isWinner = ranked.isOk && ranked.position === 1;

                                return (
                                    <button
                                        key={ranked.id}
                                        onClick={() => setSelectedEntry(entry)}
                                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-800/50 transition-colors text-left group"
                                    >
                                        <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-110 ${ranked.position === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' :
                                            ranked.position === 2 ? 'bg-slate-300 text-slate-900' :
                                                ranked.position === 3 ? 'bg-amber-600 text-white' :
                                                    'bg-slate-800 text-slate-500'
                                            }`}>
                                            {ranked.position || '–'}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm transition-colors ${isWinner ? 'text-emerald-400' : 'text-slate-200 group-hover:text-emerald-400'}`}>
                                                    {ranked.name}
                                                </span>
                                                {entry.forkKey && (
                                                    <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 text-[10px] rounded border border-purple-800/50">
                                                        {entry.forkKey}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none">{entry.clubName || entry.club}</div>
                                        </div>

                                        <div className="text-right min-w-[90px]">
                                            {ranked.isOk ? (
                                                <>
                                                    {ranked.timeBehindSeconds && ranked.timeBehindSeconds > 0 && (
                                                        <div className="text-[10px] text-slate-500 font-mono mb-0.5">
                                                            {formatTimeBehind(ranked.timeBehindSeconds)}
                                                        </div>
                                                    )}
                                                    <div className={`font-mono font-bold tracking-tight ${isWinner ? 'text-emerald-500 text-lg' : 'text-slate-200 group-hover:text-white'}`}>
                                                        {formatResultTime(ranked.timeSeconds)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-red-500 font-bold font-mono text-sm tracking-wider">
                                                    {ranked.status}
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
                    ) : (
                        <div className="p-1">
                            <WinSplitsGrid entries={group.entries.map((item: any) => ({
                                ...item.entry,
                                status: item.status,
                                time: item.timeSeconds,
                                position: item.position,
                            }))} />
                        </div>
                    )}
                </div>
            ))}

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

function SplitTimesModal({ entry, onClose }: { entry: any; event: any; onClose: () => void }) {
    const splitTimes = entry.splitTimes || [];
    const totalSeconds = getEntryDurationSeconds(entry);
    const status = normalizeResultStatus(entry);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-lg shadow-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                            {entry.name || `${entry.firstName} ${entry.lastName}`}
                        </h2>
                        <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">{entry.club || entry.clubName} • {entry.className}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                <div className="px-6 py-4 bg-slate-900 grid grid-cols-3 gap-4 text-center border-b border-slate-800">
                    <div>
                        <div className="text-2xl font-bold text-white">
                            {entry.position || '-'}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Position</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-mono text-emerald-500">
                            {formatResultTime(totalSeconds)}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Total Tid</div>
                    </div>
                    <div>
                        <div className={`text-2xl font-bold ${status === 'OK' ? 'text-white' : 'text-red-500'}`}>
                            {status}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Status</div>
                    </div>
                </div>

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
                                            {formatResultTime(legTime)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-500">
                                            {formatResultTime(split.time)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-emerald-950/20">
                                <td className="px-4 py-3 font-mono text-xs text-emerald-700">M</td>
                                <td className="px-4 py-3 font-bold text-sm text-emerald-500">Mål</td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600/70">
                                    {splitTimes.length > 0 && totalSeconds
                                        ? formatResultTime(Math.max(0, totalSeconds - splitTimes[splitTimes.length - 1].time))
                                        : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500 text-sm">
                                    {formatResultTime(totalSeconds)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

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
