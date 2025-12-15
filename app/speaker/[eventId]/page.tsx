'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Entry } from '@/types/entry';
import PunchInput from '@/components/Speaker/PunchInput';
import EventFeed, { resultsToEvents, type RaceEvent } from '@/components/Speaker/EventFeed';

interface EventData {
    eventId: string;
    entries: Entry[];
    classes: any[];
    eventName: string;
}

export default function SpeakerPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const [data, setData] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [view, setView] = useState<'events' | 'class' | 'missing' | 'input' | 'feed'>('events');
    const [selectedClass, setSelectedClass] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedFeedClasses, setSelectedFeedClasses] = useState<string[]>([]);

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            setCurrentTime(new Date());
            loadData(); // Refresh data
        }, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setData({
                    eventId,
                    entries: event.entries || [],
                    classes: event.classes || [],
                    eventName: event.name,
                });
                if (!selectedClass && event.classes?.length > 0) {
                    setSelectedClass(event.classes[0].id);
                }
            }
        }
        setLoading(false);
    };

    // Recent finishes (last 10)
    const recentFinishes = useMemo(() => {
        if (!data) return [];
        return data.entries
            .filter(e => e.status === 'finished' && e.finishTime)
            .sort((a, b) => new Date(b.finishTime!).getTime() - new Date(a.finishTime!).getTime())
            .slice(0, 10)
            .map(entry => ({
                ...entry,
                totalTime: entry.startTime && entry.finishTime
                    ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                    : 0,
            }));
    }, [data]);

    // Class results
    const classResults = useMemo(() => {
        if (!data || !selectedClass) return [];
        return data.entries
            .filter(e => e.classId === selectedClass && e.status === 'finished')
            .map(entry => ({
                ...entry,
                totalTime: entry.startTime && entry.finishTime
                    ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                    : 0,
            }))
            .sort((a, b) => a.totalTime - b.totalTime);
    }, [data, selectedClass]);

    // Missing runners
    const missingRunners = useMemo(() => {
        if (!data) return [];
        return data.entries
            .filter(e => e.startTime && !e.finishTime && e.status !== 'dns')
            .map(entry => ({
                ...entry,
                elapsed: currentTime.getTime() - new Date(entry.startTime!).getTime(),
            }))
            .sort((a, b) => b.elapsed - a.elapsed);
    }, [data, currentTime]);

    const toggleFavorite = (entryId: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(entryId)) {
            newFavorites.delete(entryId);
        } else {
            newFavorites.add(entryId);
        }
        setFavorites(newFavorites);
    };

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getClassName = (classId: string): string => {
        return data?.classes.find((c: any) => c.id === classId)?.name || '';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-400"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-400 hover:text-emerald-400 mb-1 inline-block">
                                ← Admin
                            </Link>
                            <h1 className="text-2xl font-bold text-white">
                                🎙️ Speakerstöd - {data?.eventName}
                            </h1>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-mono font-bold text-emerald-400">
                                {currentTime.toLocaleTimeString('sv-SE')}
                            </div>
                            <div className="text-sm text-gray-400">
                                Live uppdatering var 5:e sekund
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2">
                    {[
                        { id: 'events', label: '🏃 Målgångar', icon: '' },
                        { id: 'feed', label: '📡 Händelseström', icon: '' },
                        { id: 'class', label: '🏆 Klassresultat', icon: '' },
                        { id: 'missing', label: '🌲 Kvar i skogen', icon: '' },
                        { id: 'input', label: '⏱️ Tidsinmatning', icon: '' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id as any)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === tab.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <div className="flex-1"></div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showFavoritesOnly}
                            onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span className="text-gray-300">⭐ Endast favoriter</span>
                    </label>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Events View */}
                {view === 'events' && (
                    <div className="space-y-3">
                        {recentFinishes.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <div className="text-6xl mb-4">⏳</div>
                                <p>Väntar på målgångar...</p>
                            </div>
                        ) : (
                            recentFinishes
                                .filter(e => !showFavoritesOnly || favorites.has(e.id))
                                .map((entry, index) => (
                                    <div
                                        key={entry.id}
                                        className={`bg-gray-800 rounded-xl p-4 border-l-4 ${index === 0 ? 'border-emerald-500 bg-gray-800/80' : 'border-gray-700'
                                            } ${entry.resultStatus === 'mp' ? 'border-red-500' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => toggleFavorite(entry.id)}
                                                    className={`text-2xl ${favorites.has(entry.id) ? 'text-yellow-400' : 'text-gray-600'}`}
                                                >
                                                    ⭐
                                                </button>
                                                <div>
                                                    <div className="text-xl font-bold">
                                                        {entry.firstName} {entry.lastName}
                                                    </div>
                                                    <div className="text-gray-400">
                                                        {entry.clubName} · {getClassName(entry.classId)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-3xl font-mono font-bold ${entry.resultStatus === 'mp' ? 'text-red-400' : 'text-emerald-400'
                                                    }`}>
                                                    {formatTime(entry.totalTime)}
                                                </div>
                                                {entry.resultStatus === 'mp' && (
                                                    <div className="text-sm text-red-400">FELSTÄMPLING</div>
                                                )}
                                                <div className="text-sm text-gray-500">
                                                    {entry.finishTime && new Date(entry.finishTime).toLocaleTimeString('sv-SE')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                )}

                {/* EventFeed View - Advanced event stream */}
                {view === 'feed' && (
                    <div className="h-[calc(100vh-250px)]">
                        <EventFeed
                            events={resultsToEvents(data?.entries || [])}
                            classes={(data?.classes || []).map((c: any) => ({ id: c.id, name: c.name }))}
                            selectedClasses={selectedFeedClasses}
                            onClassToggle={(classId) => {
                                setSelectedFeedClasses(prev =>
                                    prev.includes(classId)
                                        ? prev.filter(id => id !== classId)
                                        : [...prev, classId]
                                );
                            }}
                            maxEvents={100}
                        />
                    </div>
                )}

                {/* Class View */}
                {view === 'class' && (
                    <div>
                        {/* Class Selection */}
                        <div className="flex gap-2 flex-wrap mb-4">
                            {data?.classes.map((cls: any) => (
                                <button
                                    key={cls.id}
                                    onClick={() => setSelectedClass(cls.id)}
                                    className={`px-4 py-2 rounded-lg font-semibold ${selectedClass === cls.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                >
                                    {cls.name}
                                </button>
                            ))}
                        </div>

                        {/* Leaderboard */}
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-gray-700">
                                <h2 className="text-xl font-bold">
                                    {getClassName(selectedClass)} - Topp {classResults.length}
                                </h2>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {classResults
                                    .filter(e => !showFavoritesOnly || favorites.has(e.id))
                                    .slice(0, 15)
                                    .map((entry, index) => (
                                        <div
                                            key={entry.id}
                                            className={`p-4 flex items-center justify-between ${index === 0 ? 'bg-yellow-500/10' :
                                                index === 1 ? 'bg-gray-400/10' :
                                                    index === 2 ? 'bg-orange-500/10' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${index === 0 ? 'bg-yellow-500 text-yellow-900' :
                                                    index === 1 ? 'bg-gray-400 text-gray-900' :
                                                        index === 2 ? 'bg-orange-500 text-orange-900' :
                                                            'bg-gray-700 text-gray-300'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <button
                                                    onClick={() => toggleFavorite(entry.id)}
                                                    className={favorites.has(entry.id) ? 'text-yellow-400' : 'text-gray-600'}
                                                >
                                                    ⭐
                                                </button>
                                                <div>
                                                    <div className="font-bold">{entry.firstName} {entry.lastName}</div>
                                                    <div className="text-sm text-gray-400">{entry.clubName}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-mono font-bold text-emerald-400">
                                                    {formatTime(entry.totalTime)}
                                                </div>
                                                {index > 0 && classResults[0] && (
                                                    <div className="text-sm text-gray-500">
                                                        +{formatTime(entry.totalTime - classResults[0].totalTime)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Missing View */}
                {view === 'missing' && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {missingRunners.length === 0 ? (
                            <div className="col-span-full p-12 text-center text-gray-400 bg-gray-800 rounded-xl">
                                <div className="text-6xl mb-4">✅</div>
                                <p>Alla deltagare i mål!</p>
                            </div>
                        ) : (
                            missingRunners
                                .filter(e => !showFavoritesOnly || favorites.has(e.id))
                                .map(entry => {
                                    const isOverdue = entry.elapsed > 60 * 60 * 1000; // > 1 hour
                                    const isCritical = entry.elapsed > 90 * 60 * 1000; // > 1.5 hours

                                    return (
                                        <div
                                            key={entry.id}
                                            className={`bg-gray-800 rounded-xl p-4 border-l-4 ${isCritical ? 'border-red-500 bg-red-900/20' :
                                                isOverdue ? 'border-yellow-500 bg-yellow-900/20' :
                                                    'border-gray-700'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold">{entry.firstName} {entry.lastName}</div>
                                                <button
                                                    onClick={() => toggleFavorite(entry.id)}
                                                    className={favorites.has(entry.id) ? 'text-yellow-400' : 'text-gray-600'}
                                                >
                                                    ⭐
                                                </button>
                                            </div>
                                            <div className="text-sm text-gray-400 mb-2">
                                                {entry.clubName} · {getClassName(entry.classId)}
                                            </div>
                                            <div className={`text-2xl font-mono font-bold ${isCritical ? 'text-red-400' :
                                                isOverdue ? 'text-yellow-400' :
                                                    'text-white'
                                                }`}>
                                                {formatTime(entry.elapsed)}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Startade {entry.startTime && new Date(entry.startTime).toLocaleTimeString('sv-SE')}
                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                )}

                {/* Punch Input View */}
                {view === 'input' && (
                    <div className="max-w-xl mx-auto">
                        <PunchInput
                            entries={data?.entries || []}
                            controls={[
                                { code: '31', name: 'Start' },
                                { code: '32' },
                                { code: '33' },
                                { code: '34' },
                                { code: '35' },
                                { code: '100', name: 'Mål' },
                            ]}
                            onPunch={(entryId, controlCode, time) => {
                                // Save punch to localStorage
                                const storedEvents = localStorage.getItem('events');
                                if (storedEvents) {
                                    const events = JSON.parse(storedEvents);
                                    const eventIndex = events.findIndex((e: any) => e.id === eventId);
                                    if (eventIndex >= 0) {
                                        const entryIndex = events[eventIndex].entries?.findIndex((e: any) => e.id === entryId);
                                        if (entryIndex >= 0) {
                                            if (controlCode === '100' || controlCode.toLowerCase() === 'mål') {
                                                events[eventIndex].entries[entryIndex].finishTime = time.toISOString();
                                                events[eventIndex].entries[entryIndex].status = 'finished';
                                            }
                                            localStorage.setItem('events', JSON.stringify(events));
                                            loadData();
                                        }
                                    }
                                }
                            }}
                        />
                        <div className="mt-4 p-4 bg-gray-800 rounded-xl text-sm text-gray-400">
                            <p>💡 Tips: Använd kontrollkod <strong>100</strong> eller <strong>Mål</strong> för att registrera sluttid.</p>
                        </div>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 py-3">
                    <div className="max-w-7xl mx-auto px-4 flex justify-around text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-400">{data?.entries.length || 0}</div>
                            <div className="text-xs text-gray-400">Anmälda</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-emerald-400">
                                {data?.entries.filter(e => e.status === 'finished').length || 0}
                            </div>
                            <div className="text-xs text-gray-400">I mål</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-yellow-400">{missingRunners.length}</div>
                            <div className="text-xs text-gray-400">Kvar</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-400">
                                {data?.entries.filter(e => e.resultStatus === 'mp').length || 0}
                            </div>
                            <div className="text-xs text-gray-400">Felst.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
