'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { findClubById } from '@/types/clubs';

interface TrainingParticipant {
    id: string;
    name: string;
    position: { lat: number; lng: number };
    lastUpdate: Date;
    color: string;
    distance: number; // meters
    duration: number; // seconds
}

export default function ClubLivePage() {
    const params = useParams();
    const clubId = params.clubId as string;
    const club = findClubById(clubId);

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

    const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [following, setFollowing] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [17.6389, 59.8586], // Uppsala area
            zoom: 13,
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Mock training participants
    useEffect(() => {
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        const mockParticipants: TrainingParticipant[] = [
            { id: '1', name: 'Anna Svensson', position: { lat: 59.860, lng: 17.640 }, lastUpdate: new Date(), color: colors[0], distance: 3450, duration: 1245 },
            { id: '2', name: 'Erik Johansson', position: { lat: 59.858, lng: 17.642 }, lastUpdate: new Date(), color: colors[1], distance: 2890, duration: 1120 },
            { id: '3', name: 'Maria Lindberg', position: { lat: 59.859, lng: 17.638 }, lastUpdate: new Date(), color: colors[2], distance: 4120, duration: 1567 },
            { id: '4', name: 'Johan Holm', position: { lat: 59.861, lng: 17.641 }, lastUpdate: new Date(), color: colors[3], distance: 2100, duration: 890 },
        ];
        setParticipants(mockParticipants);
    }, []);

    // Update positions periodically
    useEffect(() => {
        const interval = setInterval(() => {
            setParticipants(prev => prev.map(p => ({
                ...p,
                position: {
                    lat: p.position.lat + (Math.random() - 0.5) * 0.0003,
                    lng: p.position.lng + (Math.random() - 0.5) * 0.0003,
                },
                lastUpdate: new Date(),
                distance: p.distance + Math.floor(Math.random() * 10),
                duration: p.duration + 2,
            })));
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Update markers
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        participants.forEach(participant => {
            if (markersRef.current.has(participant.id)) {
                const marker = markersRef.current.get(participant.id)!;
                marker.setLngLat([participant.position.lng, participant.position.lat]);
            } else {
                const el = document.createElement('div');
                el.style.cssText = `
                    width: 28px; height: 28px; border-radius: 50%;
                    background: ${participant.color}; border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; color: white; font-weight: bold;
                `;
                el.innerText = participant.name.charAt(0);
                el.addEventListener('click', () => setSelectedParticipant(participant.id));

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([participant.position.lng, participant.position.lat])
                    .addTo(map);

                markersRef.current.set(participant.id, marker);
            }
        });

        // Follow selected
        if (following) {
            const p = participants.find(x => x.id === following);
            if (p) {
                map.easeTo({
                    center: [p.position.lng, p.position.lat],
                    duration: 500,
                });
            }
        }
    }, [participants, following]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDistance = (meters: number) => {
        return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
    };

    const startTracking = () => {
        setIsTracking(true);
        // In production: Start GPS tracking and send positions to server
    };

    const stopTracking = () => {
        setIsTracking(false);
        // In production: Stop GPS tracking
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                    <Link href={`/club/${clubId}`} className="text-slate-500 hover:text-white transition-colors">
                        ←
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-wider">Live Träning</h1>
                        <p className="text-xs text-slate-500">{club?.name || 'Klubb'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-emerald-900/30 px-3 py-1 rounded border border-emerald-800/50">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-400 text-xs font-bold">{participants.length} aktiva</span>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex relative overflow-hidden">
                {/* Map */}
                <div className="flex-1 relative">
                    <div ref={mapContainer} className="absolute inset-0" />
                </div>

                {/* Sidebar */}
                <div className="w-72 bg-slate-900/95 border-l border-slate-800 flex flex-col">
                    {/* Your tracking status */}
                    <div className="p-3 border-b border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Din träning</h3>
                        {isTracking ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-emerald-900/30 rounded border border-emerald-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        <span className="text-emerald-400 text-sm font-bold">Spårar...</span>
                                    </div>
                                    <button
                                        onClick={stopTracking}
                                        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold uppercase hover:bg-red-500"
                                    >
                                        Stoppa
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={startTracking}
                                className="w-full py-2 bg-emerald-600 text-white rounded font-bold text-xs uppercase tracking-wider hover:bg-emerald-500"
                            >
                                🏃 Starta spårning
                            </button>
                        )}
                    </div>

                    {/* Participants list */}
                    <div className="flex-1 overflow-y-auto p-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Deltagare</h3>
                        <div className="space-y-2">
                            {participants.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedParticipant(p.id);
                                        setFollowing(following === p.id ? null : p.id);
                                    }}
                                    className={`w-full p-3 rounded-lg border-l-4 text-left transition-all ${selectedParticipant === p.id ? 'bg-slate-800' : 'bg-slate-800/50 hover:bg-slate-800'
                                        }`}
                                    style={{ borderColor: p.color }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">{p.name}</div>
                                            <div className="text-xs text-slate-400">
                                                {formatDistance(p.distance)} • {formatDuration(p.duration)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {following === p.id && (
                                                <span className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-full">
                                                    FÖLJER
                                                </span>
                                            )}
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
