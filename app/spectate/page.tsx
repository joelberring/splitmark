'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { useAuthState } from '@/lib/auth/hooks';
import { getEventAccessProfile } from '@/lib/events/competition';

interface LiveEvent {
    id: string;
    name: string;
    location: string;
    date: string;
    status: 'live' | 'upcoming' | 'completed';
    activeRunners: number;
    totalRunners: number;
    classes: string[];
    organizer?: string;
    speakerActive?: boolean;
}

export default function SpectatePage() {
    const { user } = useAuthState();
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'live' | 'upcoming'>('live');

    useEffect(() => {
        let unsubscribe = () => { };

        const init = async () => {
            const { subscribeToEvents } = await import('@/lib/firestore/events');

            let fallbackClubId: string | undefined;
            try {
                const userProfileStored = localStorage.getItem('userProfile');
                if (userProfileStored) {
                    const userProfile = JSON.parse(userProfileStored);
                    fallbackClubId = userProfile?.clubId;
                }
            } catch {
                fallbackClubId = undefined;
            }

            const accessUser = user ? { ...user, clubId: user.clubId || fallbackClubId } : null;

            unsubscribe = subscribeToEvents((firestoreEvents) => {
                const mappedEvents = firestoreEvents
                    .map((event) => {
                        const access = getEventAccessProfile(event, accessUser);
                        if (!access.canView) return null;

                        const status = access.status === 'completed' ? 'completed' : access.status;
                        if (status !== 'live' && status !== 'upcoming' && status !== 'completed') return null;

                        return {
                            id: event.id,
                            name: event.name,
                            location: event.location || 'Okänd plats',
                            date: event.date,
                            status,
                            activeRunners: (event.entries || []).filter(ent => ent.status === 'started').length,
                            totalRunners: (event.entries || []).length,
                            classes: event.classes?.map(c => c.name) || [],
                            organizer: event.organizer || 'Arrangör',
                        } as LiveEvent;
                    })
                    .filter(Boolean) as LiveEvent[];

                setEvents(mappedEvents);
                setLoading(false);
            });
        };

        init().catch((error) => {
            console.error('Failed to initialize spectate feed:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

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
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title="Livebevakning"
                subtitle="Följ tävlingar live med GPS och resultat"
                showLogo
                rightAction={
                    liveCount > 0 && (
                        <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1.5 rounded-full border border-red-800/50">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">{liveCount} Live</span>
                        </div>
                    )
                }
            />

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
        </div>
    );
}
