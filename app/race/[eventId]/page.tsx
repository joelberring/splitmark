'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RaceParticipant, EventParticipantSettings, DEFAULT_PARTICIPANT_SETTINGS } from '@/types/race';
import type { Entry } from '@/types/entry';

/**
 * Race Day Router
 * 
 * Routes participant to correct view based on their status:
 * - Before start: Show start info, countdown, club mates
 * - Running: Minimal view (timer only)
 * - Finished: Results, GPS upload, map (if released)
 */
export default function RacePage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.eventId as string;

    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<any>(null);
    const [participant, setParticipant] = useState<RaceParticipant | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadData();
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [eventId]);

    const loadData = () => {
        // Get current user (from dev-login or auth)
        const devUser = localStorage.getItem('dev-auth-user');
        const userId = devUser ? JSON.parse(devUser).uid : null;

        // Load event
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const foundEvent = events.find((e: any) => e.id === eventId);
            if (foundEvent) {
                setEvent(foundEvent);

                // Find participant entry (by userId or first entry for demo)
                const entries: Entry[] = foundEvent.entries || [];
                const entry = userId
                    ? entries.find(e => (e as any).userId === userId)
                    : entries[0]; // Demo: use first entry

                if (entry) {
                    setParticipant({
                        eventId,
                        entryId: entry.id,
                        userId,
                        firstName: entry.firstName,
                        lastName: entry.lastName,
                        clubName: entry.clubName,
                        className: entry.className,
                        siCard: entry.siCard,
                        bibNumber: undefined,
                        isCheckedIn: (entry as any).isCheckedIn || false,
                        checkedInAt: (entry as any).checkedInAt,
                        plannedStartTime: entry.startTime,
                        actualStartTime: (entry as any).actualStartTime,
                        finishTime: entry.finishTime,
                        status: determineStatus(entry),
                        resultStatus: (entry.resultStatus === 'dns' || entry.resultStatus === 'ot') ? undefined : entry.resultStatus,
                    });
                }
            }
        }
        setLoading(false);
    };

    const determineStatus = (entry: Entry): RaceParticipant['status'] => {
        if (entry.finishTime) return 'finished';
        if ((entry as any).actualStartTime || entry.status === 'started') return 'started';
        if ((entry as any).isCheckedIn) return 'checked_in';
        if (entry.status === 'dns') return 'dns';
        if (entry.status === 'dnf') return 'dnf';
        return 'registered';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-400"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="text-6xl mb-4">❓</div>
                    <h1 className="text-2xl font-bold mb-2">Tävling hittades inte</h1>
                    <Link href="/events" className="text-emerald-400 hover:underline">
                        Tillbaka till tävlingar
                    </Link>
                </div>
            </div>
        );
    }

    if (!participant) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="text-6xl mb-4">🏃</div>
                    <h1 className="text-2xl font-bold mb-2">Du är inte anmäld</h1>
                    <p className="text-gray-400 mb-4">
                        Du måste vara anmäld för att använda deltagarläget
                    </p>
                    <Link href={`/events/${eventId}`} className="text-emerald-400 hover:underline">
                        Tillbaka till tävlingen
                    </Link>
                </div>
            </div>
        );
    }

    // Route based on status
    switch (participant.status) {
        case 'started':
            return <RunningView participant={participant} currentTime={currentTime} event={event} />;
        case 'finished':
            return <FinishedView participant={participant} event={event} />;
        default:
            return <BeforeStartView participant={participant} currentTime={currentTime} event={event} onRefresh={loadData} />;
    }
}

