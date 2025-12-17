'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useAuthState } from '@/lib/auth/hooks';

interface Club {
    id: string;
    name: string;
    shortName?: string;
}

interface ClubResult {
    eventId: string;
    eventName: string;
    eventDate: string;
    className: string;
    personName: string;
    position?: string;
    time?: string;
    status: string;
}

export default function ClubHomepage() {
    const { clubId } = useParams() as { clubId: string };
    const { user } = useAuthState();
    const [club, setClub] = useState<Club | null>(null);
    const [results, setResults] = useState<ClubResult[]>([]);
    const [activeTab, setActiveTab] = useState<'results' | 'activity' | 'info' | 'chat'>('results');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (clubId) {
            fetchClubData();
        }
    }, [clubId]);

    const fetchClubData = async () => {
        setLoading(true);
        try {
            // Fetch club info
            const clubRes = await fetch(`/api/eventor/clubs/${clubId}`);
            if (clubRes.ok) {
                const clubData = await clubRes.json();
                setClub(clubData);
            }

            // Fetch results
            const resultsRes = await fetch(`/api/eventor/results/${clubId}`);
            if (resultsRes.ok) {
                const resultsData = await resultsRes.json();
                setResults(resultsData.results);
            }
        } catch (error) {
            console.error('Failed to fetch club data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-6xl mb-6">🏚️</div>
                <h1 className="text-2xl font-bold text-white mb-2">Klubben hittades inte</h1>
                <p className="text-slate-500 mb-8">Vi kunde inte hitta organisationen du letar efter.</p>
                <button onClick={() => window.history.back()} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Gå tillbaka</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20">
            <PageHeader
                title={club.name}
                showLogo
            />

            {/* Club Banner/Header */}
            <div className="relative h-32 bg-gradient-to-br from-emerald-600 to-emerald-900 border-b border-emerald-500/30 overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="absolute bottom-4 left-6 flex items-end gap-4">
                    <div className="w-20 h-20 bg-slate-900 rounded-2xl border-4 border-slate-950 flex items-center justify-center text-3xl shadow-2xl">
                        🏠
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <nav className="flex px-4 border-b border-slate-800 overflow-x-auto no-scrollbar bg-slate-950 sticky top-[64px] z-30">
                <button
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeTab === 'results' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    Resultat
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={`px-4 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeTab === 'activity' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    Aktivitet
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeTab === 'info' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    Information
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeTab === 'chat' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    Chatt
                </button>
            </nav>

            {/* Content */}
            <main className="p-4">
                {activeTab === 'results' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Senaste resultat</h2>
                            <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono">Last 30 days</span>
                        </div>

                        {results.length === 0 ? (
                            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
                                <div className="text-4xl mb-4 opacity-30">🥈</div>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Inga recenta resultat hittades</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {results.map((res, i) => (
                                    <div key={i} className="bg-slate-900 rounded-xl p-4 border border-slate-800 hover:bg-slate-800/50 transition-colors group">
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className="font-bold text-emerald-400 text-xs uppercase">{res.personName}</span>
                                            <span className="text-slate-500 text-[10px] font-mono">{res.eventDate}</span>
                                        </div>
                                        <h3 className="text-white font-bold leading-tight group-hover:text-emerald-300 transition-colors">{res.eventName}</h3>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">{res.className}</span>
                                            <span className="text-sm font-bold text-white">
                                                {res.status === 'OK' ? (res.position ? `#${res.position}` : 'Godkänd') : res.status}
                                            </span>
                                            {res.time && <span className="text-sm font-mono text-emerald-500/80">{res.time}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Klubbaktiviteter</h2>
                            <Link
                                href="/admin/events/new"
                                className="text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                + Ny träning
                            </Link>
                        </div>

                        {(() => {
                            const storedEvents = JSON.parse(localStorage.getItem('events') || '[]');
                            const clubEvents = storedEvents.filter((e: any) => e.clubId === clubId && e.visibility === 'club');

                            if (clubEvents.length === 0) {
                                return (
                                    <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 border-dashed">
                                        <div className="text-4xl mb-4 opacity-30">🏃</div>
                                        <h3 className="text-white font-bold mb-1">Inga interna aktiviteter</h3>
                                        <p className="text-slate-500 text-xs">Här visas klubbträningar och interna event som inte syns för utomstående.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-2">
                                    {clubEvents.map((event: any) => (
                                        <Link
                                            key={event.id}
                                            href={`/events/${event.id}`}
                                            className="block bg-slate-900 rounded-xl p-4 border border-slate-800 hover:bg-slate-800/50 transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-white group-hover:text-emerald-400">{event.name}</h3>
                                                <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50 font-bold uppercase">Intern</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span>📅 {event.date}</span>
                                                <span>📍 {event.location}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="space-y-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Information & Anslagstavla</h2>
                        <div className="grid gap-4">
                            <div className="bg-blue-900/20 border border-blue-800/50 rounded-2xl p-6">
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-2">💡 Välkommen</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">Välkommen till {club.name}s nya klubbsida. Här samlar vi allt som rör klubben, från resultat till interna träningar.</p>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">2025-12-17 · Info</div>
                                <h3 className="text-white font-bold uppercase text-xs mb-2">Vinterserien startar!</h3>
                                <p className="text-slate-400 text-sm">Nu drar vi igång årets vinterserie. Kolla kalendern för tider och platser.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="flex flex-col h-[50vh] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="flex-1 p-4 overflow-y-auto space-y-4">
                            <div className="text-center py-8">
                                <div className="text-3xl mb-2 opacity-20">💬</div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Börja chatta med medlemmarna</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-800">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                    placeholder="Skriv ett meddelande..."
                                />
                                <button className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <BottomNavigation />
        </div>
    );
}
