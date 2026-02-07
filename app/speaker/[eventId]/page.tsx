'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Entry, EntryWithResult } from '@/types/entry';
import PunchInput from '@/components/Speaker/PunchInput';
import EventFeed, { resultsToEvents, type RaceEvent } from '@/components/Speaker/EventFeed';
import { getEvent, subscribeToEvents, type FirestoreEvent } from '@/lib/firestore/events';
import { subscribeToEntries } from '@/lib/firestore/entries';
import { subscribeToSpeakerMessages, addSpeakerMessage, type SpeakerMessage } from '@/lib/firestore/speaker';

interface EventData {
    eventId: string;
    entries: Entry[];
    classes: any[];
    eventName: string;
}

export default function SpeakerPage() {
    const params = useParams();
    const eventId = params.eventId as string;

    const [event, setEvent] = useState<FirestoreEvent | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [speakerMessages, setSpeakerMessages] = useState<SpeakerMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [view, setView] = useState<'events' | 'class' | 'missing' | 'input' | 'feed'>('events');
    const [selectedClass, setSelectedClass] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedFeedClasses, setSelectedFeedClasses] = useState<string[]>([]);
    const [newComment, setNewComment] = useState('');
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        setLoading(true);

        // 1. Get Event Metadata
        getEvent(eventId).then(evt => {
            if (evt) {
                setEvent(evt);
                if (!selectedClass && evt.classes && evt.classes.length > 0) {
                    setSelectedClass(evt.classes[0].id);
                }
            }
            setLoading(false);
        });

        // 2. Subscribe to Entries
        const unsubscribeEntries = subscribeToEntries(eventId, (updatedEntries) => {
            setEntries(updatedEntries);
        });

        // 3. Subscribe to Speaker Messages
        const unsubscribeMessages = subscribeToSpeakerMessages(eventId, (messages) => {
            setSpeakerMessages(messages);
        });

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            unsubscribeEntries();
            unsubscribeMessages();
            clearInterval(interval);
        };
    }, [eventId]);

    const data = event ? {
        eventId,
        entries,
        classes: event.classes || [],
        eventName: event.name,
    } : null;

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


    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        setPublishing(true);

        try {
            await addSpeakerMessage(eventId, newComment, 'info', 'Speaker');
            setNewComment('');
        } catch (error) {
            console.error('Error adding message:', error);
        } finally {
            setPublishing(false);
        }
    };

    const handleDeleteComment = (id: string) => {
        // We might want to implement deleteSpeakerMessage later
        console.log('Delete message:', id);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-32">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <Link href={`/admin/events/${eventId}`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors">
                                ← Tillbaka
                            </Link>
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    <span className="text-emerald-500 animate-pulse">🎙️</span> Speaker Mode
                                </h1>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                                    {data.eventName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                LIVE
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* View Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { id: 'events', label: '🏃 Målgångar' },
                        { id: 'feed', label: '📡 Händelseström' },
                        { id: 'class', label: '🏆 Resultat' },
                        { id: 'missing', label: '🌲 Skogen' },
                        { id: 'input', label: '⏱️ Inmatning' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id as any)}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === tab.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-8 space-y-8">
                        {view === 'events' && (
                            <div className="space-y-4">
                                {recentFinishes.length === 0 ? (
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-24 text-center shadow-2xl">
                                        <div className="text-7xl mb-8 opacity-10">⏳</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Väntar på målgångar...</p>
                                    </div>
                                ) : (
                                    recentFinishes
                                        .filter(e => !showFavoritesOnly || favorites.has(e.id))
                                        .map((entry, index) => (
                                            <div
                                                key={entry.id}
                                                className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group ${index === 0 ? 'ring-2 ring-emerald-500/50' : ''}`}
                                            >
                                                {index === 0 && <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-lg">Senast</div>}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => toggleFavorite(entry.id)}
                                                            className={`text-xl transition-all hover:scale-110 ${favorites.has(entry.id) ? 'grayscale-0' : 'grayscale opacity-20'}`}
                                                        >
                                                            ⭐
                                                        </button>
                                                        <div>
                                                            <div className="text-lg font-black uppercase tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                                                                {entry.firstName} {entry.lastName}
                                                            </div>
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                {entry.clubName} · {getClassName(entry.classId)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-mono font-black text-emerald-400">
                                                            {formatTime(entry.totalTime)}
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                            {entry.finishTime && new Date(entry.finishTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        )}

                        {view === 'class' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                                <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                                    <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {getClassName(selectedClass)} - Rekommenderad analys
                                    </h2>
                                    <div className="flex gap-2">
                                        {data.classes.map((cls: any) => (
                                            <button
                                                key={cls.id}
                                                onClick={() => setSelectedClass(cls.id)}
                                                className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${selectedClass === cls.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                            >
                                                {cls.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-800/50">
                                    {classResults.slice(0, 15).map((entry, index) => (
                                        <div key={entry.id} className="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                            <div className="flex items-center gap-6">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-yellow-500 text-yellow-950' : index === 1 ? 'bg-slate-400 text-slate-950' : index === 2 ? 'bg-orange-500 text-orange-950' : 'bg-slate-800 text-slate-500'}`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-black uppercase tracking-tight text-white">{entry.firstName} {entry.lastName}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.clubName}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-mono font-black text-white">{formatTime(entry.totalTime)}</div>
                                                {index > 0 && <div className="text-[10px] font-mono font-black text-slate-600">+{formatTime(entry.totalTime - classResults[0].totalTime)}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'missing' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {missingRunners.length === 0 ? (
                                    <div className="col-span-full bg-slate-900 border border-slate-800 rounded-3xl p-24 text-center shadow-2xl">
                                        <div className="text-7xl mb-8 opacity-10">🌲</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Alla deltagare ute i skogen har kommit i mål!</p>
                                    </div>
                                ) : (
                                    missingRunners.map(entry => (
                                        <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="font-black uppercase tracking-tight text-white">{entry.firstName} {entry.lastName}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.clubName}</div>
                                                </div>
                                                <div className="text-xl font-mono font-black text-emerald-500">{formatTime(entry.elapsed)}</div>
                                            </div>
                                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '60%' }}></div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {view === 'input' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                                <PunchInput
                                    entries={data.entries}
                                    controls={[
                                        { code: '31', name: 'Start' },
                                        { code: '32' },
                                        { code: '33' },
                                        { code: '34' },
                                        { code: '35' },
                                        { code: '100', name: 'Mål' },
                                    ]}
                                    onPunch={(entryId, code, time) => {
                                        // Simple log for now, actual implementation should call a service
                                        console.log('Punch:', entryId, code, time);
                                    }}
                                />
                            </div>
                        )}

                        {view === 'feed' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[600px]">
                                <EventFeed
                                    events={resultsToEvents(data.entries)}
                                    classes={data.classes}
                                    selectedClasses={selectedFeedClasses}
                                    onClassToggle={(id) => setSelectedFeedClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Column: Speaker Comments */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                                <span className="text-white text-base">🎙️</span> Speaker Kommentar
                            </h2>
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Publicera en uppdatering..."
                                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-700 resize-none"
                            />
                            <button
                                onClick={handlePostComment}
                                disabled={publishing || !newComment.trim()}
                                className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-900/40"
                            >
                                {publishing ? 'Publicerar...' : 'Sänd ut'}
                            </button>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-slate-800">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Senaste sändningar</h3>
                            </div>
                            <div className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
                                {speakerMessages.map(comment => (
                                    <div key={comment.id} className="p-4 group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono font-black text-slate-600">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <button onClick={() => handleDeleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all text-xs">🗑️</button>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed font-medium">{comment.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Stats Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex gap-12">
                        <div className="text-center">
                            <div className="text-xl font-black text-white">{data.entries.length}</div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Deltagare</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-emerald-500">{data.entries.filter(e => e.status === 'finished').length}</div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">I Mål</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-orange-500">{missingRunners.length}</div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Ute</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-mono font-black text-white">{currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-emerald-500 animate-pulse">Live Sync Active</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
