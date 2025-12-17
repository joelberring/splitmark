'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getEvent, type FirestoreEvent } from '@/lib/firestore/events';
import { addSpeakerMessage, subscribeToSpeakerMessages, type SpeakerMessage } from '@/lib/firestore/speaker';

export default function SpeakerPage() {
    const params = useParams();
    const eventId = params.id as string;
    const [event, setEvent] = useState<FirestoreEvent | null>(null);
    const [messages, setMessages] = useState<SpeakerMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [messageType, setMessageType] = useState<'info' | 'highlight' | 'warning'>('info');

    useEffect(() => {
        // Load event details
        getEvent(eventId).then(setEvent);

        // Subscribe to messages
        const unsubscribe = subscribeToSpeakerMessages(eventId, setMessages);
        return () => unsubscribe();
    }, [eventId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await addSpeakerMessage(eventId, newMessage, messageType);
        setNewMessage('');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Control Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <header className="flex items-center justify-between">
                        <div>
                            <Link href={`/admin/events/${eventId}`} className="text-slate-500 hover:text-white text-sm">← Tillbaka till Event</Link>
                            <h1 className="text-2xl font-bold mt-1">🎤 Speaker: {event?.name || 'Laddar...'}</h1>
                        </div>
                        <div className="px-3 py-1 bg-red-900/30 border border-red-800 rounded-full flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
                        </div>
                    </header>

                    {/* Input Area */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <form onSubmit={handleSend}>
                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setMessageType('info')}
                                    className={`flex-1 py-2 rounded font-bold text-sm transition-colors ${messageType === 'info' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Info
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMessageType('highlight')}
                                    className={`flex-1 py-2 rounded font-bold text-sm transition-colors ${messageType === 'highlight' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Highlight
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMessageType('warning')}
                                    className={`flex-1 py-2 rounded font-bold text-sm transition-colors ${messageType === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Varning
                                </button>
                            </div>

                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Skriv ett meddelande till publiken..."
                                className="w-full bg-black/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors h-32 resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                            />

                            <div className="flex justify-between items-center mt-3">
                                <p className="text-xs text-slate-500">Tryck Enter för att skicka</p>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Sänd Meddelande
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Quick Updates / Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Senaste Passertid</h3>
                            <div className="text-xl font-mono font-bold">12:43:05</div>
                            <div className="text-emerald-400 text-sm">Anna Andersson (D21)</div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Antal i Mål</h3>
                            <div className="text-xl font-mono font-bold">142 / 380</div>
                            <div className="text-slate-500 text-sm">37% av fältet</div>
                        </div>
                    </div>
                </div>

                {/* Feed Preview */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[calc(100vh-3rem)] sticky top-6">
                    <div className="p-4 border-b border-slate-800">
                        <h2 className="font-bold text-white">Live-flöde</h2>
                        <p className="text-xs text-slate-500">Detta ser publiken just nu</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center py-10 opacity-30">
                                Inga meddelanden än...
                            </div>
                        ) : (
                            messages.map(msg => (
                                <div key={msg.id} className={`p-3 rounded-lg border animate-in slide-in-from-top-2 duration-300 ${msg.type === 'highlight' ? 'bg-emerald-900/20 border-emerald-800/50' :
                                        msg.type === 'warning' ? 'bg-amber-900/20 border-amber-800/50' :
                                            'bg-slate-800/50 border-slate-700/50'
                                    }`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${msg.type === 'highlight' ? 'bg-emerald-500/20 text-emerald-400' :
                                                msg.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-700 text-slate-400'
                                            }`}>
                                            {msg.type}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {msg.timestamp?.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm">{msg.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
