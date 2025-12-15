'use client';

import { useState, useEffect } from 'react';
import type { EventData } from './shared';

interface SpeakerComment {
    id: string;
    text: string;
    timestamp: Date;
    highlight: boolean;
}

interface SpeakerTabProps {
    event: EventData;
}

export default function SpeakerTab({ event }: SpeakerTabProps) {
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [comments, setComments] = useState<SpeakerComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isHighlight, setIsHighlight] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [recentFinishes, setRecentFinishes] = useState<any[]>([]);

    // Mock recent finishes
    useEffect(() => {
        const mockFinishes = [
            { id: '1', name: 'Gustav Lindgren', className: 'H21', time: '27:30', position: 1, isNew: true },
            { id: '2', name: 'Sofia Nordin', className: 'D21', time: '29:15', position: 1, isNew: true },
            { id: '3', name: 'Erik Johansson', className: 'H21', time: '28:45', position: 2, isNew: false },
        ];
        setRecentFinishes(mockFinishes);

        // Select all classes by default
        if (event.classes) {
            setSelectedClasses(event.classes.map(c => c.id));
        }
    }, [event]);

    const toggleClass = (classId: string) => {
        setSelectedClasses(prev =>
            prev.includes(classId)
                ? prev.filter(c => c !== classId)
                : [...prev, classId]
        );
    };

    const sendComment = () => {
        if (!newComment.trim()) return;

        const comment: SpeakerComment = {
            id: Date.now().toString(),
            text: newComment,
            timestamp: new Date(),
            highlight: isHighlight,
        };

        setComments(prev => [comment, ...prev]);
        setNewComment('');
        setIsHighlight(false);

        // In production: Send to broadcast server
        console.log('Broadcasting comment:', comment);
    };

    const startBroadcast = () => {
        setIsBroadcasting(true);
        // In production: Initialize WebSocket/Firebase connection
    };

    const stopBroadcast = () => {
        setIsBroadcasting(false);
        // In production: Close broadcast connection
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Class filter & Status */}
            <div className="space-y-6">
                {/* Broadcast Status */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm flex items-center gap-2">
                        🎙️ Speaker-läge
                    </h3>

                    {isBroadcasting ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-red-900/30 rounded border border-red-800/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                                    <span className="text-red-400 font-bold uppercase text-sm">SÄNDER LIVE</span>
                                </div>
                            </div>
                            <button
                                onClick={stopBroadcast}
                                className="w-full py-3 bg-red-600 text-white rounded font-bold uppercase tracking-widest hover:bg-red-500"
                            >
                                ⏹️ Stoppa sändning
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={startBroadcast}
                            className="w-full py-3 bg-emerald-600 text-white rounded font-bold uppercase tracking-widest hover:bg-emerald-500"
                        >
                            ▶️ Starta sändning
                        </button>
                    )}
                </div>

                {/* Class Filter */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">
                        📋 Klasser att följa
                    </h3>
                    <div className="space-y-2">
                        {event.classes?.map(cls => (
                            <label
                                key={cls.id}
                                className="flex items-center gap-3 p-2 rounded hover:bg-slate-800/50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedClasses.includes(cls.id)}
                                    onChange={() => toggleClass(cls.id)}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
                                />
                                <span className="text-white font-bold">{cls.name}</span>
                                <span className="text-slate-500 text-xs">({cls.entryCount || 0})</span>
                            </label>
                        ))}
                        {(!event.classes || event.classes.length === 0) && (
                            <p className="text-slate-500 text-sm">Inga klasser skapade</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Center: Comment input & Recent finishes */}
            <div className="space-y-6">
                {/* Comment Input */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">
                        💬 Skicka kommentar
                    </h3>
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Skriv en kommentar som visas för åskådarna..."
                        className="w-full h-24 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none"
                    />
                    <div className="flex items-center justify-between mt-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isHighlight}
                                onChange={(e) => setIsHighlight(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500"
                            />
                            <span className="text-purple-400 text-sm font-bold">⭐ Markera som highlight</span>
                        </label>
                        <button
                            onClick={sendComment}
                            disabled={!newComment.trim() || !isBroadcasting}
                            className="px-6 py-2 bg-emerald-600 text-white rounded font-bold uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Skicka
                        </button>
                    </div>
                </div>

                {/* Recent Finishes */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm flex items-center gap-2">
                        🏁 Senaste målgångar
                        {recentFinishes.some(f => f.isNew) && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        )}
                    </h3>
                    <div className="space-y-2">
                        {recentFinishes.map(finish => (
                            <div
                                key={finish.id}
                                className={`p-3 rounded-lg ${finish.isNew
                                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                                        : 'bg-slate-800/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-white">{finish.name}</span>
                                        <span className="text-slate-400 ml-2 text-sm">{finish.className}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-mono text-emerald-400 font-bold">{finish.time}</span>
                                        <span className="text-slate-500 text-xs ml-2">#{finish.position}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recentFinishes.length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">Inga målgångar ännu</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Comment history */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 h-fit">
                <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">
                    📜 Skickade kommentarer
                </h3>
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <div className="text-3xl mb-2 opacity-30">🎙️</div>
                        <p className="text-xs">Inga kommentarer skickade</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {comments.map(comment => (
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
                                <div className="text-[10px] text-slate-600 mt-1">
                                    {formatTime(comment.timestamp)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
