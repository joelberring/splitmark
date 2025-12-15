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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-gray-500">Laddar profil...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <Link
                    href="/"
                    className="text-sm text-gray-500 hover:text-emerald-600 mb-4 inline-block"
                >
                    ← Tillbaka
                </Link>

                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {user?.displayName?.[0] || userId[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                {user?.displayName || `Användare ${userId}`}
                            </h1>
                            {user?.email && (
                                <p className="text-gray-500">{user.email}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold">
                                    Medlem
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    {results.length} resultat
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
                        <div className="text-3xl font-bold text-emerald-600">
                            {results.length}
                        </div>
                        <div className="text-sm text-gray-500">Tävlingar</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
                        <div className="text-3xl font-bold text-yellow-500">
                            {results.filter(r => r.position === 1).length}
                        </div>
                        <div className="text-sm text-gray-500">Segrar</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
                        <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                            {results.filter(r => r.position <= 3 && r.position > 0).length}
                        </div>
                        <div className="text-sm text-gray-500">Pallplatser</div>
                    </div>
                </div>

                {/* Results History */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                            📊 Resultathistorik
                        </h2>
                    </div>

                    {results.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Inga resultat hittades för denna användare
                        </div>
                    ) : (
                        <div className="divide-y dark:divide-gray-700">
                            {results.map((result, idx) => (
                                <Link
                                    key={idx}
                                    href={`/events/${result.eventId}`}
                                    className="block px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${result.position === 1 ? 'bg-yellow-400 text-yellow-900' :
                                                result.position === 2 ? 'bg-gray-300 text-gray-700' :
                                                    result.position === 3 ? 'bg-orange-400 text-orange-900' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                            {result.position || '-'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {result.eventName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {result.eventDate} • {result.className}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-gray-800 dark:text-gray-100">
                                                {formatTime(result.time)}
                                            </div>
                                            {result.status !== 'OK' && result.status !== 'finished' && (
                                                <div className="text-red-500 text-sm">{result.status}</div>
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
