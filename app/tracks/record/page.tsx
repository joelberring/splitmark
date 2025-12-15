'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth/hooks';
import { gpsTracker } from '@/lib/gps/tracker';
import type { GPSPoint } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RecordTrackPage() {
    const { user, loading: authLoading } = useRequireAuth('/login');
    const router = useRouter();
    const [recording, setRecording] = useState(false);
    const [trackId, setTrackId] = useState<string | null>(null);
    const [currentPoints, setCurrentPoints] = useState<GPSPoint[]>([]);
    const [currentPosition, setCurrentPosition] = useState<GPSPoint | null>(null);
    const [stats, setStats] = useState({ distance: 0, duration: 0, points: 0, speed: 0 });
    const [trackName, setTrackName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let cleanup: (() => void) | null = null;
        if (recording) {
            cleanup = gpsTracker.watchPosition(
                (point) => { setCurrentPosition(point); setCurrentPoints(gpsTracker.getCurrentPoints()); updateStats(); },
                (err) => setError(err.message)
            );
        }
        return () => { if (cleanup) cleanup(); };
    }, [recording]);

    const updateStats = () => {
        const points = gpsTracker.getCurrentPoints();
        let distance = 0;
        for (let i = 1; i < points.length; i++) distance += calculateDistance(points[i - 1], points[i]);

        const getTimestamp = (point: GPSPoint): number => {
            const ts = point.timestamp;
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === 'string') return new Date(ts).getTime();
            if (typeof ts === 'number') return ts;
            return Date.now();
        };

        const duration = points.length > 0 ? (Date.now() - getTimestamp(points[0])) / 1000 : 0;
        const recentPoints = points.slice(-10);
        let recentDistance = 0;
        for (let i = 1; i < recentPoints.length; i++) recentDistance += calculateDistance(recentPoints[i - 1], recentPoints[i]);
        const recentDuration = recentPoints.length > 1 ? (getTimestamp(recentPoints[recentPoints.length - 1]) - getTimestamp(recentPoints[0])) / 1000 : 1;
        const speed = recentDuration > 0 ? (recentDistance / recentDuration) * 3.6 : 0;
        setStats({ distance, duration, points: points.length, speed });
    };

    const calculateDistance = (p1: GPSPoint, p2: GPSPoint): number => {
        const R = 6371000;
        const φ1 = (p1.lat * Math.PI) / 180;
        const φ2 = (p2.lat * Math.PI) / 180;
        const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
        const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const handleStartRecording = async () => {
        if (!trackName.trim()) { setError('Ange ett namn för spåret'); return; }
        setError('');
        try {
            const id = await gpsTracker.startTracking(trackName);
            setTrackId(id);
            setRecording(true);
        } catch (err: any) { setError(err.message); }
    };

    const handleStopRecording = async () => {
        await gpsTracker.stopTracking();
        setRecording(false);
        router.push('/tracks');
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/tracks" className="text-slate-500 hover:text-emerald-400 font-bold text-xs uppercase tracking-wider">← Avbryt</Link>
                    <h1 className="text-sm font-bold uppercase tracking-wider">
                        {recording ? <span className="text-red-400">🔴 Inspelning pågår</span> : '📍 Spela in spår'}
                    </h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-8">
                {!recording ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-xl font-bold uppercase tracking-tight mb-6">Skapa nytt GPS-spår</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Spårnamn</label>
                                <input
                                    type="text"
                                    value={trackName}
                                    onChange={(e) => setTrackName(e.target.value)}
                                    placeholder="T.ex. Träning Hagaparken, Tiomila 2025"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                                <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider mb-2">💡 Tips</h3>
                                <ul className="text-xs text-blue-300/70 space-y-1">
                                    <li>• GPS-spåret sparas automatiskt var 10:e punkt</li>
                                    <li>• Fungerar offline (synkas när du har nätverk)</li>
                                    <li>• Håll telefonen med GPS aktiverad</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleStartRecording}
                                disabled={!trackName.trim()}
                                className="w-full py-4 bg-red-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-red-500 transition-colors disabled:opacity-50"
                            >
                                🔴 Starta inspelning
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard icon="⏱️" label="Tid" value={formatTime(stats.duration)} large />
                            <StatCard icon="📏" label="Distans" value={`${(stats.distance / 1000).toFixed(2)} km`} large />
                            <StatCard icon="⚡" label="Hastighet" value={`${stats.speed.toFixed(1)} km/h`} />
                            <StatCard icon="📍" label="Punkter" value={stats.points.toString()} />
                        </div>

                        {currentPosition && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider mb-3">Aktuell position</h3>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span className="text-slate-500">Lat:</span> <span className="font-mono text-emerald-400">{currentPosition.lat.toFixed(6)}</span></div>
                                    <div><span className="text-slate-500">Lng:</span> <span className="font-mono text-emerald-400">{currentPosition.lng.toFixed(6)}</span></div>
                                    <div><span className="text-slate-500">Noggrannhet:</span> <span className="font-mono">±{currentPosition.accuracy?.toFixed(0) ?? '?'}m</span></div>
                                    {currentPosition.alt && <div><span className="text-slate-500">Höjd:</span> <span className="font-mono">{currentPosition.alt.toFixed(0)}m</span></div>}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleStopRecording}
                            className="w-full py-4 bg-red-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-red-500 transition-colors"
                        >
                            ⏹️ Stoppa inspelning
                        </button>

                        <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-emerald-400">
                                <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                                Spåret sparas automatiskt
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, large }: { icon: string; label: string; value: string; large?: boolean }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className="text-xl mb-1">{icon}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">{label}</div>
            <div className={`font-bold text-emerald-400 ${large ? 'text-2xl' : 'text-xl'}`}>{value}</div>
        </div>
    );
}
