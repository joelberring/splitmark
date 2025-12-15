'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from '@/lib/auth/hooks';
import Link from 'next/link';
import { seedDemoEventsIfEmpty } from '@/lib/demo-data';

interface EventCardData {
  id: string;
  name: string;
  location: string;
  date: string;
  participants: number;
  isLive?: boolean;
  canRegister?: boolean;
}

export default function HomePage() {
  const { user, loading, isAuthenticated } = useAuthState();
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    // Seed demo events if none exist
    seedDemoEventsIfEmpty();

    // Load events from localStorage
    const stored = localStorage.getItem('events');
    if (stored) {
      const rawEvents = JSON.parse(stored);
      const now = new Date();

      const mapped: EventCardData[] = rawEvents.map((e: any) => {
        const eventDate = new Date(e.date);
        const isPast = eventDate < now;
        const isToday = eventDate.toDateString() === now.toDateString();

        return {
          id: e.id,
          name: e.name,
          location: e.location || 'Okänd plats',
          date: e.date,
          participants: e.entries?.length || e.classes?.reduce((sum: number, c: any) => sum + (c.entryCount || 0), 0) || 0,
          isLive: isToday || e.status === 'live',
          canRegister: !isPast && e.status !== 'completed',
        };
      });

      // Sort: live first, then upcoming, then past
      mapped.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setEvents(mapped.slice(0, 5));
    } else {
      // Demo events if none in storage
      setEvents([
        { id: '1', name: 'SM Medeldistans', location: 'Örebro', date: '2025-10-26', participants: 320, isLive: true },
        { id: '2', name: 'Stockholm City Race', location: 'Stadsmiljö', date: '2025-11-12', participants: 850, canRegister: true },
        { id: '3', name: 'Nattorientering Tyresta', location: 'Tyresta', date: '2025-12-18', participants: 45, canRegister: true },
      ]);
    }

    setLoadingEvents(false);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '');
    return `${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* Hero Section with Background Image */}
      <section className="relative h-[50vh] min-h-[400px] flex flex-col">
        {/* Background Image - Night Orienteering */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/hero-bg.png')`,
          }}
        >
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/60 to-slate-950"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10 p-4 pt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Splitmark</span>
          </div>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 flex-1 flex flex-col justify-end p-6 pb-10">
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight italic">
            NÄSTA<br />
            GENERATIONENS<br />
            ORIENTERING
          </h1>
        </div>
      </section>

      {/* Event Cards */}
      <main className="flex-1 px-4 -mt-6 relative z-20 pb-24">
        <div className="space-y-4">
          {loadingEvents ? (
            <>
              <div className="h-24 bg-slate-900 rounded-xl animate-pulse"></div>
              <div className="h-24 bg-slate-900 rounded-xl animate-pulse"></div>
            </>
          ) : events.length === 0 ? (
            <div className="bg-slate-900 rounded-xl p-8 text-center">
              <p className="text-slate-500">Inga tävlingar att visa</p>
              <Link href="/events" className="text-emerald-500 font-bold mt-2 inline-block">
                Utforska tävlingar →
              </Link>
            </div>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block bg-slate-900 rounded-xl overflow-hidden border-l-4 border-emerald-500 hover:bg-slate-800/80 transition-all group"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {event.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <span className="text-emerald-500">📍</span>
                        {event.location}
                      </span>
                      <span>•</span>
                      <span>{formatDate(event.date)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        {event.participants} {event.isLive ? 'Deltagare' : 'Anmälda'}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0 ml-4">
                    {event.isLive ? (
                      <span className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-full animate-pulse">
                        LIVE NU
                      </span>
                    ) : event.canRegister ? (
                      <span className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-full">
                        ANMÄL DIG
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-3 z-50">
        <div className="max-w-lg mx-auto flex justify-around items-center">
          <Link href="/" className="flex flex-col items-center gap-1 text-emerald-500">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Feed</span>
          </Link>

          <Link href="/events" className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Kalender</span>
          </Link>

          <Link href="/profile" className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profil</span>
          </Link>

          <Link href="/settings" className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Inställningar</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
