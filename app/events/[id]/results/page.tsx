'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    rankEntriesByClass,
    formatResultTime,
    formatTimeBehind,
} from '@/lib/results/ranking';

interface EventClass {
    id: string;
    name: string;
}

export default function PublicResultsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<any[]>([]);
    const [classes, setClasses] = useState<EventClass[]>([]);
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('all');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        let unsubscribeResults = () => { };

        const init = async () => {
            try {
                const { getEvent } = await import('@/lib/firestore/events');
                const { subscribeToResults } = await import('@/lib/firestore/results');

                const event = await getEvent(eventId);
                if (event) {
                    setEventName(event.name);
                    setEventDate(event.date);
                    setClasses(event.classes || []);

                    unsubscribeResults = subscribeToResults(eventId, (updatedResults) => {
                        setEntries(updatedResults as any[]);
                        setLastUpdated(new Date());
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error initializing results listener:', error);
                setLoading(false);
            }
        };

        init();

        return () => unsubscribeResults();
    }, [eventId]);

    const rankedClasses = useMemo(() => {
        const groups = rankEntriesByClass(entries);
        const classMap = new Map(classes.map((c) => [c.id, c.name]));

        return groups.map((group) => ({
            ...group,
            className: classMap.get(group.classId) || group.className || group.classId,
        }));
    }, [entries, classes]);

    const filteredClasses = useMemo(() => {
        if (selectedClass === 'all') return rankedClasses;
        return rankedClasses.filter((group) => group.classId === selectedClass);
    }, [rankedClasses, selectedClass]);

    const stats = useMemo(() => {
        const all = rankedClasses.flatMap((group) => group.entries);
        return {
            total: all.length,
            finishedOk: all.filter((item) => item.status === 'OK').length,
            mp: all.filter((item) => item.status === 'MP').length,
            dnf: all.filter((item) => item.status === 'DNF').length,
        };
    }, [rankedClasses]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <Link href={`/events/${eventId}`} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-3 inline-block transition-colors">
                        ← Tillbaka till tävlingen
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold uppercase tracking-tight text-white">
                                {eventName}
                            </h1>
                            <p className="text-slate-400 mt-1">
                                {eventDate && new Date(eventDate).toLocaleDateString('sv-SE', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">
                            <div className="mb-1 text-emerald-500 font-black">🏃 {stats.finishedOk} / {stats.total} godkända</div>
                            <div className="text-[10px] opacity-70">MP: {stats.mp} · DNF: {stats.dnf}</div>
                            {lastUpdated && (
                                <div className="text-[10px] opacity-70 mt-1">
                                    Uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedClass('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${selectedClass === 'all'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                            }`}
                    >
                        Alla klasser
                    </button>
                    {classes.map(cls => (
                        <button
                            key={cls.id}
                            onClick={() => setSelectedClass(cls.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${selectedClass === cls.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                                }`}
                        >
                            {cls.name}
                        </button>
                    ))}
                </div>

                {filteredClasses.length === 0 ? (
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
                        <div className="text-6xl mb-6 opacity-30">⏳</div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-2">
                            Inga resultat ännu
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">
                            Resultat uppdateras automatiskt
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredClasses.map((group) => (
                            <div key={group.classId} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-black text-2xl uppercase tracking-tight text-white">{group.className}</h2>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                            {group.entries.filter(item => item.status === 'OK').length} godkända av {group.entries.length}
                                        </p>
                                    </div>
                                    <Link href={`/events/${eventId}/results/${group.classId}`} className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
                                        Visa detaljer →
                                    </Link>
                                </div>

                                <div className="divide-y divide-slate-800/50">
                                    {group.entries.slice(0, 50).map((ranked) => {
                                        const entry = ranked.entry;
                                        const position = ranked.position;
                                        const isTop = position && position <= 3;

                                        return (
                                            <div
                                                key={ranked.id}
                                                className={`py-1 px-4 flex items-center justify-between transition-colors hover:bg-slate-800/30 ${isTop && position === 1 ? 'bg-emerald-500/5' :
                                                    isTop && position === 2 ? 'bg-slate-400/5' :
                                                        isTop && position === 3 ? 'bg-amber-500/5' : ''
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-[10px] ${position === 1 ? 'bg-emerald-500 text-slate-950' :
                                                        position === 2 ? 'bg-slate-400 text-slate-950' :
                                                            position === 3 ? 'bg-amber-500 text-slate-950' :
                                                                position ? 'bg-slate-800 text-slate-400' :
                                                                    'bg-slate-800/50 text-slate-600'
                                                        }`}>
                                                        {position || '-'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-white leading-tight">
                                                            {ranked.name}
                                                        </div>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                                                            {entry.clubName || entry.club}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {ranked.status === 'OK' ? (
                                                        <>
                                                            <div className="text-xl font-mono font-black text-white">
                                                                {formatResultTime(ranked.timeSeconds)}
                                                            </div>
                                                            {ranked.timeBehindSeconds && ranked.timeBehindSeconds > 0 && (
                                                                <div className="text-xs font-bold text-slate-500 mt-0.5">
                                                                    {formatTimeBehind(ranked.timeBehindSeconds)}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="text-[12px] font-black text-red-500 uppercase tracking-widest mt-0.5">
                                                            {ranked.status}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
