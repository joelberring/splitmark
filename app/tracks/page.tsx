'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth/hooks';
import { db } from '@/lib/db';
import type { DBTrack } from '@/types/database';
import { exportToGPX } from '@/lib/gps/tracker';
import { useStravaAuth, uploadTrackToStrava } from '@/lib/strava/hooks';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

export default function TracksPage() {
    const { user, loading: authLoading } = useRequireAuth('/login');
    const [tracks, setTracks] = useState<DBTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'synced' | 'unsynced'>('all');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const strava = useStravaAuth();

    useEffect(() => {
        loadTracks();
    }, [filter]);

    const loadTracks = async () => {
        setLoading(true);
        try {
            let query = db.tracks.orderBy('startTime').reverse();
            if (filter === 'synced') query = query.filter(t => t.synced === true);
            else if (filter === 'unsynced') query = query.filter(t => t.synced === false);
            const results = await query.toArray();
            setTracks(results);
        } catch (error) {
            console.error('Failed to load tracks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportGPX = async (track: DBTrack) => {
        if (!track.points || track.points.length === 0) { alert('Inga GPS-punkter att exportera'); return; }
        const gpx = exportToGPX(track.points, { name: track.name, description: `Orienteringsspår från ${track.startTime?.toLocaleDateString()}` });
        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.name.replace(/\s+/g, '_')}.gpx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleStravaUpload = async (track: DBTrack) => {
        if (!track.points || track.points.length === 0) { alert('Inga GPS-punkter'); return; }
        const tokenValid = await strava.refreshTokenIfNeeded();
        if (!tokenValid) { strava.connect(); return; }
        setUploadingId(track.localId);
        try {
            const gpx = exportToGPX(track.points, { name: track.name });
            const result = await uploadTrackToStrava(gpx, track.name, `Spårat med Splitmark`);
            if (result.success) {
                await db.tracks.update(track.localId, { synced: true });
                loadTracks();
                alert('✓ Uppladdad till Strava!');
            } else {
                alert(`Fel: ${result.error}`);
            }
        } catch { alert('Kunde inte ladda upp'); }
        finally { setUploadingId(null); }
    };

    const handleDelete = async (trackId: string) => {
        if (confirm('Ta bort detta spår?')) {
            await db.tracks.delete(trackId);
            loadTracks();
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title="Mina GPS-Spår"
                showLogo
                rightAction={
                    <Link
                        href="/tracks/record"
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-emerald-500 transition-colors"
                    >
                        📍 Spela in
                    </Link>
                }
            />

            {/* Strava Connection */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                {strava.isConnected ? (
                    <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-sm font-bold">⚡ Strava ansluten</span>
                        <button onClick={strava.disconnect} className="text-xs text-slate-500 hover:text-white underline">Koppla från</button>
                    </div>
                ) : (
                    <button onClick={strava.connect} disabled={strava.loading} className="px-4 py-2 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-orange-500 transition-colors disabled:opacity-50">
                        ⚡ Anslut Strava
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="px-4 py-3 flex gap-2 border-b border-slate-800">
                {(['all', 'synced', 'unsynced'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${filter === f
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        {f === 'all' ? 'Alla' : f === 'synced' ? 'Synkade' : 'Ej synkade'}
                    </button>
                ))}
            </div>

            {/* Tracks List */}
            <main className="flex-1 px-4 py-4">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />)}
                    </div>
                ) : tracks.length === 0 ? (
                    <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
                        <div className="text-5xl mb-4 opacity-30">📍</div>
                        <p className="text-slate-500 uppercase tracking-wide text-sm font-bold mb-4">Inga spår ännu</p>
                        <Link href="/tracks/record" className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                            Spela in spår
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tracks.map((track) => (
                            <TrackCard
                                key={track.localId}
                                track={track}
                                onExport={handleExportGPX}
                                onDelete={handleDelete}
                                onStravaUpload={strava.isConnected ? handleStravaUpload : undefined}
                                isUploading={uploadingId === track.localId}
                            />
                        ))}
                    </div>
                )}
            </main>

        </div>
    );
}

function TrackCard({ track, onExport, onDelete, onStravaUpload, isUploading = false }: {
    track: DBTrack; onExport: (t: DBTrack) => void; onDelete: (id: string) => void;
    onStravaUpload?: (t: DBTrack) => void; isUploading?: boolean;
}) {
    const formatDuration = (s?: number) => {
        if (!s) return '-';
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };
    const formatDistance = (m?: number) => m ? (m / 1000).toFixed(2) + ' km' : '-';

    return (
        <div className="bg-slate-900 rounded-xl p-4 border-l-4 border-emerald-500 hover:bg-slate-800/80 transition-all">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-white truncate">{track.name}</h3>
                        {track.synced ? (
                            <span className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-800/50">✓ Synkad</span>
                        ) : (
                            <span className="px-2 py-0.5 bg-amber-900/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-800/50">Lokal</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>📅 {track.startTime?.toLocaleDateString('sv-SE') || '-'}</span>
                        <span>⏱️ {formatDuration(track.duration)}</span>
                        <span>📏 {formatDistance(track.distance)}</span>
                        <span>📍 {track.points?.length || 0} pkt</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Link href={`/tracks/${track.localId}`} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-emerald-500 transition-colors text-center">
                        Visa
                    </Link>
                    {onStravaUpload && !track.synced && (
                        <button onClick={() => onStravaUpload(track)} disabled={isUploading} className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-orange-500 transition-colors disabled:opacity-50">
                            {isUploading ? '...' : '⚡ Strava'}
                        </button>
                    )}
                    <button onClick={() => onExport(track)} className="px-3 py-1.5 bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-slate-600 transition-colors">
                        GPX
                    </button>
                    <button onClick={() => onDelete(track.localId)} className="px-3 py-1.5 bg-red-600/20 text-red-400 text-xs font-bold uppercase tracking-wider rounded hover:bg-red-600/30 transition-colors">
                        Ta bort
                    </button>
                </div>
            </div>
        </div>
    );
}
