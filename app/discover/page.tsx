'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import EventCard from '@/components/Events/EventCard';
import { EventGridSkeleton } from '@/components/Events/EventCardSkeleton';
import type { EventFeedItem, EventType, SortOption } from '@/types/discover';

const TYPE_FILTERS: { id: EventType | 'all'; label: string; emoji: string }[] = [
    { id: 'all', label: 'Alla', emoji: '🌟' },
    { id: 'natt', label: 'Natt', emoji: '🌙' },
    { id: 'sprint', label: 'Sprint', emoji: '⚡' },
    { id: 'medel', label: 'Medel', emoji: '🏃' },
    { id: 'lång', label: 'Lång', emoji: '🗻' },
    { id: 'stafett', label: 'Stafett', emoji: '👥' },
];

const DEMO_EVENTS: EventFeedItem[] = [
    {
        id: 'event-1', name: 'Vårsprånget', description: 'Årets första stora tävling', date: '2025-03-15', time: '10:00',
        heroImage: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop',
        location: { name: 'Lunsen', municipality: 'Uppsala', distanceFromUser: 12 },
        type: 'medel', level: 'national', terrain: 'forest', entryCount: 142, maxEntries: 300, courseLength: 8.2,
        organiser: { id: 'ok-linne', name: 'OK Linné' }, social: { likes: 23, comments: 5, shares: 3 },
        registrationOpen: true, isFeatured: true, clubMatesGoingCount: 4,
    },
    {
        id: 'event-2', name: 'Stockholms Natt-OL', description: 'Klassisk nattorientering', date: '2025-03-22', time: '19:00',
        heroImage: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop',
        location: { name: 'Tyresta', municipality: 'Stockholm', distanceFromUser: 35 },
        type: 'natt', level: 'regional', terrain: 'forest', entryCount: 86, courseLength: 5.5,
        organiser: { id: 'jarla', name: 'Järla Orientering' }, social: { likes: 45, comments: 12, shares: 8 },
        registrationOpen: true, clubMatesGoingCount: 2,
    },
    {
        id: 'event-3', name: 'Göteborgs Stadsprint', description: 'Sprint genom Göteborgs centrum', date: '2025-04-05', time: '11:00',
        heroImage: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop',
        location: { name: 'Haga', municipality: 'Göteborg', distanceFromUser: 450 },
        type: 'sprint', level: 'national', terrain: 'urban', entryCount: 198, maxEntries: 250, courseLength: 3.2,
        organiser: { id: 'ifk-gbg', name: 'IFK Göteborg' }, social: { likes: 67, comments: 18, shares: 12 },
        registrationOpen: true,
    },
];

export default function DiscoverPage() {
    const [events, setEvents] = useState<EventFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeType, setActiveType] = useState<EventType | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [likedEvents, setLikedEvents] = useState<Set<string>>(new Set());
    const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setEvents(DEMO_EVENTS);
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const filteredEvents = useMemo(() => {
        let result = [...events];
        if (activeType !== 'all') result = result.filter(e => e.type === activeType);
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.location.name.toLowerCase().includes(query) ||
                e.organiser.name.toLowerCase().includes(query)
            );
        }
        return result;
    }, [events, activeType, searchQuery]);

    const handleLike = (eventId: string) => {
        setLikedEvents(prev => {
            const next = new Set(prev);
            next.has(eventId) ? next.delete(eventId) : next.add(eventId);
            return next;
        });
    };

    const handleSave = (eventId: string) => {
        setSavedEvents(prev => {
            const next = new Set(prev);
            next.has(eventId) ? next.delete(eventId) : next.add(eventId);
            return next;
        });
    };

    const displayEvents = filteredEvents.map(e => ({
        ...e,
        isLiked: likedEvents.has(e.id),
        isSaved: savedEvents.has(e.id),
    }));

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader title="Upptäck" showLogo />

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-800">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Sök tävling, plats eller arrangör..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 pl-11 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                </div>
            </div>

            {/* Type Chips */}
            <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-slate-800">
                {TYPE_FILTERS.map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveType(filter.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeType === filter.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <span>{filter.emoji}</span>
                        <span>{filter.label}</span>
                    </button>
                ))}
            </div>

            {/* Events Grid */}
            <main className="flex-1 px-4 py-6">
                {loading ? (
                    <EventGridSkeleton count={6} />
                ) : displayEvents.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 opacity-30">🔍</div>
                        <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">Inga tävlingar hittades</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayEvents.map((event, index) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                variant={index === 0 && event.isFeatured ? 'featured' : 'grid'}
                                onLike={handleLike}
                                onSave={handleSave}
                            />
                        ))}
                    </div>
                )}
            </main>

        </div>
    );
}
