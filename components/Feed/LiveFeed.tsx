'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface LiveEvent {
    id: string;
    name: string;
    location: string;
    startTime: Date;
    status: 'upcoming' | 'live' | 'finished';
    runnersActive: number;
    runnersFinished: number;
    runnersTotal: number;
    isRegistered?: boolean;
    isCheckedIn?: boolean;
    userStartTime?: Date;
    userClassName?: string;
    // GPS coordinates for check-in verification
    coordinates?: { lat: number; lng: number };
    checkInRadius?: number; // meters, default 500m
}

interface LiveFeedProps {
    events: LiveEvent[];
    onCheckIn: (eventId: string, verified: boolean) => void;
    currentUserId?: string;
}

export default function LiveFeed({
    events,
    onCheckIn,
    currentUserId,
}: LiveFeedProps) {
    const sortedEvents = [...events].sort((a, b) => {
        // Live events first, then upcoming, then finished
        const statusOrder = { live: 0, upcoming: 1, finished: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.startTime.getTime() - b.startTime.getTime();
    });

    const liveEvents = sortedEvents.filter(e => e.status === 'live');
    const upcomingEvents = sortedEvents.filter(e => e.status === 'upcoming');
    const myEvents = sortedEvents.filter(e => e.isRegistered);

    return (
        <div className="space-y-6">
            {/* My Upcoming Check-in */}
            {myEvents.filter(e => e.status === 'upcoming' && !e.isCheckedIn).length > 0 && (
                <div className="px-4">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Din nästa start
                    </h3>
                    {myEvents
                        .filter(e => e.status === 'upcoming' && !e.isCheckedIn)
                        .slice(0, 1)
                        .map(event => (
                            <CheckInCard
                                key={event.id}
                                event={event}
                                onCheckIn={onCheckIn}
                            />
                        ))}
                </div>
            )}

            {/* Live Now */}
            {liveEvents.length > 0 && (
                <div className="px-4">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Live nu
                    </h3>
                    <div className="space-y-3">
                        {liveEvents.map(event => (
                            <LiveEventCard key={event.id} event={event} />
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
                <div className="px-4">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Kommande
                    </h3>
                    <div className="space-y-3">
                        {upcomingEvents.map(event => (
                            <UpcomingEventCard
                                key={event.id}
                                event={event}
                                onCheckIn={onCheckIn}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {events.length === 0 && (
                <div className="text-center py-12 px-4">
                    <p className="text-gray-500 dark:text-gray-400">
                        Inga pågående eller kommande tävlingar
                    </p>
                    <Link
                        href="/discover"
                        className="inline-block mt-4 text-emerald-600 font-semibold"
                    >
                        Upptäck tävlingar
                    </Link>
                </div>
            )}
        </div>
    );
}

function CheckInCard({
    event,
    onCheckIn,
}: {
    event: LiveEvent;
    onCheckIn: (id: string, verified: boolean) => void;
}) {
    const [checking, setChecking] = useState(false);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'checking' | 'verified' | 'too_far' | 'error'>('idle');

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    };

    const getTimeUntilStart = () => {
        if (!event.userStartTime) return null;
        const diff = event.userStartTime.getTime() - Date.now();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);

        if (mins < 0) return 'Startat';
        if (mins < 60) return `${mins} min`;
        return `${hours}h ${mins % 60}min`;
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleCheckIn = async () => {
        setChecking(true);
        setGpsStatus('checking');

        // If no coordinates on event, just check in without verification
        if (!event.coordinates) {
            onCheckIn(event.id, false);
            setChecking(false);
            return;
        }

        // Get user's location
        if (!navigator.geolocation) {
            setGpsStatus('error');
            // Allow check-in anyway
            onCheckIn(event.id, false);
            setChecking(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const distance = calculateDistance(
                    position.coords.latitude,
                    position.coords.longitude,
                    event.coordinates!.lat,
                    event.coordinates!.lng
                );

                const maxRadius = event.checkInRadius || 500; // Default 500m

                if (distance <= maxRadius) {
                    setGpsStatus('verified');
                    onCheckIn(event.id, true);
                } else {
                    setGpsStatus('too_far');
                    // Show distance, but still allow check-in
                    setTimeout(() => {
                        onCheckIn(event.id, false);
                    }, 2000);
                }
                setChecking(false);
            },
            (error) => {
                console.error('GPS error:', error);
                setGpsStatus('error');
                // Allow check-in anyway
                onCheckIn(event.id, false);
                setChecking(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="font-bold text-lg">{event.name}</h4>
                    <p className="text-emerald-100 text-sm">{event.location}</p>
                </div>
                {event.userClassName && (
                    <span className="px-2 py-1 bg-white/20 rounded text-sm font-medium">
                        {event.userClassName}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between">
                <div>
                    {event.userStartTime && (
                        <p className="text-sm text-emerald-100">
                            Start: {formatTime(event.userStartTime)}
                            {getTimeUntilStart() && (
                                <span className="ml-2 font-semibold text-white">
                                    ({getTimeUntilStart()})
                                </span>
                            )}
                        </p>
                    )}
                    {gpsStatus === 'too_far' && (
                        <p className="text-xs text-yellow-200 mt-1">
                            Du verkar inte vara vid tävlingsplatsen
                        </p>
                    )}
                </div>
                <button
                    onClick={handleCheckIn}
                    disabled={checking}
                    className="px-4 py-2 bg-white text-emerald-600 rounded-lg font-bold hover:bg-emerald-50 transition-colors disabled:opacity-70"
                >
                    {checking ? (
                        gpsStatus === 'checking' ? 'Verifierar...' : 'Checkar in...'
                    ) : (
                        'Checka in'
                    )}
                </button>
            </div>
        </div>
    );
}

function LiveEventCard({ event }: { event: LiveEvent }) {
    const progress = event.runnersTotal > 0
        ? (event.runnersFinished / event.runnersTotal) * 100
        : 0;

    return (
        <Link href={`/live?event=${event.id}`}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 border-red-500 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100">
                                {event.name}
                            </h4>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {event.location}
                        </p>
                    </div>
                    {event.isRegistered && (
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded">
                            Anmäld
                        </span>
                    )}
                </div>

                {/* Progress */}
                <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{event.runnersActive} i skogen</span>
                        <span>{event.runnersFinished}/{event.runnersTotal} i mål</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function UpcomingEventCard({
    event,
    onCheckIn,
}: {
    event: LiveEvent;
    onCheckIn: (id: string, verified: boolean) => void;
}) {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">
                        {event.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {event.location}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(event.startTime)}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {event.isRegistered ? (
                        <>
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded">
                                Anmäld
                            </span>
                            {!event.isCheckedIn && (
                                <button
                                    onClick={() => onCheckIn(event.id, false)}
                                    className="text-sm text-emerald-600 font-semibold"
                                >
                                    Checka in
                                </button>
                            )}
                            {event.isCheckedIn && (
                                <span className="text-xs text-gray-500">Incheckad</span>
                            )}
                        </>
                    ) : (
                        <Link
                            href={`/events/${event.id}`}
                            className="text-sm text-emerald-600 font-semibold"
                        >
                            Visa
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

// Demo data generator
export function generateDemoLiveEvents(): LiveEvent[] {
    return [
        {
            id: 'live-1',
            name: 'Bosön Sprint',
            location: 'Bosön, Lidingö',
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'live',
            runnersActive: 45,
            runnersFinished: 123,
            runnersTotal: 180,
            isRegistered: true,
            isCheckedIn: true,
        },
        {
            id: 'live-2',
            name: 'Tyresta Medel',
            location: 'Tyresta, Stockholm',
            startTime: new Date(Date.now() + 30 * 60 * 1000),
            status: 'upcoming',
            runnersActive: 0,
            runnersFinished: 0,
            runnersTotal: 95,
            isRegistered: true,
            isCheckedIn: false,
            userStartTime: new Date(Date.now() + 45 * 60 * 1000),
            userClassName: 'H21',
        },
        {
            id: 'live-3',
            name: 'Nackareservatet',
            location: 'Nacka, Stockholm',
            startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            status: 'upcoming',
            runnersActive: 0,
            runnersFinished: 0,
            runnersTotal: 67,
        },
    ];
}
