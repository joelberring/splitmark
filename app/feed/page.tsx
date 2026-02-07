'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import ActivityFeed, { Activity, generateDemoActivities } from '@/components/Feed/ActivityFeed';
import { useAuthState } from '@/lib/auth/hooks';
import { getPublishedEvents, type FirestoreEvent } from '@/lib/firestore/events';
import { addKudos, removeKudos, subscribeToKudos } from '@/lib/firestore/social';

interface FeedEvent {
    id: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    type: 'new_event' | 'results_published' | 'registration_open';
}

export default function FeedPage() {
    const { user } = useAuthState();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
    const [filter, setFilter] = useState<'all' | 'friends' | 'mine'>('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadContent = async () => {
            try {
                // Fetch events from Firestore
                const events = await getPublishedEvents();

                // 1. Process "New Events" / "News" list
                const news: FeedEvent[] = events.map(e => ({
                    id: e.id,
                    name: e.name,
                    date: e.date,
                    location: e.location || 'Okänd plats',
                    type: e.status === 'completed' ? 'results_published' : 'registration_open' // Simplification
                }));
                // Sort by date desc (already sorted by query usually, but failsafe)
                setFeedEvents(news);

                // 2. Generate Activities from Completed Events
                const completedEvents = events.filter(e => e.status === 'completed' && e.results && e.results.length > 0);

                let firestoreActivities: Activity[] = [];

                completedEvents.forEach(event => {
                    const eventDate = new Date(`${event.date}T${event.time || '10:00'}`);

                    // Take top 10 results from each event or all? Let's take a sample.
                    // If we have real data, we might want all of them properly sorted.
                    // For now, let's map ALL results to activities.
                    const eventActs: Activity[] = (event.results || []).map((res, idx) => ({
                        id: `act-${event.id}-${res.id || idx}`,
                        userId: res.id || `user-fake-${idx}`,
                        userName: res.name || 'Anonym löpare',
                        eventName: event.name,
                        eventId: event.id,
                        courseName: res.className || '',
                        date: eventDate, // Or result timestamp if we had it
                        duration: res.time || 0, // Seconds
                        distance: 0, // We assume 0 or random if not in result
                        resultStatus: (res.status?.toLowerCase() || 'ok') as 'ok' | 'mp' | 'dnf',
                        position: res.position,
                        totalInClass: 0, // We could calc this
                        className: res.className,
                        kudos: Math.floor(Math.random() * 5),
                        comments: 0
                    }));
                    firestoreActivities = [...firestoreActivities, ...eventActs];
                });

                // If no real data, fallback to demo/mixed
                const demoActivities = generateDemoActivities();

                // Sort all activities by date desc
                const allActivities = [...firestoreActivities, ...demoActivities].sort((a, b) => b.date.getTime() - a.date.getTime());

                setActivities(allActivities);

            } catch (error) {
                console.error('Failed to load feed:', error);
                setActivities(generateDemoActivities());
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, []);

    // Subscribe to kudos updates
    useEffect(() => {
        if (activities.length === 0) return;

        const activityIds = activities.map(a => a.id);
        const unsubscribe = subscribeToKudos(activityIds, (kudosMap) => {
            setActivities(prev => prev.map(a => {
                const kudosData = kudosMap.get(a.id);
                if (!kudosData) return a;
                return {
                    ...a,
                    kudos: kudosData.count,
                    hasKudoed: user?.uid ? kudosData.userIds.includes(user.uid) : false
                };
            }));
        });

        return () => unsubscribe();
    }, [activities.length, user?.uid]);

    const handleKudos = useCallback(async (activityId: string) => {
        if (!user?.uid) {
            // Optimistic update for anonymous users (client-side only)
            setActivities(prev => prev.map(a =>
                a.id === activityId
                    ? { ...a, kudos: a.hasKudoed ? a.kudos - 1 : a.kudos + 1, hasKudoed: !a.hasKudoed }
                    : a
            ));
            return;
        }

        const activity = activities.find(a => a.id === activityId);
        if (!activity) return;

        // Optimistic update
        setActivities(prev => prev.map(a =>
            a.id === activityId
                ? { ...a, kudos: a.hasKudoed ? a.kudos - 1 : a.kudos + 1, hasKudoed: !a.hasKudoed }
                : a
        ));

        // Persist to Firestore
        if (activity.hasKudoed) {
            await removeKudos(activityId, user.uid);
        } else {
            await addKudos(activityId, user.uid, user.displayName || undefined);
        }
    }, [activities, user]);

    const filteredActivities = activities.filter(a => {
        if (searchQuery) {
            return (
                a.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.className?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return true;
    });

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader title="Flöde" showLogo />

            {/* Search and Discovery */}
            <div className="px-4 py-4 bg-slate-900/50 backdrop-blur-md sticky top-[64px] z-30 border-b border-slate-800">
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                    <input
                        type="text"
                        placeholder="Sök resultat, löpare eller tävlingar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 border-none rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* New Events Section */}
            <section className="px-4 py-6 border-b border-slate-800 bg-slate-900/20">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Händelser & Nyheter
                    </h2>
                    <Link href="/events" className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wider transition-colors">Visa alla</Link>
                </div>
                {feedEvents.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {feedEvents.map(event => (
                            <Link
                                key={event.id}
                                href={`/spectate/${event.id}`} // Unified route
                                className="flex-shrink-0 w-64 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-all group"
                            >
                                <div className="h-24 bg-gradient-to-br from-emerald-900/50 to-slate-900 flex items-center justify-center">
                                    <span className="text-4xl opacity-50">
                                        {event.type === 'results_published' ? '🏆' : '📅'}
                                    </span>
                                </div>
                                <div className="p-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 ${event.type === 'results_published'
                                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                                        : 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                                        }`}>
                                        {event.type === 'results_published' ? 'Resultat' : 'Anmälan öppen'}
                                    </span>
                                    <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                        {event.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        📍 {event.location}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 italic">Inga nyheter just nu...</p>
                )}
            </section>

            {/* Activity Feed */}
            <main className="flex-1 py-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 px-4">
                    Aktivitet & Resultat
                </h2>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                    </div>
                ) : (
                    <ActivityFeed
                        activities={filteredActivities}
                        filter={filter}
                        onFilterChange={setFilter}
                        onKudos={handleKudos}
                        currentUserId={user?.uid}
                    />
                )}
            </main>
        </div>
    );
}

function parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parseInt(timeStr) || 0;
}
