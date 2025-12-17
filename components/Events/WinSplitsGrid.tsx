'use client';

import { useMemo } from 'react';

interface Split {
    controlCode: string;
    time: number; // cumulative time in seconds
}

interface Entry {
    id: string;
    name: string;
    club: string;
    time: number; // total time
    status: string;
    splits: Split[];
}

interface Props {
    entries: Entry[];
}

export default function WinSplitsGrid({ entries }: Props) {
    const formatTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDiff = (seconds: number) => {
        if (seconds === 0) return '0:00';
        return `+${formatTime(seconds)}`;
    };

    // 1. Get all control codes in order (using the winner's splits as reference or first entry)
    const controls = useMemo(() => {
        if (entries.length === 0) return [];
        // Sort by time to find the likely winner
        const sorted = [...entries].filter(e => e.status === 'OK' || e.status === 'finished').sort((a, b) => a.time - b.time);
        if (sorted.length === 0) return [];
        return sorted[0].splits.map(s => s.controlCode);
    }, [entries]);

    // 2. Pre-calculate leg times, ranks, and best times
    const stats = useMemo(() => {
        const legStats = controls.map((code, idx) => {
            const runnerLegTimes: { id: string; time: number }[] = [];
            const runnerCumTimes: { id: string; time: number }[] = [];

            entries.forEach(entry => {
                const currentSplit = entry.splits.find(s => s.controlCode === code);
                if (!currentSplit) return;

                const prevSplit = idx === 0 ? null : entry.splits.find(s => s.controlCode === controls[idx - 1]);
                const legTime = prevSplit ? currentSplit.time - prevSplit.time : currentSplit.time;

                runnerLegTimes.push({ id: entry.id, time: legTime });
                runnerCumTimes.push({ id: entry.id, time: currentSplit.time });
            });

            // Sort to find ranks
            const legRanks = [...runnerLegTimes].sort((a, b) => a.time - b.time);
            const cumRanks = [...runnerCumTimes].sort((a, b) => a.time - b.time);

            return {
                code,
                bestLeg: legRanks[0]?.time || 0,
                bestCum: cumRanks[0]?.time || 0,
                legRanks: new Map(legRanks.map((item, i) => [item.id, i + 1])),
                cumRanks: new Map(cumRanks.map((item, i) => [item.id, i + 1])),
                legTimes: new Map(runnerLegTimes.map(item => [item.id, item.time])),
                cumTimes: new Map(runnerCumTimes.map(item => [item.id, item.time])),
            };
        });

        // Add Finish/Total stats
        const finishLegTimes: { id: string; time: number }[] = [];
        const finishCumTimes: { id: string; time: number }[] = [];

        entries.forEach(entry => {
            const lastSplit = entry.splits[entry.splits.length - 1];
            if (!lastSplit) return;
            const legTime = entry.time - lastSplit.time;

            finishLegTimes.push({ id: entry.id, time: legTime });
            finishCumTimes.push({ id: entry.id, time: entry.time });
        });

        const finishLegRanks = [...finishLegTimes].sort((a, b) => a.time - b.time);
        const finishCumRanks = [...finishCumTimes].sort((a, b) => a.time - b.time);

        const finishStats = {
            code: 'Mål',
            bestLeg: finishLegRanks[0]?.time || 0,
            bestCum: finishCumRanks[0]?.time || 0,
            legRanks: new Map(finishLegRanks.map((item, i) => [item.id, i + 1])),
            cumRanks: new Map(finishCumRanks.map((item, i) => [item.id, i + 1])),
            legTimes: new Map(finishLegTimes.map(item => [item.id, item.time])),
            cumTimes: new Map(finishCumTimes.map(item => [item.id, item.time])),
        };

        return [...legStats, finishStats];
    }, [entries, controls]);

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        if (rank === 2) return 'text-slate-300 bg-slate-300/10 border-slate-300/20';
        if (rank === 3) return 'text-amber-600 bg-amber-600/10 border-amber-600/20';
        return 'text-slate-500 bg-slate-800/30 border-slate-700/30';
    };

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950 border-b border-slate-800">
                            <th className="sticky left-0 z-20 bg-slate-950 px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[180px] border-r border-slate-800">
                                Deltagare
                            </th>
                            {stats.map(s => (
                                <th key={s.code} className="px-3 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[100px] border-r border-slate-800/50">
                                    {s.code}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {entries.sort((a, b) => (a.status === 'OK' ? a.time : 99999) - (b.status === 'OK' ? b.time : 99999)).map((entry, eIdx) => (
                            <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors group">
                                <td className="sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 px-4 py-2 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                    <div className="flex items-center gap-3">
                                        <div className="text-[10px] font-black text-slate-600 w-4">{eIdx + 1}</div>
                                        <div>
                                            <div className="font-bold text-xs text-white truncate max-w-[140px]">{entry.name}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[140px]">{entry.club}</div>
                                        </div>
                                    </div>
                                </td>
                                {stats.map((s, sIdx) => {
                                    const legTime = s.legTimes.get(entry.id);
                                    const cumTime = s.cumTimes.get(entry.id);
                                    const legRank = s.legRanks.get(entry.id);
                                    const cumRank = s.cumRanks.get(entry.id);
                                    const diff = cumTime !== undefined ? cumTime - s.bestCum : 0;

                                    if (legTime === undefined) return <td key={sIdx} className="px-2 py-2 text-center text-slate-700 text-[10px] border-r border-slate-800/30">-</td>;

                                    return (
                                        <td key={sIdx} className="px-2 py-1 border-r border-slate-800/30">
                                            {/* Cell is split in two rows for density */}
                                            <div className="flex flex-col gap-0.5">
                                                {/* Row 1: Leg Time & Rank */}
                                                <div className="flex justify-between items-center gap-1">
                                                    <span className={`font-mono text-[10px] font-bold ${legRank === 1 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                        {formatTime(legTime)}
                                                    </span>
                                                    <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-black border ${getRankColor(legRank || 0)}`}>
                                                        {legRank}
                                                    </span>
                                                </div>
                                                {/* Row 2: Cum Time & Rank + Diff */}
                                                <div className="flex justify-between items-center gap-1 opacity-60">
                                                    <span className="font-mono text-[9px] text-slate-500">
                                                        {formatTime(cumTime || 0)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[8px] font-bold text-slate-600">({cumRank})</span>
                                                        {diff > 0 && (
                                                            <span className="text-[8px] font-bold text-red-500/70">+{formatTime(diff)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex flex-wrap gap-4 items-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Signatur:</div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-yellow-400"></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Bäst på sträckan</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-slate-300"></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">2:a</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-amber-600"></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">3:e</span>
                </div>
                <div className="ml-auto text-[9px] font-medium text-slate-600 italic">
                    Övre rad: Sträcktid (Plac) | Undre rad: Ack. tid (Plac) + Efter
                </div>
            </div>
        </div>
    );
}
