'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { db } from '@/lib/db';
import { getEvent, subscribeToEvents } from '@/lib/firestore/events';
import { subscribeToEntries } from '@/lib/firestore/entries';
import { subscribeToResults } from '@/lib/firestore/results';
import { subscribeToSpeakerMessages } from '@/lib/firestore/speaker';
import { listTracks } from '@/lib/firestore/tracks';
import { getCompetitionStatus } from '@/lib/events/competition';
import type { DBTrack } from '@/types/database';
import type { Entry, EntryWithResult } from '@/types/entry';

interface TrackPoint {
    lat: number;
    lng: number;
    timestamp: number;
}

interface RunnerTrack {
    id: string;
    name: string;
    club: string;
    className: string;
    status: 'running' | 'finished' | 'dnf';
    color: string;
    points: TrackPoint[];
}

interface RunnerMarkerData {
    id: string;
    name: string;
    club: string;
    className: string;
    status: 'running' | 'finished' | 'dnf';
    color: string;
    position: { lat: number; lng: number };
}

interface ResultEntry {
    id: string;
    name: string;
    club: string;
    className: string;
    time: string;
    position?: number;
    status?: string;
    timestamp: Date;
}

interface SpeakerComment {
    id: string;
    text: string;
    timestamp: Date;
    highlight?: boolean;
}

const RUNNER_COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308'];

function normalizeTrackPoints(points: any[] | undefined): TrackPoint[] {
    if (!Array.isArray(points)) return [];
    return points
        .map((point: any) => {
            const rawTimestamp = point.timestamp;
            const date = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp);
            const timestamp = date.getTime();
            if (Number.isNaN(timestamp)) return null;
            return {
                lat: Number(point.lat),
                lng: Number(point.lng),
                timestamp,
            };
        })
        .filter((point): point is TrackPoint => !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng))
        .sort((a, b) => a.timestamp - b.timestamp);
}

