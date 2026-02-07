'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WinSplitsGrid from '@/components/Events/WinSplitsGrid';
import MapOverlay from '@/components/Events/MapOverlay';

export default function ResultsPage() {
    const params = useParams();
    const eventId = params.id as string;
    const classId = params.classId as string;

    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'details' | 'overview' | 'map'>('overview');
    const [selectedRunner, setSelectedRunner] = useState<string | null>(null);

    useEffect(() => {
        const loadEvent = async () => {
            try {
                const { getEvent } = await import('@/lib/firestore/events');
                const foundEvent = await getEvent(eventId);
                if (foundEvent) {
                    setEvent(foundEvent);
                }
            } catch (error) {
                console.error('Error loading event:', error);
            }
            setLoading(false);
        };
        loadEvent();
    }, [eventId]);

    const results = useMemo(() => {
        if (!event) return [];
        // Filter results for this class
        const classEntries = event.entries.filter((e: any) => e.classId === classId || e.className === classId);

        // Sort entries: OK results by time, then non-OK results at the end
        const okResults = classEntries
            .filter((e: any) => e.status === 'OK' || e.status === 'finished')
            .sort((a: any, b: any) => (a.time || 99999) - (b.time || 99999));

        const nonOkResults = classEntries
            .filter((e: any) => e.status !== 'OK' && e.status !== 'finished')
            .sort((a: any, b: any) => {
                const statusOrder: Record<string, number> = { 'MP': 1, 'DNF': 2, 'DNS': 3, 'DSQ': 4 };
                return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
            });

        return [...okResults, ...nonOkResults];
    }, [event, classId]);

    const formatTime = (seconds: number): string => {
        if (!seconds || seconds <= 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-12 text-center">
                <h1 className="text-2xl font-bold mb-4">Hittade inte tävlingen</h1>
                <Link href="/" className="text-emerald-500 hover:underline">Gå till startsidan</Link>
            </div>
        );
    }

    const selectedResult = results.find(r => r.id === selectedRunner);

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <Link
                        href={`/events/${eventId}`}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-2 inline-block transition-colors"
                    >
                        ← Tillbaka till tävling
                    </Link>

                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight text-white leading-none">
                                Resultat - <span className="text-emerald-500">{classId}</span>
                            </h1>
                            <p className="text-slate-500 mt-1 text-[10px] font-black uppercase tracking-widest">
                                {results.length} deltagare i mål
                            </p>
                        </div>

                        {/* Tab Toggle */}
                        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                            <button
                                onClick={() => setViewMode('overview')}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'overview' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                WinSplits
                            </button>
                            <button
                                onClick={() => setViewMode('details')}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'details' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                Analys
                            </button>
                            {event?.worldFile && (
                                <button
                                    onClick={() => setViewMode('map')}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Karta
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {viewMode === 'overview' && <WinSplitsGrid entries={results as any} />}

                {viewMode === 'map' && event?.worldFile && (
                    <div className="h-[70vh]">
                        <MapOverlay
                            worldFileContent={event.worldFile}
                            mapImageUrl={event.mapImageUrl || '/test-map.jpg'}
                            course={event.courses?.find((c: any) => c.classIds?.includes(classId))}
                            results={results as any}
                            selectedRunnerId={selectedRunner || undefined}
                        />
                    </div>
                )}

                {viewMode === 'details' && (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Results List */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                                    <h2 className="text-xs font-black uppercase tracking-tight text-slate-400">
                                        Resultatlista (Välj för detaljer)
                                    </h2>
                                </div>

                                <div className="divide-y divide-slate-800/50 max-h-[70vh] overflow-y-auto">
                                    {results.map((result, index) => (
                                        <div
                                            key={result.id}
                                            onClick={() => setSelectedRunner(result.id)}
                                            className={`p-2 px-4 cursor-pointer transition-all ${selectedRunner === result.id
                                                ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
                                                : 'hover:bg-slate-800/30 border-l-4 border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-lg font-black w-6 ${selectedRunner === result.id ? 'text-emerald-500' : 'text-slate-700'}`}>
                                                        {index + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                                                            {result.name || `${result.firstName} ${result.lastName}`}
                                                        </div>
                                                        <div className="text-[9px] font-bold uppercase tracking-tight text-slate-500">
                                                            {result.clubName || result.club}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-sm text-white font-mono">
                                                        {formatTime(result.time)}
                                                    </div>
                                                    {index > 0 && results[0].time && (
                                                        <div className="text-[9px] font-bold text-slate-600">
                                                            +{formatTime(result.time - results[0].time)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Split Times Visualization */}
                        <div className="lg:col-span-2">
                            {selectedResult ? (
                                <div className="space-y-6">
                                    {/* Runner Info Card */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <div>
                                                <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                                                    {selectedResult.name || `${selectedResult.firstName} ${selectedResult.lastName}`}
                                                </h2>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                                                    {selectedResult.clubName || selectedResult.club} <span className="text-slate-800 mx-2">|</span> {formatTime(selectedResult.time)}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <button className="px-3 py-1.5 bg-slate-800 text-white rounded border border-slate-700 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">
                                                    GPX
                                                </button>
                                                <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40">
                                                    Strava
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Split Times Table Card */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
                                        <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                                            <h3 className="text-xs font-black uppercase tracking-tight text-slate-400">
                                                Sträcktider & Analys
                                            </h3>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-slate-800/20 border-b border-slate-800">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Kontroll</th>
                                                        <th className="px-4 py-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Ack. Tid</th>
                                                        <th className="px-4 py-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Sträcka</th>
                                                        <th className="px-4 py-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Plac</th>
                                                        <th className="px-4 py-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">+/-</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/50">
                                                    {(selectedResult.splits || []).map((split: any, index: number) => {
                                                        const legTime = index === 0 ? split.time : split.time - selectedResult.splits[index - 1].time;

                                                        return (
                                                            <tr key={split.controlCode} className="hover:bg-slate-800/30 transition-colors group">
                                                                <td className="px-4 py-2 whitespace-nowrap">
                                                                    <span className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">
                                                                        {split.controlCode}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-right font-mono text-xs text-slate-400">
                                                                    {formatTime(split.time)}
                                                                </td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-right font-mono font-bold text-xs text-white">
                                                                    {formatTime(legTime)}
                                                                </td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                                                    <span className={`w-6 h-6 inline-flex items-center justify-center rounded text-[9px] font-black ${split.position === 1 ? 'bg-emerald-500 text-slate-950' :
                                                                        split.position <= 3 ? 'bg-slate-700 text-slate-300' :
                                                                            'bg-slate-800 text-slate-600'
                                                                        }`}>
                                                                        {split.position || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2 whitespace-nowrap text-right">
                                                                    <span className={`font-mono text-[10px] font-bold ${split.timeBehind === 0 ? 'text-emerald-500' : 'text-red-500/70'}`}>
                                                                        {split.timeBehind > 0 ? `+${split.timeBehind}` : split.timeBehind === 0 ? '0:00' : '-'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center shadow-2xl">
                                    <div className="text-6xl mb-6 opacity-10 filter grayscale">👈</div>
                                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-500 mb-2">
                                        Analysera Löpare
                                    </h3>
                                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                                        Välj en löpare i listan för att visa detaljer
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
