'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StoredEvent {
    id: string;
    name: string;
    date: string;
    entries?: any[];
    classes?: any[];
}

interface UserResult {
    eventId: string;
    eventName: string;
    eventDate: string;
    className: string;
    position: number;
    time: number;
    status: string;
}

export default function MemberProfilePage() {
    const params = useParams();
    const userId = params.userId as string;

    const [user, setUser] = useState<any | null>(null);
    const [results, setResults] = useState<UserResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Load user info
        const devUser = localStorage.getItem('dev-auth-user');
        if (devUser) {
            const parsed = JSON.parse(devUser);
            if (parsed.id === userId) {
                setUser(parsed);
            }
        }

        // Find all results for this user across all events
        const userResults: UserResult[] = [];
        const eventsData = localStorage.getItem('events');

        if (eventsData) {
            const events: StoredEvent[] = JSON.parse(eventsData);

            for (const event of events) {
                if (!event.entries) continue;

                // Find entries matching this user
                const userEntries = event.entries.filter((entry: any) => {
                    // Match by user ID or by name
                    const entryName = entry.name || `${entry.firstName} ${entry.lastName}`;
                    const lookupKey = entryName?.toLowerCase().trim();

                    // Check if this matches the user we're looking at
                    if (user) {
                        return lookupKey === user.displayName?.toLowerCase().trim();
                    }
                    return false;
                });

                for (const entry of userEntries) {
                    userResults.push({
                        eventId: event.id,
                        eventName: event.name,
                        eventDate: event.date,
                        className: entry.className || 'Okänd',
                        position: entry.position || 0,
                        time: entry.time || 0,
                        status: entry.status || 'OK',
                    });
                }
            }
        }

        setResults(userResults.sort((a, b) =>
            new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        ));
        setLoading(false);
    }, [userId, user]);

    const formatTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Laddar profil...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <Link
                    href="/"
                    className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-6 inline-block transition-colors"
                >
                    ← Tillbaka
                </Link>

                {/* Profile Header */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 mb-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
                    <div className="flex items-center gap-8 relative z-10">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 text-4xl font-black shadow-xl shadow-emerald-900/20">
                            {user?.displayName?.[0] || userId[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-1">
                                {user?.displayName || `Användare ${userId}`}
                            </h1>
                            {user?.email && (
                                <p className="text-slate-400 font-medium text-lg">{user.email}</p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] rounded border border-emerald-500/20 font-black uppercase tracking-widest">
                                    Medlem
                                </span>
                                <span className="px-3 py-1 bg-slate-800 text-slate-400 text-[10px] rounded border border-slate-700 font-black uppercase tracking-widest">
                                    {results.length} resultat
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center shadow-xl">
                        <div className="text-4xl font-black text-white mb-1">
                            {results.length}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tävlingar</div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="text-4xl font-black text-amber-500 mb-1 relative z-10">
                            {results.filter(r => r.position === 1).length}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 relative z-10">Segrar</div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center shadow-xl">
                        <div className="text-4xl font-black text-slate-300 mb-1">
                            {results.filter(r => r.position <= 3 && r.position > 0).length}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pallplatser</div>
                    </div>
                </div>

                {/* Results History */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/50">
                        <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <span className="text-emerald-500">📊</span> Resultathistorik
                        </h2>
                    </div>

                    {results.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="text-5xl mb-4 opacity-20 filter grayscale">🏃‍♂️</div>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                                Inga resultat ännu
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {results.map((result, idx) => (
                                <Link
                                    key={idx}
                                    href={`/events/${result.eventId}`}
                                    className="block px-6 py-5 hover:bg-slate-800 transition-colors group"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm shadow-inner ${result.position === 1 ? 'bg-amber-500 text-slate-950' :
                                            result.position === 2 ? 'bg-slate-400 text-slate-950' :
                                                result.position === 3 ? 'bg-amber-700 text-slate-950' :
                                                    'bg-slate-800 text-slate-500'
                                            }`}>
                                            {result.position || '-'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-white group-hover:text-emerald-400 transition-colors text-lg">
                                                {result.eventName}
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
                                                {new Date(result.eventDate).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', year: 'numeric' })} • {result.className}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-black text-xl text-white">
                                                {formatTime(result.time)}
                                            </div>
                                            {result.status !== 'OK' && result.status !== 'finished' && (
                                                <div className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{result.status}</div>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
