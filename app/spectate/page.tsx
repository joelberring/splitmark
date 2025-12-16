'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';

interface LiveEvent {
    id: string;
    name: string;
    location: string;
    date: string;
    status: 'live' | 'upcoming' | 'finished';
    activeRunners: number;
    totalRunners: number;
    classes: string[];
    organizer?: string;
    speakerActive?: boolean;
}

export default function SpectatePage() {
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'live' | 'upcoming'>('live');



    useEffect(() => {
        // Subscribe to real-time updates
        import('@/lib/firestore/events').then(({ subscribeToEvents }) => {
            const unsubscribe = subscribeToEvents((firestoreEvents) => {
                const mappedEvents: LiveEvent[] = firestoreEvents.map(e => ({
                    id: e.id,
                    name: e.name,
                    location: e.location || 'Okänd plats',
                    date: e.date,
                    status: e.status === 'active' ? 'live' : e.status === 'draft' ? 'upcoming' : 'finished',
                    activeRunners: e.entries.filter(ent => ent.status === 'started').length,
                    totalRunners: e.entries.length,
                    classes: e.classes?.map(c => c.name) || [],
                    organizer: 'Arrangör', // TODO: Add organizer to event model
                }));
                // Filter out completed/draft events that aren't relevant? 
                // Currently keeping them but mapping status.
                setEvents(mappedEvents);
                setLoading(false);
            });
            return () => unsubscribe();
        });
    }, []);

    const filteredEvents = events.filter(e =>
        filter === 'live' ? e.status === 'live' : e.status === 'upcoming'
    );

    const liveCount = events.filter(e => e.status === 'live').length;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-24">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-4">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold uppercase tracking-tight">Livebevakning</h1>
                    {liveCount > 0 && (
                        <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1.5 rounded-full border border-red-800/50">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">{liveCount} Live</span>
                        </div>
                    )}
                </div>
                <p className="text-slate-500 text-sm">
                    Följ pågående tävlingar live med GPS-spår och resultat.
                </p>
            </header>

            {/* Filter tabs */}
            <div className="bg-slate-900 border-b border-slate-800 px-4">
                <div className="flex gap-4">
                    <button
                        onClick={() => setFilter('live')}
                        className={`py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-colors ${filter === 'live'
                            ? 'border-red-500 text-red-400'
                            : 'border-transparent text-slate-500 hover:text-white'
                            }`}
                    >
                        🔴 Pågår nu
                    </button>
                    <button
                        onClick={() => setFilter('upcoming')}
                        className={`py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-colors ${filter === 'upcoming'
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-white'
                            }`}
                    >
                        📅 Kommande
                    </button>
                </div>
            </div>

            <main className="flex-1 px-4 py-4">
                {filteredEvents.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 opacity-30">{filter === 'live' ? '📡' : '⏳'}</div>
                        <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">
                            {filter === 'live'
                                ? 'Inga tävlingar live just nu'
                                : 'Inga kommande tävlingar med planerad livebevakning'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredEvents.map((event) => (
                            <Link
                                key={event.id}
                                href={`/spectate/${event.id}`}
                                className="block bg-slate-900 rounded-xl overflow-hidden border-l-4 border-red-500 hover:bg-slate-800/80 transition-all group"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                                    {event.name}
                                                </h3>
                                                {event.speakerActive && (
                                                    <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-800/50 rounded text-[10px] font-bold">
                                                        🎙️
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="text-emerald-500">📍</span>
                                                    {event.location}
                                                </span>
                                            </div>
                                            {event.organizer && (
                                                <p className="text-xs text-slate-500 mt-1">{event.organizer}</p>
                                            )}
                                        </div>

                                        <div className="flex-shrink-0 text-right">
                                            {event.status === 'live' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                    <span className="text-lg font-bold text-white">{event.activeRunners}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 text-sm">{event.totalRunners}</span>
                                            )}
                                            <p className="text-xs text-slate-500">
                                                {event.status === 'live' ? 'aktiva' : 'anmälda'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Classes */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {event.classes.slice(0, 4).map((cls) => (
                                            <span
                                                key={cls}
                                                className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-bold uppercase"
                                            >
                                                {cls}
                                            </span>
                                        ))}
                                        {event.classes.length > 4 && (
                                            <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-[10px] font-bold">
                                                +{event.classes.length - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            <BottomNavigation />
        </div>
    );
}