function getPointAtElapsed(points: TrackPoint[], elapsedSeconds: number): TrackPoint | null {
    if (!points.length) return null;
    const start = points[0].timestamp;
    const target = start + elapsedSeconds * 1000;
    const found = points.find(point => point.timestamp >= target);
    return found || points[points.length - 1];
}

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
    const whole = Math.round(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const secs = whole % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatResultTime(value?: number): string {
    if (!value || value <= 0) return '--:--';
    const seconds = value > 100000 ? Math.round(value / 1000) : Math.round(value);
    return formatDuration(seconds);
}

export default function SpectateEventPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

    const [eventName, setEventName] = useState('Laddar...');
    const [organizer, setOrganizer] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventStatus, setEventStatus] = useState<'draft' | 'upcoming' | 'live' | 'completed'>('draft');

    const [entries, setEntries] = useState<Entry[]>([]);
    const [results, setResults] = useState<EntryWithResult[]>([]);
    const [speakerComments, setSpeakerComments] = useState<SpeakerComment[]>([]);
    const [tracks, setTracks] = useState<DBTrack[]>([]);

    const [selectedRunner, setSelectedRunner] = useState<string | null>(null);
    const [following, setFollowing] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState<'runners' | 'results' | 'speaker'>('runners');
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [completedView, setCompletedView] = useState<'results' | 'replay'>('results');
    const [playbackTime, setPlaybackTime] = useState(0);
    const [maxPlaybackTime, setMaxPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const shouldShowMap = eventStatus !== 'completed' || completedView === 'replay';

    const runnerTracks = useMemo<RunnerTrack[]>(() => {
        const mapped = tracks
            .map((track, index) => {
                const points = normalizeTrackPoints(track.points as any[]);
                if (points.length < 2) return null;

                const matchedEntry =
                    entries.find((entry: any) => entry.userId && entry.userId === (track as any).userId) ||
                    entries.find(entry => entry.id === track.localId) ||
                    entries.find(entry => `${entry.firstName} ${entry.lastName}`.trim().toLowerCase() === (track.name || '').toLowerCase());

                const name = matchedEntry
                    ? `${matchedEntry.firstName || ''} ${matchedEntry.lastName || ''}`.trim()
                    : (track.name || `Löpare ${index + 1}`);
                const className = matchedEntry?.className || '';
                const club = matchedEntry?.clubName || '';
                const status = matchedEntry?.status === 'finished'
                    ? 'finished'
                    : matchedEntry?.status === 'dnf'
                        ? 'dnf'
                        : 'running';

                return {
                    id: track.localId || `track-${index}`,
                    name,
                    className,
                    club,
                    status,
                    color: RUNNER_COLORS[index % RUNNER_COLORS.length],
                    points,
                };
            })
            .filter((runner): runner is RunnerTrack => !!runner);

        return mapped;
    }, [tracks, entries]);

    useEffect(() => {
        const classes = new Set<string>();
        entries.forEach(entry => {
            if (entry.className) classes.add(entry.className);
        });
        runnerTracks.forEach(runner => {
            if (runner.className) classes.add(runner.className);
        });
        setAvailableClasses(Array.from(classes).sort((a, b) => a.localeCompare(b, 'sv-SE')));
    }, [entries, runnerTracks]);

    useEffect(() => {
        const longestTrack = runnerTracks.reduce((maxSeconds, track) => {
            const duration = Math.max(0, Math.floor((track.points[track.points.length - 1].timestamp - track.points[0].timestamp) / 1000));
            return Math.max(maxSeconds, duration);
        }, 0);

        setMaxPlaybackTime(longestTrack);
        setPlaybackTime(previous => Math.min(previous, longestTrack));
    }, [runnerTracks]);

    const runnerMarkers = useMemo<RunnerMarkerData[]>(() => {
        const byClass = runnerTracks.filter(runner =>
            selectedClasses.length === 0 || (runner.className && selectedClasses.includes(runner.className))
        );

        return byClass
            .map((runner) => {
                const point = shouldShowMap && eventStatus === 'completed'
                    ? getPointAtElapsed(runner.points, playbackTime)
                    : runner.points[runner.points.length - 1];

                if (!point) return null;

                return {
                    id: runner.id,
                    name: runner.name,
                    club: runner.club,
                    className: runner.className,
                    status: runner.status,
                    color: runner.color,
                    position: {
                        lat: point.lat,
                        lng: point.lng,
                    },
                };
            })
            .filter((runner): runner is RunnerMarkerData => !!runner);
    }, [runnerTracks, selectedClasses, shouldShowMap, eventStatus, playbackTime]);

    const formattedResults = useMemo<ResultEntry[]>(() => {
        if (results.length > 0) {
            return results.map((result, index) => ({
                id: result.id,
                name: `${result.firstName || ''} ${result.lastName || ''}`.trim() || 'Anonym löpare',
                club: result.clubName || '',
                className: result.className || '',
                time: formatResultTime(result.runningTime || (result as any).time),
                position: result.position || index + 1,
                status: result.resultStatus || result.status,
                timestamp: new Date(result.updatedAt || Date.now()),
            }));
        }

        return entries
            .filter(entry => entry.status === 'finished' || !!entry.resultStatus)
            .map((entry, index) => ({
                id: entry.id,
                name: `${entry.firstName || ''} ${entry.lastName || ''}`.trim() || 'Anonym löpare',
                club: entry.clubName || '',
                className: entry.className || '',
                time: formatResultTime((entry as any).runningTime || (entry as any).time),
                position: (entry as any).position || index + 1,
                status: entry.resultStatus || entry.status,
                timestamp: new Date(entry.updatedAt || Date.now()),
            }));
    }, [results, entries]);

    const filteredResults = useMemo(
        () => formattedResults.filter(result => selectedClasses.length === 0 || selectedClasses.includes(result.className)),
        [formattedResults, selectedClasses]
    );

    useEffect(() => {
        if (!shouldShowMap) {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current.clear();
            return;
        }

        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [18.0686, 59.3293],
            zoom: 14,
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current.clear();
        };
    }, [shouldShowMap]);

    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const activeRunnerIds = new Set(runnerMarkers.map(runner => runner.id));

        markersRef.current.forEach((marker, runnerId) => {
            if (!activeRunnerIds.has(runnerId)) {
                marker.remove();
                markersRef.current.delete(runnerId);
            }
        });

        runnerMarkers.forEach(runner => {
            const existing = markersRef.current.get(runner.id);

            if (existing) {
                existing.setLngLat([runner.position.lng, runner.position.lat]);
                const el = existing.getElement();
                el.style.transform = selectedRunner === runner.id ? 'scale(1.2)' : 'scale(1)';
                return;
            }

            const el = document.createElement('div');
            el.className = 'runner-marker';
            el.style.cssText = `
                width: 24px;
                height: 24px;
                border-radius: 9999px;
                background: ${runner.color};
                border: 2px solid #fff;
                box-shadow: 0 2px 10px rgba(0,0,0,0.45);
                cursor: pointer;
                transition: transform 160ms ease;
            `;
            el.title = runner.name;
            el.addEventListener('click', () => {
                setSelectedRunner(runner.id);
                setFollowing(current => (current === runner.id ? null : runner.id));
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([runner.position.lng, runner.position.lat])
                .addTo(map);
            markersRef.current.set(runner.id, marker);
        });

        if (following) {
            const followed = runnerMarkers.find(runner => runner.id === following);
            if (followed) {
                map.easeTo({
                    center: [followed.position.lng, followed.position.lat],
                    duration: 450,
                });
            }
        }
    }, [runnerMarkers, selectedRunner, following]);

    useEffect(() => {
        if (!(eventStatus === 'completed' && completedView === 'replay' && isPlaying)) return;

        const interval = setInterval(() => {
            setPlaybackTime(previous => {
                if (previous >= maxPlaybackTime) {
                    setIsPlaying(false);
                    return maxPlaybackTime;
                }
                return Math.min(previous + 1, maxPlaybackTime);
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [eventStatus, completedView, isPlaying, maxPlaybackTime]);

    useEffect(() => {
        let unsubscribeEvents = () => { };
        let unsubscribeEntries = () => { };
        let unsubscribeResults = () => { };
        let unsubscribeSpeaker = () => { };
        let isMounted = true;

        const refreshTracks = async () => {
            try {
                const localTracks = await db.tracks.where('eventId').equals(eventId).toArray();
                const cloudTracks = await listTracks({ eventId }).catch(() => []);
                const mergedMap = new Map<string, DBTrack>();

                [...localTracks, ...cloudTracks].forEach((track, index) => {
                    const id = track.localId || (track as any).id || `track-${index}`;
                    mergedMap.set(id, { ...track, localId: id });
                });

                if (isMounted) {
                    setTracks(Array.from(mergedMap.values()));
                }
            } catch (error) {
                console.error('Kunde inte hämta spår för spectator-läge:', error);
            }
        };

        const applyEventData = (event: any) => {
            if (!event || !isMounted) return;
            setEventName(event.name || 'Namnlös tävling');
            setOrganizer(event.organizer || event.location || 'Arrangör');
            setEventDate(event.date || '');
            setEventStatus(getCompetitionStatus(event));
        };

        const init = async () => {
            const initialEvent = await getEvent(eventId);
            if (initialEvent) {
                applyEventData(initialEvent);
            }

            unsubscribeEvents = subscribeToEvents((events) => {
                const currentEvent = events.find(event => event.id === eventId);
                if (currentEvent) {
                    applyEventData(currentEvent);
                }
            });

            unsubscribeEntries = subscribeToEntries(eventId, setEntries);
            unsubscribeResults = subscribeToResults(eventId, setResults);
            unsubscribeSpeaker = subscribeToSpeakerMessages(eventId, (messages) => {
                if (!isMounted) return;
                setSpeakerComments(
                    messages.map(message => ({
                        id: message.id,
                        text: message.message,
                        timestamp: message.timestamp,
                        highlight: message.type === 'highlight',
                    }))
                );
            });

            await refreshTracks();
        };

        init().catch((error) => console.error('Kunde inte initiera spectator-vyn:', error));
        const interval = setInterval(refreshTracks, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
            unsubscribeEvents();
            unsubscribeEntries();
            unsubscribeResults();
            unsubscribeSpeaker();
        };
    }, [eventId]);

    const toggleClass = (className: string) => {
        setSelectedClasses(current =>
            current.includes(className) ? current.filter(item => item !== className) : [...current, className]
        );
    };

    const formatClock = (date: Date) => {
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title={eventName}
                subtitle={organizer}
                backHref="/spectate"
                showLogo
                rightAction={
                    <div className="flex items-center gap-2">
                        {eventStatus === 'completed' ? (
                            <div className="flex items-center gap-2 bg-emerald-900/30 px-3 py-1 rounded border border-emerald-800/50">
                                <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">🏆 Avslutat</span>
                            </div>
                        ) : eventStatus === 'live' ? (
                            <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1 rounded border border-red-800/50">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Live</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-blue-900/30 px-3 py-1 rounded border border-blue-800/50">
                                <span className="text-blue-300 text-[10px] font-black uppercase tracking-widest">Kommande</span>
                            </div>
                        )}
                    </div>
                }
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800 overflow-x-auto">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Filter:</span>
                {availableClasses.length === 0 && (
                    <span className="text-xs text-slate-600 uppercase tracking-wider">Inga klasser ännu</span>
                )}
                {availableClasses.map(className => (
                    <button
                        key={className}
                        onClick={() => toggleClass(className)}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${selectedClasses.length === 0 || selectedClasses.includes(className)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-500'
                            }`}
                    >
                        {className}
                    </button>
                ))}
            </div>

            {eventStatus === 'completed' && runnerTracks.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
                    <button
                        onClick={() => setCompletedView('results')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${completedView === 'results' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                    >
                        Resultat
                    </button>
                    <button
                        onClick={() => setCompletedView('replay')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${completedView === 'replay' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                    >
                        Efterhand (Replay)
                    </button>
                </div>
            )}

            <div className="flex-1 flex relative overflow-hidden">
                {shouldShowMap ? (
                    <div className="flex-1 relative">
                        <div ref={mapContainer} className="absolute inset-0" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-800/50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase w-12">Plac</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Namn</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Klubb</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Klass</th>
                                            <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Tid</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {filteredResults.map((result, index) => (
                                            <tr key={result.id} className={`hover:bg-slate-800/50 ${index === 0 ? 'bg-emerald-900/10' : ''}`}>
                                                <td className="px-3 py-2 font-bold text-slate-200">{result.position || index + 1}</td>
                                                <td className="px-3 py-2 font-bold text-white">{result.name}</td>
                                                <td className="px-3 py-2 text-slate-400 text-sm">{result.club}</td>
                                                <td className="px-3 py-2 text-slate-400 text-sm">{result.className}</td>
                                                <td className="px-3 py-2 text-right font-mono text-white">{result.time}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredResults.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-2 opacity-50">🏆</div>
                                    <p>Inga resultat tillgängliga</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="w-80 bg-slate-900/95 border-l border-slate-800 flex flex-col">
                    <div className="flex border-b border-slate-800">
                        {[
                            { id: 'runners', label: 'Löpare', icon: '🏃' },
                            { id: 'results', label: 'Resultat', icon: '🏆' },
                            { id: 'speaker', label: 'Speaker', icon: '🎙️' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setShowPanel(tab.id as 'runners' | 'results' | 'speaker')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${showPanel === tab.id
                                    ? 'text-emerald-400 border-b-2 border-emerald-500'
                                    : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {showPanel === 'runners' && (
                            <div className="p-3 space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                    {runnerMarkers.filter(runner => runner.status === 'running').length} aktiva
                                </div>
                                {runnerMarkers.map(runner => (
                                    <button
                                        key={runner.id}
                                        onClick={() => {
                                            setSelectedRunner(runner.id);
                                            setFollowing(current => (current === runner.id ? null : runner.id));
                                        }}
                                        className={`w-full p-3 rounded-lg border-l-4 text-left transition-all ${selectedRunner === runner.id
                                            ? 'bg-slate-800'
                                            : 'bg-slate-800/50 hover:bg-slate-800'
                                            }`}
                                        style={{ borderColor: runner.color }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-white">{runner.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    {runner.club}{runner.className ? ` • ${runner.className}` : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {following === runner.id && (
                                                    <span className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-full">FÖLJER</span>
                                                )}
                                                {runner.status === 'running' && (
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {runnerMarkers.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 text-sm">
                                        Inga spår tillgängliga ännu.
                                    </div>
                                )}
                            </div>
                        )}

                        {showPanel === 'results' && (
                            <div className="p-3 space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                    Resultatflöde
                                </div>
                                {filteredResults.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="text-3xl mb-2 opacity-50">🏁</div>
                                        <p className="text-xs">Inga resultat än</p>
                                    </div>
                                ) : (
                                    filteredResults.slice(0, 50).map(result => (
                                        <div key={result.id} className="p-3 rounded-lg bg-slate-800/50 border-l-4 border-emerald-500">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-white">{result.name}</div>
                                                    <div className="text-xs text-slate-400">{result.club}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono text-emerald-400 font-bold">{result.time}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {result.className}{result.position ? ` #${result.position}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-600 mt-1">{formatClock(result.timestamp)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {showPanel === 'speaker' && (
                            <div className="p-3 space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                    Speakerkommentarer
                                </div>
                                {speakerComments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="text-3xl mb-2 opacity-50">🎙️</div>
                                        <p className="text-xs">Inga kommentarer än</p>
                                    </div>
                                ) : (
                                    speakerComments.map(comment => (
                                        <div
                                            key={comment.id}
                                            className={`p-3 rounded-lg ${comment.highlight
                                                ? 'bg-purple-900/30 border border-purple-700/50'
                                                : 'bg-slate-800/50'
                                                }`}
                                        >
                                            <p className={`text-sm ${comment.highlight ? 'text-purple-200' : 'text-slate-300'}`}>
                                                {comment.text}
                                            </p>
                                            <div className="text-[10px] text-slate-600 mt-1">{formatClock(comment.timestamp)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {eventStatus === 'completed' && completedView === 'replay' && shouldShowMap && (
                <div className="absolute bottom-4 left-4 right-[340px] bg-slate-900/90 backdrop-blur-md rounded-xl p-3 border border-slate-800 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsPlaying(current => !current)}
                            className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold hover:bg-emerald-500 transition-colors"
                        >
                            {isPlaying ? '❚❚' : '▶'}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={maxPlaybackTime}
                            step={1}
                            value={playbackTime}
                            onChange={(event) => setPlaybackTime(Number(event.target.value))}
                            className="flex-1 accent-emerald-500"
                        />
                        <div className="text-xs font-mono text-slate-300 min-w-[68px] text-right">
                            {formatDuration(playbackTime)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

