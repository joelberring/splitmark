'use client';

import { useState, useEffect, useRef } from 'react';
import { useRequireAuth } from '@/lib/auth/hooks';
import { db as localDb } from '@/lib/db';
import { getTrack } from '@/lib/firestore/tracks';
import type { DBTrack, GPSPoint } from '@/types/database';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import PageHeader from '@/components/PageHeader';
import { OrienteeringMapEngine } from '@/lib/maps/engine';
import { getEvent } from '@/lib/firestore/events';
import { AnalysisEngine } from '@/lib/gps/analysis-engine';
import type { GeoPoint } from '@/types/maps';

export default function TrackDetailPage() {
    const params = useParams<{ id: string }>();
    const trackIdsParam = params.id || '';
    const { user, loading: authLoading } = useRequireAuth('/login');
    const [tracks, setTracks] = useState<DBTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [playbackTime, setPlaybackTime] = useState(0); // seconds from start
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isMassStart, setIsMassStart] = useState(true); // Default to mass start for comparison
    const [maxDuration, setMaxDuration] = useState(0);
    const [ghostPace, setGhostPace] = useState(10); // min/km
    const [showMistakes, setShowMistakes] = useState(false);
    const [mistakes, setMistakes] = useState<Array<{ startIdx: number, endIdx: number, type: 'stationary' | 'wandering' }>>([]);

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapEngine = useRef<OrienteeringMapEngine | null>(null);
    const playbackRef = useRef<number>(0);

    useEffect(() => {
        loadTracks();
    }, [trackIdsParam]);

    const loadTracks = async () => {
        setLoading(true);
        try {
            const ids = trackIdsParam.split(',');
            const loadedTracks: DBTrack[] = [];

            for (const id of ids) {
                // First try local db
                const found = await localDb.tracks.get(id);
                if (found) {
                    loadedTracks.push(found);
                } else {
                    // Then try cloud
                    const cloudFound = await getTrack(id);
                    if (cloudFound) {
                        loadedTracks.push(cloudFound);
                    }
                }
            }

            setTracks(loadedTracks);
            if (loadedTracks.length > 0) {
                initMap(loadedTracks);
                const maxDur = Math.max(...loadedTracks.map(t => t.duration || 0));
                setMaxDuration(maxDur);

                // Analyze first track for mistakes
                const detected = AnalysisEngine.detectMistakes(loadedTracks[0].points);
                setMistakes(detected);
            }
        } catch (error) {
            console.error('Failed to load tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    const initMap = async (loadedTracks: DBTrack[]) => {
        if (!mapContainer.current) return;

        const engine = new OrienteeringMapEngine({
            container: mapContainer.current,
            zoom: 15,
        });
        mapEngine.current = engine;

        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        loadedTracks.forEach((t, i) => {
            if (t.points && t.points.length > 0) {
                engine.addTrack(t.points.map(p => ({ lat: p.lat, lng: p.lng })), {
                    color: colors[i % colors.length],
                    width: 3,
                    id: `track-${t.localId}`
                });
            }
        });

        // Center on start of first track
        if (loadedTracks[0]?.points?.[0]) {
            engine.getMap().setCenter([loadedTracks[0].points[0].lng, loadedTracks[0].points[0].lat]);
        }
    };

    // Playback Logic
    useEffect(() => {
        if (!isPlaying || tracks.length === 0 || maxDuration === 0) return;

        const interval = setInterval(() => {
            setPlaybackTime(prev => {
                const next = prev + (0.1 * playbackSpeed);
                if (next >= maxDuration) {
                    setIsPlaying(false);
                    return maxDuration;
                }
                return next;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isPlaying, tracks, playbackSpeed, maxDuration]);

    // Update Player Positions on Map
    useEffect(() => {
        if (tracks.length === 0 || !mapEngine.current) return;

        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        const runners = tracks.map((t, i) => {
            if (!t.points || t.points.length === 0) return null;

            let point;
            if (isMassStart) {
                // Relative time from start of track
                const startTime = t.points[0].timestamp.getTime();
                const targetTime = startTime + (playbackTime * 1000);
                point = t.points.find(p => p.timestamp.getTime() >= targetTime) || t.points[t.points.length - 1];
            } else {
                // Absolute time logic (sync by real-world time)
                // Use first track's start as reference
                const refStartTime = tracks[0].points[0].timestamp.getTime();
                const currentRealTime = refStartTime + (playbackTime * 1000);
                point = t.points.find(p => p.timestamp.getTime() >= currentRealTime);
                if (!point) {
                    if (currentRealTime < t.points[0].timestamp.getTime()) return null; // Hasn't started
                    point = t.points[t.points.length - 1]; // Finished
                }
            }

            return {
                id: t.localId,
                position: { lat: point.lat, lng: point.lng },
                color: colors[i % colors.length]
            };
        }).filter(r => r !== null) as any[];

        mapEngine.current.updateMultipleTrackHeads(runners);
    }, [playbackTime, tracks, isMassStart]);

    // Update Mistake Markers on Map
    useEffect(() => {
        if (!mapEngine.current || tracks.length === 0) return;
        const map = mapEngine.current.getMap();
        const markers: maplibregl.Marker[] = [];

        if (showMistakes && mistakes.length > 0) {
            mistakes.forEach(m => {
                const point = tracks[0].points[m.startIdx];
                const el = document.createElement('div');
                el.className = 'w-6 h-6 bg-amber-600 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-lg';
                el.innerHTML = '🛑';
                el.title = m.type === 'stationary' ? 'Stilla-stående' : 'Vandrande';

                const marker = new maplibregl.Marker(el)
                    .setLngLat([point.lng, point.lat])
                    .addTo(map);
                markers.push(marker);
            });
        }

        return () => {
            markers.forEach(m => m.remove());
        };
    }, [showMistakes, mistakes, tracks]);

    const handleAddGhost = () => {
        if (tracks.length === 0) return;
        const ghost = AnalysisEngine.generateGhostRunner(tracks[0], ghostPace);
        setTracks(prev => [...prev, ghost]);
        if (mapEngine.current) {
            mapEngine.current.addTrack(ghost.points.map(p => ({ lat: p.lat, lng: p.lng })), {
                color: '#64748b',
                width: 2,
                id: `track-${ghost.localId}`
            });
        }
    };

    const calculateCurrentStats = (t: DBTrack) => {
        if (!t.points || t.points.length === 0) return { speed: 0, distance: 0 };

        const startTime = t.points[0].timestamp.getTime();
        const targetTime = startTime + (playbackTime * 1000);

        // Find current point and previous for speed
        const currentIndex = t.points.findIndex(p => p.timestamp.getTime() >= targetTime);
        const currentPoint = t.points[currentIndex === -1 ? t.points.length - 1 : currentIndex];

        return {
            speed: currentPoint.speed || 0,
            distance: (t.distance || 0) * (playbackTime / (t.duration || 1)) // Simplified
        };
    };

    const getPerformanceIndex = (trackId: string) => {
        if (tracks.length < 2) return 100;

        const allStats = tracks.map(t => calculateCurrentStats(t));
        const avgSpeed = allStats.reduce((sum, s) => sum + s.speed, 0) / allStats.length;

        const mySpeed = calculateCurrentStats(tracks.find(t => t.localId === trackId)!).speed;
        if (avgSpeed === 0) return 100;

        return Math.round((mySpeed / avgSpeed) * 100);
    };

    if (authLoading || loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>;
    }

    if (tracks.length === 0) return <div>Track not found</div>;

    const mainTrack = tracks[0];

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <Link href="/tracks" className="text-xs text-slate-500 hover:text-emerald-400 mb-1 inline-block font-bold uppercase tracking-widest">← Mina spår</Link>
                        <h1 className="text-lg font-bold uppercase tracking-tight">{tracks.length > 1 ? `Jämförelse (${tracks.length})` : mainTrack.name}</h1>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
                            <span className="text-[10px] font-black uppercase text-slate-500">Ghost</span>
                            <input
                                type="number"
                                value={ghostPace}
                                onChange={(e) => setGhostPace(parseFloat(e.target.value))}
                                className="w-12 bg-transparent text-xs font-bold text-slate-300 outline-none"
                            />
                            <button onClick={handleAddGhost} className="text-[10px] font-bold text-emerald-400 uppercase hover:text-emerald-300 transition-colors">+ Lägg till</button>
                        </div>
                        <button
                            onClick={() => setShowMistakes(!showMistakes)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${showMistakes ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                        >
                            🛑 Visa Misstag ({mistakes.length})
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 relative">
                <div ref={mapContainer} className="absolute inset-0" />

                {/* Mistake Overlays on Map */}
                {showMistakes && mistakes.map((m, i) => {
                    const point = mainTrack.points[m.startIdx];
                    return (
                        <div key={i} className="absolute z-10 p-2 pointer-events-none" style={{
                            // This is a placeholder since we don't have lat/lng to pixel conversion in React easily
                            // but we could use MapLibre Markers for this. For now just illustrating.
                        }}>
                        </div>
                    );
                })}

                {/* Track List Sidebar Overlay */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {tracks.map((t, i) => {
                        const pi = getPerformanceIndex(t.localId);
                        const stats = calculateCurrentStats(t);
                        return (
                            <div key={t.localId} className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] }} />
                                    <span className="text-[10px] font-bold text-white uppercase truncate max-w-[80px]">{t.name || 'Löpare'}</span>
                                </div>
                                <div className="flex gap-3 border-l border-slate-800 pl-3">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-slate-500 uppercase font-black">PI</span>
                                        <span className={`text-[10px] font-bold ${pi >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{pi}%</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-slate-500 uppercase font-black">Fart</span>
                                        <span className="text-[10px] font-bold text-slate-300">{(stats.speed * 3.6).toFixed(1)} <span className="text-[8px] text-slate-600">km/h</span></span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Replay Controls Overlay */}
                <div className="absolute bottom-10 left-4 right-4 bg-slate-900/90 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsMassStart(true)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isMassStart ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                            >
                                Jaktstart (Start 0:00)
                            </button>
                            <button
                                onClick={() => setIsMassStart(false)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!isMassStart ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                            >
                                Realitid (Gemensam tid)
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-12 h-12 flex items-center justify-center bg-emerald-600 rounded-full hover:bg-emerald-500 transition-colors"
                        >
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>

                        <div className="flex-1 relative">
                            {/* Timeline Mistake Markers */}
                            <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none">
                                {mistakes.map((m, i) => (
                                    <div
                                        key={i}
                                        className="absolute top-0 w-1.5 h-1.5 bg-amber-500 rounded-full"
                                        style={{ left: `${(m.startIdx / mainTrack.points.length) * 100}%` }}
                                        title="Tidstapp"
                                    />
                                ))}
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={maxDuration}
                                step={0.1}
                                value={playbackTime}
                                onChange={(e) => setPlaybackTime(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                            />
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">
                                <span>{Math.floor(playbackTime / 60)}:{(Math.floor(playbackTime % 60)).toString().padStart(2, '0')}</span>
                                <span>{Math.floor(maxDuration / 60)}:{(Math.floor(maxDuration % 60)).toString().padStart(2, '0')}</span>
                            </div>
                        </div>

                        <select
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-slate-800 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none"
                        >
                            <option value={1}>1x</option>
                            <option value={5}>5x</option>
                            <option value={10}>10x</option>
                            <option value={30}>30x</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
