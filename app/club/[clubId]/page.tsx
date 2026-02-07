'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { useAuthState } from '@/lib/auth/hooks';
import { useClubPermissions } from '@/lib/auth/usePermissions';
import {
    getActivities,
    registerForActivity,
    getRegistrations,
    markAttendance,
    getClubTrainingFeed
} from '@/lib/firestore/activities';
import { OfflineManager } from '@/lib/maps/offline-manager';
import type { ClubActivity, ActivityRegistration } from '@/types/club-activities';
import { Timestamp } from 'firebase/firestore';
import { exportToLokStod } from '@/lib/utils/lok-stod-export';

interface Club {
    id: string;
    name: string;
    shortName?: string;
}

interface ClubResult {
    eventId: string;
    eventName: string;
    eventDate: string;
    className: string;
    personName: string;
    position?: string;
    time?: string;
    status: string;
}

export default function ClubHomepage() {
    const { clubId } = useParams() as { clubId: string };
    const { user } = useAuthState();
    const { isClubAdmin } = useClubPermissions(clubId);

    const [club, setClub] = useState<Club | null>(null);
    const [results, setResults] = useState<ClubResult[]>([]);
    const [activities, setActivities] = useState<ClubActivity[]>([]);
    const [trainingFeed, setTrainingFeed] = useState<any[]>([]);
    const [registrations, setRegistrations] = useState<Record<string, ActivityRegistration[]>>({});

    const [activeTab, setActiveTab] = useState<'results' | 'activity' | 'training' | 'info' | 'chat' | 'karta'>('results');
    const [loading, setLoading] = useState(true);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [downloadingMap, setDownloadingMap] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        if (clubId) {
            fetchClubData();
        }
    }, [clubId]);

    const fetchClubData = async () => {
        setLoading(true);
        try {
            // Fetch club info
            const clubRes = await fetch(`/api/eventor/clubs/${clubId}`);
            if (clubRes.ok) {
                const clubData = await clubRes.json();
                setClub(clubData);
            }

            // Fetch results
            const resultsRes = await fetch(`/api/eventor/results/${clubId}`);
            if (resultsRes.ok) {
                const resultsData = await resultsRes.json();
                setResults(resultsData.results);
            }

            // Fetch activities
            const clubActivities = await getActivities(clubId);
            setActivities(clubActivities);

            // Fetch registrations for each activity
            const regsMap: Record<string, ActivityRegistration[]> = {};
            for (const act of clubActivities) {
                regsMap[act.id] = await getRegistrations(act.id);
            }
            setRegistrations(regsMap);

            // Fetch training feed
            const feed = await getClubTrainingFeed(clubId);
            setTrainingFeed(feed);
        } catch (error) {
            console.error('Failed to fetch club data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (activityId: string) => {
        if (!user) return;
        try {
            await registerForActivity(clubId, activityId, user.uid, user.displayName || 'Användare');
            // Refresh registrations for this activity
            const newRegs = await getRegistrations(activityId);
            setRegistrations(prev => ({ ...prev, [activityId]: newRegs }));
        } catch (error) {
            console.error('Failed to register:', error);
        }
    };

    const handleMarkAttendance = async (activityId: string, registrationId: string, status: 'attended' | 'no-show') => {
        if (!user || !isClubAdmin) return;
        try {
            await markAttendance(registrationId, status, user.uid);
            // Refresh registrations
            const newRegs = await getRegistrations(activityId);
            setRegistrations(prev => ({ ...prev, [activityId]: newRegs }));
        } catch (error) {
            console.error('Failed to mark attendance:', error);
        }
    };

    const handleExport = (activity: ClubActivity, registrations: ActivityRegistration[]) => {
        const xml = exportToLokStod(activity, registrations, 'xml') as string;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LOK-stod-${activity.name}-${new Date().toISOString().split('T')[0]}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadOfflineMap = async (activity: ClubActivity) => {
        setDownloadingMap(true);
        try {
            // Simplified: Download tiles for activity area (approx 1km around center)
            const coords = activity.locationCoordinates || { lat: 59.3293, lng: 18.0686 }; // Stockholm default
            const lat = coords.lat;
            const lng = coords.lng;
            const bbox: [number, number, number, number] = [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01];

            await OfflineManager.downloadMapPack(
                bbox,
                14, 18,
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png', // Default OSM
                (current, total) => setDownloadProgress({ current, total })
            );
            alert('✓ Karta nedladdad för offline!');
        } catch (error) {
            console.error('Failed to download map:', error);
            alert('Kunde inte ladda ner karta.');
        } finally {
            setDownloadingMap(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-6xl mb-6">🏚️</div>
                <h1 className="text-2xl font-bold text-white mb-2">Klubben hittades inte</h1>
                <p className="text-slate-500 mb-8">Vi kunde inte hitta organisationen du letar efter.</p>
                <button onClick={() => window.history.back()} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs">Gå tillbaka</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <PageHeader
                title={club.name}
                subtitle="Klubbhubb & Aktiviteter"
                showLogo
            />

            {/* Club Banner/Header */}
            <div className="relative h-24 bg-gradient-to-br from-emerald-600/20 to-emerald-900/40 border-b border-emerald-500/10 overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="absolute bottom-3 left-6 flex items-end gap-4 relative z-10">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl border-2 border-slate-800 flex items-center justify-center text-2xl shadow-2xl skew-x-[-5deg]">
                        🏠
                    </div>
                    <div className="mb-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-0.5">Officiell klubbsida</div>
                        <div className="text-xl font-black text-white uppercase tracking-tight">{club.shortName || club.name}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <nav className="flex px-4 border-b border-slate-800 overflow-x-auto no-scrollbar bg-slate-950/80 backdrop-blur-md sticky top-[104px] md:top-[112px] z-30">
                <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} label="Resultat" />
                <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Anmälan" />
                <TabButton active={activeTab === 'training'} onClick={() => setActiveTab('training')} label="Träning" />
                <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')} label="Information" />
                <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} label="Chatt" />
                <TabButton active={activeTab === 'karta'} onClick={() => setActiveTab('karta')} label="Karta" />
            </nav>

            {/* Content */}
            <main className="p-4">
                {activeTab === 'results' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Senaste resultat</h2>
                            <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono">Last 30 days</span>
                        </div>

                        {results.length === 0 ? (
                            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
                                <div className="text-4xl mb-4 opacity-30">🥈</div>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Inga recenta resultat hittades</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {results.map((res, i) => (
                                    <div key={i} className="bg-slate-900 rounded-xl p-4 border border-slate-800 hover:bg-slate-800/50 transition-colors group">
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className="font-bold text-emerald-400 text-xs uppercase">{res.personName}</span>
                                            <span className="text-slate-500 text-[10px] font-mono">{res.eventDate}</span>
                                        </div>
                                        <h3 className="text-white font-bold leading-tight group-hover:text-emerald-300 transition-colors">{res.eventName}</h3>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">{res.className}</span>
                                            <span className="text-sm font-bold text-white">
                                                {res.status === 'OK' ? (res.position ? `#${res.position}` : 'Godkänd') : res.status}
                                            </span>
                                            {res.time && <span className="text-sm font-mono text-emerald-500/80">{res.time}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Klubbaktiviteter</h2>
                            <div className="flex gap-2">
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setIsAdminMode(!isAdminMode)}
                                        className={`text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-[0.2em] transition-all border ${isAdminMode ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {isAdminMode ? 'Admin läge: PÅ' : 'Admin läge'}
                                    </button>
                                )}
                                <Link
                                    href="/admin/events/new"
                                    className="text-[10px] bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-black uppercase tracking-[0.2em] hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-900/20"
                                >
                                    + Ny aktivitet
                                </Link>
                            </div>
                        </div>

                        {activities.length === 0 ? (
                            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800 border-dashed">
                                <div className="text-4xl mb-4 opacity-30">🏃</div>
                                <h3 className="text-white font-bold mb-1">Inga kommande aktiviteter</h3>
                                <p className="text-slate-500 text-xs">Här visas klubbträningar och möten som kräver anmälan.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activities.map((act) => {
                                    const actRegs = registrations[act.id] || [];
                                    const isRegistered = actRegs.some(r => r.userId === user?.uid);

                                    return (
                                        <div key={act.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                                            <div className="p-4 border-b border-slate-800/50">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-white text-lg">{act.name}</h3>
                                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase mt-1">
                                                            <span>📅 {act.date instanceof Timestamp ? act.date.toDate().toLocaleDateString() : act.date.toString()}</span>
                                                            <span>⏰ {act.startTime}</span>
                                                            <span>📍 {act.location}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRegister(act.id)}
                                                        disabled={isRegistered}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isRegistered ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'}`}
                                                    >
                                                        {isRegistered ? 'Anmäld' : 'Anmäl mig'}
                                                    </button>
                                                </div>
                                                {act.description && <p className="text-sm text-slate-400 mt-2">{act.description}</p>}
                                            </div>

                                            <div className="p-4 bg-slate-950/50">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Deltagare ({actRegs.length})</span>
                                                    {isAdminMode && actRegs.length > 0 && (
                                                        <button
                                                            onClick={() => handleExport(act, actRegs)}
                                                            className="text-[10px] text-emerald-400 font-bold uppercase hover:text-emerald-300 transition-colors flex items-center gap-1"
                                                        >
                                                            📥 LOK-stöd Export
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {actRegs.map(reg => (
                                                        <div key={reg.id} className="group relative">
                                                            <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${reg.status === 'attended' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                                                {reg.userName}
                                                            </div>
                                                            {isAdminMode && (
                                                                <div className="absolute top-full left-0 mt-1 hidden group-hover:flex bg-slate-900 border border-slate-700 rounded-lg p-1 z-10 shadow-2xl">
                                                                    <button
                                                                        onClick={() => handleMarkAttendance(act.id, reg.id, 'attended')}
                                                                        className="p-1 hover:bg-emerald-900/30 text-emerald-400 rounded"
                                                                    >
                                                                        ✅
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMarkAttendance(act.id, reg.id, 'no-show')}
                                                                        className="p-1 hover:bg-rose-900/30 text-rose-400 rounded"
                                                                    >
                                                                        ❌
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'training' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Klubbflöde</h2>
                            <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono">Live Training</span>
                        </div>

                        {trainingFeed.length === 0 ? (
                            <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
                                <div className="text-4xl mb-4 opacity-30">🚵</div>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Inga recenta pass från medlemmar</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {trainingFeed.map((track) => (
                                    <Link
                                        key={track.id}
                                        href={`/tracks/${track.id}`}
                                        className="block bg-slate-900 rounded-2xl p-4 border border-slate-800 hover:bg-slate-800/50 transition-all group"
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                                                🏃
                                            </div>
                                            <div>
                                                <div className="font-bold text-white group-hover:text-emerald-400 transition-colors uppercase text-xs tracking-wider">{track.userName || 'Klubbmedlem'}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{track.startTime instanceof Timestamp ? track.startTime.toDate().toLocaleString() : track.startTime}</div>
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-white mb-2">{track.name}</h4>
                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            <span>📏 {(track.distance / 1000).toFixed(1)} km</span>
                                            <span>⏱️ {Math.floor(track.duration / 60)} min</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="space-y-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Information & Anslagstavla</h2>
                        <div className="grid gap-4">
                            <div className="bg-blue-900/20 border border-blue-800/50 rounded-2xl p-6">
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-2">💡 Välkommen</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">Välkommen till {club.name}s nya klubbsida. Här samlar vi allt som rör klubben, från resultat till interna träningar.</p>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">2025-12-17 · Info</div>
                                <h3 className="text-white font-bold uppercase text-xs mb-2">Vinterserien startar!</h3>
                                <p className="text-slate-400 text-sm">Nu drar vi igång årets vinterserie. Kolla kalendern för tider och platser.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <h3 className="text-white font-bold text-xs uppercase mb-2">Träningsområden</h3>
                                <ul className="space-y-2 text-xs text-slate-400">
                                    <li className="flex items-center gap-2">🌲 Älvsjöskogen</li>
                                    <li className="flex items-center gap-2">🌲 Gömmaren</li>
                                    <li className="flex items-center gap-2">🏫 Älvsjö Centrum (Sprint)</li>
                                </ul>
                            </div>
                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-4">
                                <h3 className="font-bold text-white uppercase tracking-wider">Verktyg</h3>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleDownloadOfflineMap(activities[0])}
                                        disabled={downloadingMap || activities.length === 0}
                                        className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-between"
                                    >
                                        <span>{downloadingMap ? `Laddar ner... (${downloadProgress.current}/${downloadProgress.total})` : '⬇️ Spara karta offline'}</span>
                                        <span className="text-slate-500 text-[10px]">OSM + O-map</span>
                                    </button>

                                    {isClubAdmin && (
                                        <button
                                            onClick={() => {/* Export logic */ }}
                                            className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all text-left"
                                        >
                                            📊 LOK-stöd Export
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="flex flex-col h-[50vh] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                        <div className="flex-1 p-4 overflow-y-auto space-y-4">
                            <div className="text-center py-8">
                                <div className="text-3xl mb-2 opacity-20">💬</div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Börja chatta med medlemmarna</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-950 border-t border-slate-800">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                    placeholder="Skriv ett meddelande..."
                                />
                                <button className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'karta' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Karta & Träningsområden</h2>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 overflow-hidden">
                            <div className="aspect-video bg-slate-950 rounded-xl relative flex items-center justify-center group cursor-pointer overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent z-10"></div>
                                <div className="z-20 text-center">
                                    <div className="text-4xl mb-2">🗺️</div>
                                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Visa Klubbkartan</h3>
                                    <p className="text-slate-500 text-[10px] mt-1">Öppna den interaktiva kartvisaren</p>
                                </div>
                                <Link
                                    href="/map"
                                    className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600/20"
                                >
                                    <span className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs shadow-xl">Öppna Karta</span>
                                </Link>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <h3 className="text-white font-bold text-xs uppercase mb-2">Träningsområden</h3>
                                <ul className="space-y-2 text-xs text-slate-400">
                                    <li className="flex items-center gap-2">🌲 Älvsjöskogen</li>
                                    <li className="flex items-center gap-2">🌲 Gömmaren</li>
                                    <li className="flex items-center gap-2">🏫 Älvsjö Centrum (Sprint)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`py-4 px-4 border-b-2 transition-all font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap ${active
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-white'
                }`}
        >
            {label}
        </button>
    );
}
