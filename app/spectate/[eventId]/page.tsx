'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Runner {
    id: string;
    name: string;
    club: string;
    className: string;
    position: { lat: number; lng: number };
    lastUpdate: Date;
    status: 'running' | 'finished' | 'dnf';
    color: string;
}

interface ResultEntry {
    id: string;
    name: string;
    club: string;
    className: string;
    time: string;
    position: number;
    timestamp: Date;
}

interface SpeakerComment {
    id: string;
    text: string;
    timestamp: Date;
    highlight?: boolean;
}

export default function SpectateEventPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

    const [runners, setRunners] = useState<Runner[]>([]);
    const [results, setResults] = useState<ResultEntry[]>([]);
    const [comments, setComments] = useState<SpeakerComment[]>([]);
    const [selectedRunner, setSelectedRunner] = useState<string | null>(null);
    const [following, setFollowing] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState<'runners' | 'results' | 'speaker'>('runners');
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [eventName, setEventName] = useState('Laddar...');
    const [organizer, setOrganizer] = useState('');
    const [eventStatus, setEventStatus] = useState<'active' | 'completed' | 'draft'>('active');
    const [eventDate, setEventDate] = useState('');

    // Initialize map
    useEffect(() => {
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
        };
    }, []);

    // Mock data
    // Load event data from Firestore
    useEffect(() => {
        // Load event data from Firestore
        import('@/lib/firestore/events').then(({ getEvent, subscribeToEvents }) => {
            // Initial fetch
            getEvent(eventId).then(event => {
                if (event) {
                    processEventData(event);
                }
            });

            // Subscribe to updates
            const unsubscribe = subscribeToEvents((events) => {
                const event = events.find(e => e.id === eventId);
                if (event) {
                    processEventData(event);
                }
            });

            return () => unsubscribe();
        });

        // Subscribe to speaker messages
        import('@/lib/firestore/speaker').then(({ subscribeToSpeakerMessages }) => {
            const unsubscribe = subscribeToSpeakerMessages(eventId, (messages) => {
                const comments: SpeakerComment[] = messages.map(msg => ({
                    id: msg.id,
                    text: msg.message,
                    timestamp: msg.timestamp,
                    highlight: msg.type === 'highlight'
                }));
                setComments(comments);
            });
            return () => unsubscribe();
        });
    }, [eventId]);

    const processEventData = (event: any) => {
        const colors = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

        setEventName(event.name);
        setOrganizer(event.organizer || event.location || 'Arrangör');
        setEventStatus(event.status || 'active');
        setEventDate(event.date || '');

        if (event.classes) {
            setAvailableClasses(event.classes.map((c: any) => c.name));
        }

        // For completed events with results array, process those
        if (event.status === 'completed' && event.results && event.results.length > 0) {
            const newResults: ResultEntry[] = event.results.map((r: any, idx: number) => ({
                id: r.entryId || `result-${idx}`,
                name: r.name,
                club: r.club || '',
                className: r.className || '',
                time: formatTimeSeconds(r.time),
                position: r.position || idx + 1,
                timestamp: new Date()
            }));
            setResults(newResults);
            setRunners([]); // No live runners for completed events
            return;
        }

        // For active events, process entries
        if (event.entries) {
            const newRunners: Runner[] = event.entries
                .filter((e: any) => e.status === 'started' || e.status === 'registered')
                .map((e: any, idx: number) => ({
                    id: e.id,
                    name: e.name,
                    club: e.club,
                    className: e.className || e.classId || '',
                    position: {
                        lat: 59.3293 + (Math.random() - 0.5) * 0.01,
                        lng: 18.0686 + (Math.random() - 0.5) * 0.01
                    },
                    lastUpdate: new Date(),
                    status: e.status === 'started' ? 'running' : 'dnf',
                    color: colors[idx % colors.length]
                }))
                .filter((r: Runner) => r.status === 'running' || true);

            setRunners(newRunners);

            const newResults: ResultEntry[] = event.entries
                .filter((e: any) => e.status === 'finished')
                .map((e: any, idx: number) => ({
                    id: e.id,
                    name: e.name,
                    club: e.club,
                    className: e.className || e.classId || '',
                    time: e.startTime ? '--:--' : '00:00',
                    position: idx + 1,
                    timestamp: new Date()
                }));
            setResults(newResults);
        }
    };

    const formatTimeSeconds = (seconds: number): string => {
        if (!seconds || seconds === 0) return '--:--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Update runner positions
    useEffect(() => {
        const interval = setInterval(() => {
            setRunners(prev => prev.map(r => ({
                ...r,
                position: {
                    lat: r.position.lat + (Math.random() - 0.5) * 0.0005,
                    lng: r.position.lng + (Math.random() - 0.5) * 0.0005,
                },
                lastUpdate: new Date(),
            })));
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Update markers
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        runners.forEach(runner => {
            const filtered = selectedClasses.length === 0 || selectedClasses.includes(runner.className);

            if (markersRef.current.has(runner.id)) {
                const marker = markersRef.current.get(runner.id)!;
                marker.setLngLat([runner.position.lng, runner.position.lat]);
                marker.getElement().style.display = filtered ? 'block' : 'none';
            } else if (filtered) {
                const el = document.createElement('div');
                el.className = 'runner-marker';
                el.style.cssText = `
                    width: 24px; height: 24px; border-radius: 50%;
                    background: ${runner.color}; border: 3px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    cursor: pointer;
                `;
                el.addEventListener('click', () => setSelectedRunner(runner.id));

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([runner.position.lng, runner.position.lat])
                    .addTo(map);

                markersRef.current.set(runner.id, marker);
            }
        });

        // Follow selected runner
        if (following) {
            const runner = runners.find(r => r.id === following);
            if (runner) {
                map.easeTo({
                    center: [runner.position.lng, runner.position.lat],
                    duration: 500,
                });
            }
        }
    }, [runners, following, selectedClasses]);

    const toggleClass = (cls: string) => {
        setSelectedClasses(prev =>
            prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
        );
    };

    const formatTime = (date: Date) => {
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
                        ) : (
                            <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1 rounded border border-red-800/50">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Live</span>
                            </div>
                        )}
                    </div>
                }
            />

            {/* Class filter */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800 overflow-x-auto">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Filter:</span>
                {availableClasses.map(cls => (
                    <button
                        key={cls}
                        onClick={() => toggleClass(cls)}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${selectedClasses.includes(cls) || selectedClasses.length === 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-500'
                            }`}
                    >
                        {cls}
                    </button>
                ))}
            </div>

            {/* Main content */}
            <div className="flex-1 flex relative overflow-hidden">
                {eventStatus === 'completed' ? (
                    /* Results Table for Completed Events */
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
                                        {results
                                            .filter(r => selectedClasses.length === 0 || selectedClasses.includes(r.className))
                                            .map((r, i) => (
                                                <tr key={r.id} className={`hover:bg-slate-800/50 ${i === 0 ? 'bg-emerald-900/10' : ''}`}>
                                                    <td className="px-3 py-2">
                                                        <span className={`font-bold ${i === 0 ? 'text-emerald-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                            {r.position}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-white">{r.name}</td>
                                                    <td className="px-3 py-2 text-slate-400 text-sm">{r.club}</td>
                                                    <td className="px-3 py-2 text-slate-400 text-sm">{r.className}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-white">{r.time}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                            {results.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-2 opacity-50">🏆</div>
                                    <p>Inga resultat tillgängliga</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Live Map for Active Events */
                    <div className="flex-1 relative">
                        <div ref={mapContainer} className="absolute inset-0" />
                    </div>
                )}

                {/* Side panel */}
                <div className="w-80 bg-slate-900/95 border-l border-slate-800 flex flex-col">
                    {/* Panel tabs */}
                    <div className="flex border-b border-slate-800">
                        {[
                            { id: 'runners', label: 'Löpare', icon: '🏃' },
                            { id: 'results', label: 'Resultat', icon: '🏆' },
                            { id: 'speaker', label: 'Speaker', icon: '🎙️' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setShowPanel(tab.id as any)}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${showPanel === tab.id
                                    ? 'text-emerald-400 border-b-2 border-emerald-500'
                                    : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Panel content */}
                    <div className="flex-1 overflow-y-auto">
                        {showPanel === 'runners' && (
                            <div className="p-3 space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                    {runners.filter(r => r.status === 'running').length} aktiva
                                </div>
                                {runners.map(runner => (
                                    <button
                                        key={runner.id}
                                        onClick={() => {
                                            setSelectedRunner(runner.id);
                                            setFollowing(following === runner.id ? null : runner.id);
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
                                                <div className="text-xs text-slate-400">{runner.club} • {runner.className}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {following === runner.id && (
                                                    <span className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-full">
                                                        FÖLJER
                                                    </span>
                                                )}
                                                {runner.status === 'running' && (
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {showPanel === 'results' && (
                            <div className="p-3 space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                                    Senaste målgångar
                                </div>
                                {results.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="text-3xl mb-2 opacity-50">🏁</div>
                                        <p className="text-xs">Inga resultat än</p>
                                    </div>
                                ) : (
                                    results.map(result => (
                                        <div key={result.id} className="p-3 rounded-lg bg-slate-800/50 border-l-4 border-emerald-500">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-white">{result.name}</div>
                                                    <div className="text-xs text-slate-400">{result.club}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono text-emerald-400 font-bold">{result.time}</div>
                                                    <div className="text-xs text-slate-500">{result.className} #{result.position}</div>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-600 mt-1">{formatTime(result.timestamp)}</div>
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
                                {comments.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="text-3xl mb-2 opacity-50">🎙️</div>
                                        <p className="text-xs">Inga kommentarer än</p>
                                    </div>
                                ) : (
                                    comments.map(comment => (
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
                                            <div className="text-[10px] text-slate-600 mt-1">{formatTime(comment.timestamp)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
