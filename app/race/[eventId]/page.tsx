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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="text-6xl mb-6 opacity-20">❓</div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Tävling hittades inte</h1>
                    <Link href="/events" className="text-emerald-400 font-bold uppercase tracking-widest text-xs hover:underline">
                        Tillbaka till tävlingar
                    </Link>
                </div>
            </div>
        );
    }

    if (!participant) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center p-8">
                    <div className="text-6xl mb-6 opacity-20">🏃</div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Du är inte anmäld</h1>
                    <p className="text-slate-500 font-medium mb-8">
                        Du måste vara anmäld för att använda deltagarläget
                    </p>
                    <Link href={`/events/${eventId}`} className="inline-block px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all">
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
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
                <div className="max-w-lg mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="font-black uppercase tracking-tight text-lg leading-tight">{event.name}</h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{participant.className}</p>
                    </div>
                    <div className="text-right">
                        <div className="font-mono font-black text-white">
                            {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
                {/* My Start Time */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Din starttid</p>
                    <div className="text-6xl font-mono font-black text-white mb-6 tracking-tighter">
                        {startTime
                            ? startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '--:--:--'
                        }
                    </div>

                    {timeToStart && timeToStart > 0 && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Startar om</span>
                            <div className="font-mono font-black text-emerald-400">
                                <CountdownDisplay milliseconds={timeToStart} />
                            </div>
                        </div>
                    )}

                    {timeToStart && timeToStart <= 0 && !participant.actualStartTime && (
                        <div className="text-amber-500 font-black uppercase tracking-widest text-xs animate-pulse">
                            Din starttid har passerat!
                        </div>
                    )}
                </div>

                {/* Check-in Button */}
                {settings.requireCheckin && !participant.isCheckedIn && (
                    <button
                        onClick={handleCheckIn}
                        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-emerald-900/40"
                    >
                        ✓ Bekräfta start
                    </button>
                )}

                {participant.isCheckedIn && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                        <span className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">✓ Du är incheckad</span>
                    </div>
                )}

                {/* Manual Start Button */}
                {settings.allowManualStart && timeToStart && timeToStart <= settings.manualStartWindowMinutes * 60 * 1000 && (
                    <button
                        onClick={handleManualStart}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-blue-900/40"
                    >
                        🏃 Starta nu
                    </button>
                )}

                {/* Start Location */}
                {settings.showStartLocation && event.startLocation && (
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 whitespace-pre-wrap">📍 Startplats</h3>
                        <p className="font-bold text-white text-lg">{event.startLocation.name}</p>
                        {event.startLocation.description && (
                            <p className="text-sm text-slate-400 mt-1">{event.startLocation.description}</p>
                        )}
                    </div>
                )}

                {/* Club Mates */}
                {settings.showClubMates && clubMates.length > 0 && (
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 whitespace-pre-wrap">👥 Dina klubbkompisar</h3>
                        <div className="space-y-1">
                            {clubMates.map((mate: Entry) => (
                                <div key={mate.id} className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0 group">
                                    <div>
                                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">{mate.firstName}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{mate.className}</div>
                                    </div>
                                    <div className="font-mono font-black text-slate-300">
                                        {mate.startTime
                                            ? new Date(mate.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                                            : '-'
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Info */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 text-center">
                    <div className="text-white font-black uppercase tracking-tight text-lg">{participant.firstName} {participant.lastName}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{participant.clubName}</div>
                    {participant.siCard && <div className="font-mono font-black text-emerald-500/50 mt-4 text-xs">SI-NUMMER: {participant.siCard}</div>}
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
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Timer */}
            <div className="text-center mb-16 relative z-10">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-6 animate-pulse">Running</div>
                <div className="text-8xl md:text-9xl font-mono font-black text-white tracking-tighter sm:tabular-nums">
                    {formatElapsedTime(elapsed)}
                </div>
            </div>

            {/* Minimal Info */}
            <div className="text-center space-y-2 relative z-10">
                <p className="text-3xl font-black uppercase tracking-tight text-white">
                    {participant.firstName} {participant.lastName}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{participant.clubName}</p>

                <div className="flex gap-8 justify-center mt-12">
                    {participant.siCard && (
                        <div className="text-center">
                            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1">SI-Card</span>
                            <span className="font-mono font-bold text-slate-400">{participant.siCard}</span>
                        </div>
                    )}
                    {participant.bibNumber && (
                        <div className="text-center">
                            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1">Bib</span>
                            <span className="font-mono font-bold text-slate-400">{participant.bibNumber}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Footer */}
            <div className="absolute bottom-12 inset-x-0 text-center px-8 relative z-10">
                <div className="max-w-xs mx-auto py-3 bg-slate-900/50 border border-slate-800 rounded-full">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Tracking Active</p>
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-700 leading-relaxed max-w-[200px] mx-auto">Karta och resultat är dolda för din klass under pågående tävling</p>
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
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
                <div className="max-w-lg mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="font-black uppercase tracking-tight text-lg leading-tight">{event.name}</h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Mål / Finished</p>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
                {/* Result Card */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-10 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"></div>
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                        <span className="text-3xl">🏁</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Officiell Tid</p>
                    <div className="text-6xl font-mono font-black text-white mb-6 tracking-tighter">
                        {runningTime ? formatElapsedTime(runningTime) : '--:--:--'}
                    </div>
                    <div className={`inline-flex items-center px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${participant.resultStatus === 'ok'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : participant.resultStatus === 'mp'
                            ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                        {participant.resultStatus?.toUpperCase() || 'OK'}
                    </div>
                </div>

                {/* GPS Upload */}
                {settings.allowGpsUpload && (
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 whitespace-nowrap">📍 Dela ditt spår</h3>
                        <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-blue-900/40">
                            Ladda upp GPX
                        </button>
                        <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-tight">
                            Synka automatiskt mer ladda upp fil
                        </p>
                    </div>
                )}

                {/* Map Link / Status */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">🗺️ Kartvisning</h3>
                        {!settings.isMapReleased && (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded border border-slate-700">Låst</span>
                        )}
                    </div>

                    {settings.isMapReleased ? (
                        <div className="aspect-video bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center group cursor-pointer overflow-hidden relative">
                            <div className="absolute inset-0 bg-emerald-500/5 group-hover:opacity-0 transition-opacity"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-400 transition-colors">Se karta & vägval</span>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4 opacity-10">🔒</div>
                            <p className="text-white font-bold text-sm mb-1 uppercase tracking-tight">Kartan är inte släppt</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Väntar på att alla deltagare startat</p>
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <div className="grid grid-cols-2 gap-4">
                    <Link
                        href={`/events/${event.id}/results`}
                        className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-center font-black uppercase tracking-widest text-[10px] transition-all"
                    >
                        Resultat
                    </Link>
                    <Link
                        href={`/events/${event.id}`}
                        className="py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-center font-black uppercase tracking-widest text-[10px] transition-all"
                    >
                        Eventinfo
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
            <span>
                {hours}h {minutes}m
            </span>
        );
    }
    return (
        <span>
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
