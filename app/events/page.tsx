'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from '@/lib/auth/hooks';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { seedDemoEventsIfEmpty } from '@/lib/demo-data';
import { getEvents } from '@/lib/firestore/events';
import { getEventAccessProfile } from '@/lib/events/competition';

interface EventData {
    id: string;
    name: string;
    date: string;
    time?: string;
    location: string;
    classification?: string;
    organizer?: string;
    participants: number;
    status: 'draft' | 'upcoming' | 'live' | 'completed';
    isLive: boolean;
    canRegister: boolean;
    resultsUrl?: string;
    visibility?: string;
    clubId?: string;
    type?: string;
}

export default function EventsPage() {
    const { user } = useAuthState();
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'upcoming' | 'past' | 'trail'>('upcoming');

    useEffect(() => {
        const init = async () => {
            // Seed in background, don't await it
            seedDemoEventsIfEmpty().catch(err => console.warn("Background seeding failed:", err));

            try {
                await loadEvents();
            } catch (error) {
                console.error("Init failed:", error);
                setLoading(false);
            }
        };
        init();
    }, [filter, user]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            // Add a timeout to the fetch to prevent permanent loading skeletons
            const fetchWithTimeout = Promise.race([
                getEvents(),
                new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error("Timeout fetching events")), 8000))
            ]);

            const rawEvents = await fetchWithTimeout;
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

            const mapped: EventData[] = (rawEvents || []).map((e: any) => {
                const access = getEventAccessProfile(e, accessUser);

                return {
                    id: e.id,
                    name: e.name || 'Namnlös tävling',
                    date: e.date || new Date().toISOString().split('T')[0],
                    time: e.time,
                    location: e.location || 'Okänd plats',
                    classification: e.classification,
                    organizer: e.organizer,
                    participants: (e.entries?.length) ||
                        (Array.isArray(e.classes) ? e.classes.reduce((sum: number, c: any) => sum + (Number(c.entryCount) || 0), 0) : 0),
                    status: access.status,
                    isLive: access.status === 'live',
                    canRegister: access.canRegister,
                    resultsUrl: e.resultsUrl,
                    visibility: e.visibility,
                    clubId: e.clubId,
                    type: e.type,
                };
            });

            const filtered = mapped.filter((event: EventData) => {
                const access = getEventAccessProfile(event, accessUser);
                if (!access.canView) return false;

                if (filter === 'upcoming') return access.status === 'upcoming' || access.status === 'live';
                if (filter === 'past') return access.status === 'completed';
                if (filter === 'trail') return (event.type || '').toLowerCase() === 'trail';

                return true;
            });

            filtered.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (filter === 'upcoming') {
                    if (a.status === 'live' && b.status !== 'live') return -1;
                    if (a.status !== 'live' && b.status === 'live') return 1;
                    return dateA - dateB;
                }
                return dateB - dateA;
            });

            setEvents(filtered);
        } catch (error) {
            console.error('Error loading events:', error);
            // On error, try one last time from localStorage directly as absolute fallback
            try {
                const local = localStorage.getItem('events');
                if (local) setEvents(JSON.parse(local).slice(0, 20));
            } catch (e) {
                setEvents([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title="Tävlingar"
                showLogo
                rightAction={
                    (user?.role === 'admin' || user?.role === 'organizer') && (
                        <Link
                            href="/admin/events/new"
                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-emerald-500 transition-colors"
                        >
                            + Ny Tävling
                        </Link>
                    )
                }
            />

            {/* Filter Tabs */}
            <div className="px-4 py-4 flex gap-2 border-b border-slate-800">
                <button
                    onClick={() => setFilter('upcoming')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${filter === 'upcoming'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                >
                    Kommande
                </button>
                <button
                    onClick={() => setFilter('past')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${filter === 'past'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                >
                    Tidigare
                </button>
                <button
                    onClick={() => setFilter('trail')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${filter === 'trail'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                >
                    Trail
                </button>
            </div>

            {/* Events List */}
            <main className="flex-1 px-4 py-4">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
                        <div className="text-5xl mb-4 opacity-30">📅</div>
                        <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">
                            {filter === 'upcoming' ? 'Inga kommande tävlingar' : 'Inga tidigare tävlingar'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map((event) => (
                            <Link
                                key={event.id}
                                href={event.isLive ? `/spectate/${event.id}` : (event.resultsUrl || `/events/${event.id}`)}
                                className={`block bg-slate-900 rounded-xl overflow-hidden border-l-4 ${event.isLive ? 'border-red-500' : 'border-emerald-500'} hover:bg-slate-800/80 transition-all group`}
                            >
                                <div className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                                {event.name}
                                            </h3>
                                            {event.classification && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${event.classification === 'National'
                                                    ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50'
                                                    : 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                                                    }`}>
                                                    {event.classification}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <span className="text-emerald-500">📍</span>
                                                {event.location}
                                            </span>
                                            <span>•</span>
                                            <span>{formatDate(event.date)}</span>
                                            {event.time && (
                                                <>
                                                    <span>•</span>
                                                    <span>{event.time}</span>
                                                </>
                                            )}
                                        </div>
                                        {event.organizer && (
                                            <p className="text-xs text-slate-500 mt-1">{event.organizer}</p>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex-shrink-0">
                                        {event.isLive ? (
                                            <span className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-full animate-pulse">
                                                LIVE
                                            </span>
                                        ) : event.canRegister ? (
                                            <span className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-full">
                                                ANMÄL
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1.5 bg-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider rounded-full">
                                                RESULTAT
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