// ============ BEFORE START VIEW ============
function BeforeStartView({
    participant,
    currentTime,
    event,
    onRefresh,
}: {
    participant: RaceParticipant;
    currentTime: Date;
    event: any;
    onRefresh: () => void;
}) {
    const settings: EventParticipantSettings = event.participantSettings || {
        requireCheckin: false,
        allowManualStart: false,
        showClubMates: true,
        showStartLocation: true,
    };

    const startTime = participant.plannedStartTime
        ? new Date(participant.plannedStartTime)
        : null;

    const timeToStart = startTime
        ? startTime.getTime() - currentTime.getTime()
        : null;

    const handleCheckIn = () => {
        // Update entry with check-in
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const eventIndex = events.findIndex((e: any) => e.id === event.id);
            if (eventIndex >= 0) {
                const entries = events[eventIndex].entries || [];
                const entryIndex = entries.findIndex((e: any) => e.id === participant.entryId);
                if (entryIndex >= 0) {
                    entries[entryIndex].isCheckedIn = true;
                    entries[entryIndex].checkedInAt = new Date().toISOString();
                    events[eventIndex].entries = entries;
                    localStorage.setItem('events', JSON.stringify(events));
                    onRefresh();
                }
            }
        }
    };

    const handleManualStart = () => {
        if (!settings.allowManualStart) return;

        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const eventIndex = events.findIndex((e: any) => e.id === event.id);
            if (eventIndex >= 0) {
                const entries = events[eventIndex].entries || [];
                const entryIndex = entries.findIndex((e: any) => e.id === participant.entryId);
                if (entryIndex >= 0) {
                    entries[entryIndex].actualStartTime = new Date().toISOString();
                    entries[entryIndex].status = 'started';
                    events[eventIndex].entries = entries;
                    localStorage.setItem('events', JSON.stringify(events));
                    onRefresh();
                }
            }
        }
    };

    // Get club mates
    const clubMates = (event.entries || [])
        .filter((e: Entry) =>
            e.clubName === participant.clubName &&
            e.id !== participant.entryId
        )
        .slice(0, 10);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            {/* Header */}
            <header className="bg-black/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="font-bold text-lg">{event.name}</h1>
                        <p className="text-sm text-gray-400">{participant.className}</p>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                        {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
                {/* My Start Time */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <p className="text-sm text-gray-400 mb-2">Din starttid</p>
                    <div className="text-5xl font-mono font-bold text-emerald-400 mb-4">
                        {startTime
                            ? startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '--:--:--'
                        }
                    </div>

                    {timeToStart && timeToStart > 0 && (
                        <div className="text-xl">
                            <span className="text-gray-400">Startar om </span>
                            <CountdownDisplay milliseconds={timeToStart} />
                        </div>
                    )}

                    {timeToStart && timeToStart <= 0 && !participant.actualStartTime && (
                        <div className="text-yellow-400 animate-pulse">
                            Din starttid har passerat!
                        </div>
                    )}
                </div>

                {/* Check-in Button */}
                {settings.requireCheckin && !participant.isCheckedIn && (
                    <button
                        onClick={handleCheckIn}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-lg transition-colors"
                    >
                        ✓ Jag kommer starta
                    </button>
                )}

                {participant.isCheckedIn && (
                    <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 text-center">
                        <span className="text-emerald-400">✓ Du är incheckat</span>
                    </div>
                )}

                {/* Manual Start Button */}
                {settings.allowManualStart && timeToStart && timeToStart <= settings.manualStartWindowMinutes * 60 * 1000 && (
                    <button
                        onClick={handleManualStart}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold text-lg transition-colors"
                    >
                        🏃 Starta nu
                    </button>
                )}

                {/* Start Location */}
                {settings.showStartLocation && event.startLocation && (
                    <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-sm text-gray-400 mb-2">📍 Startplats</h3>
                        <p className="font-semibold">{event.startLocation.name}</p>
                        {event.startLocation.description && (
                            <p className="text-sm text-gray-400">{event.startLocation.description}</p>
                        )}
                    </div>
                )}

                {/* Club Mates */}
                {settings.showClubMates && clubMates.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-sm text-gray-400 mb-3">👥 Dina klubbkompisar</h3>
                        <div className="space-y-2">
                            {clubMates.map((mate: Entry) => (
                                <div key={mate.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                                    <div>
                                        <span className="font-semibold">{mate.firstName}</span>
                                        <span className="text-gray-400 text-sm ml-2">{mate.className}</span>
                                    </div>
                                    <span className="font-mono text-sm">
                                        {mate.startTime
                                            ? new Date(mate.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                                            : '-'
                                        }
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Info */}
                <div className="bg-white/5 rounded-xl p-4 text-center text-sm text-gray-400">
                    <p>{participant.firstName} {participant.lastName}</p>
                    <p>{participant.clubName}</p>
                    {participant.siCard && <p className="font-mono">SI: {participant.siCard}</p>}
                </div>
            </main>
        </div>
    );
}

// ============ RUNNING VIEW ============
function RunningView({
    participant,
    currentTime,
    event,
}: {
    participant: RaceParticipant;
    currentTime: Date;
    event: any;
}) {
    const startTime = participant.actualStartTime
        ? new Date(participant.actualStartTime)
        : participant.plannedStartTime
            ? new Date(participant.plannedStartTime)
            : null;

    const elapsed = startTime
        ? currentTime.getTime() - startTime.getTime()
        : 0;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
            {/* Timer */}
            <div className="text-center mb-12">
                <div className="text-7xl font-mono font-bold text-emerald-400 mb-4">
                    {formatElapsedTime(elapsed)}
                </div>
            </div>

            {/* Minimal Info */}
            <div className="text-center space-y-2 text-gray-400">
                <p className="text-2xl font-bold text-white">
                    {participant.firstName} {participant.lastName}
                </p>
                <p>{participant.clubName}</p>
                <div className="flex gap-6 justify-center mt-4 text-sm">
                    {participant.siCard && (
                        <div>
                            <span className="text-gray-500">SI:</span> {participant.siCard}
                        </div>
                    )}
                    {participant.bibNumber && (
                        <div>
                            <span className="text-gray-500">Nr:</span> {participant.bibNumber}
                        </div>
                    )}
                </div>
            </div>

            {/* No map warning */}
            <div className="mt-12 text-center text-gray-600 text-sm">
                <p>Karta och live-spår är blockerade under tävling</p>
            </div>
        </div>
    );
}

// ============ FINISHED VIEW ============
function FinishedView({
    participant,
    event,
}: {
    participant: RaceParticipant;
    event: any;
}) {
    const settings: EventParticipantSettings = event.participantSettings || {
        isMapReleased: false,
        allowGpsUpload: true,
    };

    const runningTime = participant.finishTime && (participant.actualStartTime || participant.plannedStartTime)
        ? new Date(participant.finishTime).getTime() - new Date(participant.actualStartTime || participant.plannedStartTime!).getTime()
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            {/* Header */}
            <header className="bg-black/30 backdrop-blur-sm">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <h1 className="font-bold text-lg">{event.name}</h1>
                    <p className="text-sm text-gray-400">{participant.className}</p>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
                {/* Result */}
                <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-6 text-center">
                    <p className="text-sm text-emerald-400 mb-2">✓ I mål!</p>
                    <div className="text-5xl font-mono font-bold text-white mb-2">
                        {runningTime ? formatElapsedTime(runningTime) : '--:--:--'}
                    </div>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${participant.resultStatus === 'ok'
                        ? 'bg-emerald-500 text-white'
                        : participant.resultStatus === 'mp'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}>
                        {participant.resultStatus?.toUpperCase() || 'OK'}
                    </div>
                </div>

                {/* GPS Upload */}
                {settings.allowGpsUpload && (
                    <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-sm text-gray-400 mb-3">📍 GPS-spår</h3>
                        <button className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors">
                            Ladda upp GPS-spår
                        </button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Stöder GPX-filer från klockor och appar
                        </p>
                    </div>
                )}

                {/* Map */}
                <div className="bg-white/5 rounded-xl p-4">
                    <h3 className="text-sm text-gray-400 mb-3">🗺️ Karta</h3>
                    {settings.isMapReleased ? (
                        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                            <span className="text-gray-500">Karta visas här</span>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-500">
                            <div className="text-4xl mb-2">🔒</div>
                            <p>Kartan är ännu inte släppt</p>
                            <p className="text-sm">Väntar på att alla startat...</p>
                        </div>
                    )}
                </div>

                {/* Links */}
                <div className="space-y-3">
                    <Link
                        href={`/events/${event.id}/results`}
                        className="block w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-center font-semibold transition-colors"
                    >
                        Se alla resultat
                    </Link>
                    <Link
                        href={`/events/${event.id}`}
                        className="block w-full py-3 text-gray-400 text-center hover:text-white transition-colors"
                    >
                        Tillbaka till tävlingen
                    </Link>
                </div>
            </main>
        </div>
    );
}

// ============ HELPERS ============
function CountdownDisplay({ milliseconds }: { milliseconds: number }) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return (
            <span className="font-mono font-bold text-white">
                {hours}h {minutes}m
            </span>
        );
    }
    return (
        <span className="font-mono font-bold text-white">
            {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
    );
}

function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
