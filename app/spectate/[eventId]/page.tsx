'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
    useEffect(() => {
        const colors = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];
        const classes = ['H21', 'D21', 'H35', 'D35'];
        setAvailableClasses(classes);

        const mockRunners: Runner[] = [
            { id: '1', name: 'Anna Svensson', club: 'OK Linné', className: 'D21', position: { lat: 59.330, lng: 18.070 }, lastUpdate: new Date(), status: 'running', color: colors[0] },
            { id: '2', name: 'Erik Johansson', club: 'IFK Lidingö', className: 'H21', position: { lat: 59.331, lng: 18.071 }, lastUpdate: new Date(), status: 'running', color: colors[1] },
            { id: '3', name: 'Maria Lindberg', club: 'Nacka OK', className: 'D35', position: { lat: 59.329, lng: 18.068 }, lastUpdate: new Date(), status: 'running', color: colors[2] },
            { id: '4', name: 'Johan Holm', club: 'Djurgårdens IF', className: 'H21', position: { lat: 59.332, lng: 18.072 }, lastUpdate: new Date(), status: 'running', color: colors[3] },
        ];
        setRunners(mockRunners);

        const mockResults: ResultEntry[] = [
            { id: 'r1', name: 'Gustav Lindgren', club: 'IFK Lidingö', className: 'H21', time: '27:30', position: 1, timestamp: new Date(Date.now() - 60000) },
            { id: 'r2', name: 'Sofia Nordin', club: 'OK Linné', className: 'D21', time: '29:15', position: 1, timestamp: new Date(Date.now() - 30000) },
        ];
        setResults(mockResults);

        const mockComments: SpeakerComment[] = [
            { id: 'c1', text: 'Välkommen till Älvsjö Night Sprint! Första löparna har startat.', timestamp: new Date(Date.now() - 300000) },
            { id: 'c2', text: 'Gustav Lindgren från IFK Lidingö tar ledningen i H21 med tiden 27:30!', timestamp: new Date(Date.now() - 60000), highlight: true },
        ];
        setComments(mockComments);
    }, [eventId]);

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
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                    <Link href="/spectate" className="text-slate-500 hover:text-white transition-colors">
                        ←
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-wider">Älvsjö Night Sprint</h1>
                        <p className="text-xs text-slate-500">OK Älvsjö-Örby</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1 rounded border border-red-800/50">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Live</span>
                    </div>
                </div>
            </header>

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
                {/* Map */}
                <div className="flex-1 relative">
                    <div ref={mapContainer} className="absolute inset-0" />
                </div>

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
