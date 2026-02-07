'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface Runner {
    id: string;
    name: string;
    club: string;
    time: number;
    splits: number[];
}

export default function CompareResultsPage() {
    const [runner1, setRunner1] = useState<string>('1');
    const [runner2, setRunner2] = useState<string>('2');

    const mockRunners: Runner[] = [
        { id: '1', name: 'Anna Svensson', club: 'OK Linné', time: 3245, splits: [182, 274, 367, 422, 631] },
        { id: '2', name: 'Erik Johansson', club: 'IFK Göteborg', time: 3189, splits: [195, 249, 401, 377, 639] },
        { id: '3', name: 'Lisa Karlsson', club: 'Järla OF', time: 3356, splits: [178, 289, 389, 445, 698] },
        { id: '4', name: 'Johan Nilsson', club: 'OK Linné', time: 3412, splits: [201, 312, 378, 401, 712] },
    ];

    const controls = ['101', '102', '103', '104', '105'];

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const r1 = mockRunners.find(r => r.id === runner1);
    const r2 = mockRunners.find(r => r.id === runner2);

    if (!r1 || !r2) return null;

    const cumulative1 = r1.splits.reduce((acc: number[], time, i) => { acc.push((acc[i - 1] || 0) + time); return acc; }, []);
    const cumulative2 = r2.splits.reduce((acc: number[], time, i) => { acc.push((acc[i - 1] || 0) + time); return acc; }, []);

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader title="Jämför Sträcktider" backHref="/events" backLabel="Tillbaka" />

            <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full">
                {/* Runner Selection */}
                <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Välj Löpare</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">Löpare 1 (Grön)</label>
                            <select
                                value={runner1}
                                onChange={(e) => setRunner1(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border-2 border-emerald-600 rounded-lg text-white"
                            >
                                {mockRunners.map(r => <option key={r.id} value={r.id}>{r.name} ({r.club})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Löpare 2 (Blå)</label>
                            <select
                                value={runner2}
                                onChange={(e) => setRunner2(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border-2 border-blue-600 rounded-lg text-white"
                            >
                                {mockRunners.map(r => <option key={r.id} value={r.id}>{r.name} ({r.club})</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Comparison Chart */}
                <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Tidsskillnad per Sträcka</h2>
                    <div className="space-y-3">
                        {controls.map((control, index) => {
                            const diff = r1.splits[index] - r2.splits[index];
                            const maxDiff = 60;
                            const normalizedDiff = Math.max(-1, Math.min(1, diff / maxDiff));

                            return (
                                <div key={control} className="flex items-center gap-3">
                                    <div className="w-12 text-center">
                                        <span className="font-bold text-slate-400 text-sm">{control}</span>
                                    </div>
                                    <div className="flex-1 relative h-6">
                                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-700 transform -translate-x-1/2"></div>
                                        <div
                                            className={`absolute top-1 bottom-1 rounded ${diff > 0 ? 'bg-blue-500 right-1/2' : 'bg-emerald-500 left-1/2'}`}
                                            style={{ width: `${Math.abs(normalizedDiff) * 50}%`, ...(diff > 0 ? { marginRight: '2px' } : { marginLeft: '2px' }) }}
                                        ></div>
                                    </div>
                                    <div className="w-20 text-right">
                                        <span className={`font-mono font-bold text-sm ${diff > 0 ? 'text-blue-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {diff > 0 ? '+' : ''}{diff}s
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 pt-3 border-t border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                            <span className="text-slate-500">{r1.name} vinner</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">{r2.name} vinner</span>
                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        </div>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                    <div className="p-4 border-b border-slate-800">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Detaljerad Jämförelse</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kontroll</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{r1.name}</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-blue-400 uppercase tracking-wider">{r2.name}</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Skillnad</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kumulativ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {controls.map((control, index) => {
                                    const diff = r1.splits[index] - r2.splits[index];
                                    const cumDiff = cumulative1[index] - cumulative2[index];
                                    return (
                                        <tr key={control} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-3 font-bold text-slate-300">{control}</td>
                                            <td className="px-4 py-3 font-mono text-center text-slate-300">{formatTime(r1.splits[index])}</td>
                                            <td className="px-4 py-3 font-mono text-center text-slate-300">{formatTime(r2.splits[index])}</td>
                                            <td className={`px-4 py-3 font-mono text-center font-bold ${diff > 0 ? 'text-blue-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {diff > 0 ? '+' : ''}{diff}s
                                            </td>
                                            <td className={`px-4 py-3 font-mono text-center font-bold ${cumDiff > 0 ? 'text-blue-400' : cumDiff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {cumDiff > 0 ? '+' : ''}{cumDiff}s
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-slate-800 font-bold">
                                    <td className="px-4 py-3 text-white">MÅL</td>
                                    <td className="px-4 py-3 font-mono text-center text-emerald-400">{formatTime(r1.time)}</td>
                                    <td className="px-4 py-3 font-mono text-center text-blue-400">{formatTime(r2.time)}</td>
                                    <td className={`px-4 py-3 font-mono text-center ${r1.time > r2.time ? 'text-blue-400' : 'text-emerald-400'}`}>
                                        {r1.time > r2.time ? '+' : ''}{r1.time - r2.time}s
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500">—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

        </div>
    );
}
