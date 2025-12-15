'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { findClubById, type Club } from '@/types/clubs';

interface ClubPost {
    id: string;
    type: 'announcement' | 'training' | 'event' | 'chat';
    author: string;
    content: string;
    timestamp: string;
    likes: number;
}

interface ChatMessage {
    id: string;
    author: string;
    content: string;
    timestamp: string;
}

export default function ClubPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const [club, setClub] = useState<Club | null>(null);
    const [activeTab, setActiveTab] = useState<'feed' | 'trainings' | 'live' | 'events' | 'chat' | 'info'>('feed');
    const [posts, setPosts] = useState<ClubPost[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const foundClub = findClubById(clubId);
        setClub(foundClub || null);

        const storedPosts = localStorage.getItem(`club-${clubId}-posts`);
        if (storedPosts) {
            setPosts(JSON.parse(storedPosts));
        } else {
            setPosts([
                { id: '1', type: 'announcement', author: 'Styrelsen', content: 'Välkommen till klubbens sida i Splitmark!', timestamp: new Date().toISOString(), likes: 5 },
                { id: '2', type: 'training', author: 'Träningsansvarig', content: 'Onsdagsträning denna vecka: Intervaller i Grimsta. Samling 18:00.', timestamp: new Date(Date.now() - 86400000).toISOString(), likes: 3 },
            ]);
        }

        const storedChat = localStorage.getItem(`club-${clubId}-chat`);
        if (storedChat) setChatMessages(JSON.parse(storedChat));
        setLoading(false);
    }, [clubId]);

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        const message: ChatMessage = { id: Date.now().toString(), author: 'Du', content: newMessage, timestamp: new Date().toISOString() };
        const updated = [...chatMessages, message];
        setChatMessages(updated);
        localStorage.setItem(`club-${clubId}-chat`, JSON.stringify(updated));
        setNewMessage('');
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="text-6xl mb-4 opacity-30">🏠</div>
                    <h1 className="text-xl font-bold text-white mb-2">Klubb hittades inte</h1>
                    <Link href="/profile" className="text-emerald-400 hover:underline">Välj din klubb i profilen →</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-24">
            {/* Club Header */}
            <header className="bg-gradient-to-b from-emerald-900/50 to-slate-900 border-b border-slate-800 px-4 py-6">
                <Link href="/" className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-4 inline-block">
                    ← Tillbaka
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-emerald-900/50 border border-emerald-700/50 rounded-xl flex items-center justify-center text-3xl">🏠</div>
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tight">{club.name}</h1>
                        <p className="text-emerald-400 text-sm">{club.districtName}</p>
                        {club.location && <p className="text-slate-500 text-xs">📍 {club.location}</p>}
                    </div>
                </div>

                {/* Tabs */}
                <nav className="flex gap-1 mt-4 -mb-6 overflow-x-auto">
                    {[
                        { id: 'feed', label: '📰 Flöde' },
                        { id: 'trainings', label: '🏃 Träning' },
                        { id: 'live', label: '📍 Live' },
                        { id: 'events', label: '🏆 Tävlingar' },
                        { id: 'chat', label: '💬 Chatt' },
                        { id: 'info', label: 'ℹ️ Info' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-colors ${activeTab === tab.id
                                ? 'bg-slate-900 text-emerald-400 border-t border-l border-r border-slate-700'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Content */}
            <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
                {/* Feed Tab */}
                {activeTab === 'feed' && (
                    <div className="space-y-3">
                        {posts.map(post => (
                            <div key={post.id} className="bg-slate-900 rounded-xl p-4 border-l-4 border-emerald-500">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${post.type === 'announcement' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/50' :
                                        post.type === 'training' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50' :
                                            'bg-purple-900/30 text-purple-400 border border-purple-800/50'
                                        }`}>
                                        {post.type === 'announcement' ? '📢 Nyhet' : post.type === 'training' ? '🏃 Träning' : '🏆 Tävling'}
                                    </span>
                                    <span className="text-xs text-slate-500">{post.author}</span>
                                </div>
                                <p className="text-slate-300">{post.content}</p>
                                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                    <span>{new Date(post.timestamp).toLocaleDateString('sv-SE')}</span>
                                    <button className="flex items-center gap-1 hover:text-red-400">❤️ {post.likes}</button>
                                </div>
                            </div>
                        ))}
                        {posts.length === 0 && (
                            <div className="text-center py-12 text-slate-500 uppercase tracking-wide text-sm font-bold">Inga inlägg än</div>
                        )}
                    </div>
                )}

                {/* Trainings Tab */}
                {activeTab === 'trainings' && (
                    <div className="space-y-4">
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">🏃 Kommande träningar</h3>
                            <div className="space-y-2">
                                <div className="p-3 bg-emerald-950/30 rounded-lg border border-emerald-900/50">
                                    <div className="font-bold text-emerald-400">Onsdagsträning</div>
                                    <div className="text-xs text-slate-400">Onsdag 18:00 • Intervaller</div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <div className="font-bold text-slate-300">Lördagsträning</div>
                                    <div className="text-xs text-slate-500">Lördag 10:00 • Långpass</div>
                                </div>
                            </div>
                        </div>
                        <Link href="/training" className="block bg-purple-600 text-white rounded-xl p-4 text-center font-bold uppercase tracking-widest hover:bg-purple-500 transition-colors">
                            📊 Öppna Träningsloggen
                        </Link>
                    </div>
                )}

                {/* Events Tab */}
                {activeTab === 'events' && (
                    <div className="space-y-4">
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="font-bold text-white mb-2 uppercase tracking-wide text-sm">🏆 Klubbens tävlingar</h3>
                            <p className="text-slate-500 text-sm">Tävlingar där {club.name} arrangerar eller deltar.</p>
                        </div>
                        <Link href="/events" className="block bg-emerald-600 text-white rounded-xl p-4 text-center font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                            📅 Se alla tävlingar
                        </Link>
                    </div>
                )}

                {/* Live Tracking Tab */}
                {activeTab === 'live' && (
                    <div className="space-y-4">
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                Pågående aktiviteter
                            </h3>
                            <div className="space-y-2">
                                <div className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-emerald-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">Onsdagsträning</div>
                                            <div className="text-xs text-slate-400">Lunsen, Uppsala</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-white">8</span>
                                            <span className="text-xs text-slate-500">aktiva</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Link href={`/club/${clubId}/live`} className="flex-1 text-center py-2 bg-emerald-600 text-white rounded text-xs font-bold uppercase tracking-wider hover:bg-emerald-500">
                                            📍 Följ live
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">Starta livetracking</h3>
                            <p className="text-slate-500 text-sm mb-4">Aktivera GPS på din enhet för att dela din position under träning.</p>
                            <button className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                                🏃 Starta träning med live
                            </button>
                        </div>
                    </div>
                )}

                {/* Chat Tab */}
                {activeTab === 'chat' && (
                    <div className="flex flex-col h-[60vh]">
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {chatMessages.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <div className="text-4xl mb-2 opacity-30">💬</div>
                                    <p className="uppercase tracking-wide text-sm font-bold">Inga meddelanden än</p>
                                </div>
                            ) : (
                                chatMessages.map(msg => (
                                    <div key={msg.id} className={`p-3 rounded-lg ${msg.author === 'Du' ? 'bg-emerald-600 text-white ml-8' : 'bg-slate-800 mr-8'
                                        }`}>
                                        <div className="flex items-center justify-between text-xs mb-1 opacity-70">
                                            <span className="font-bold">{msg.author}</span>
                                            <span>{new Date(msg.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p>{msg.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Skriv ett meddelande..."
                                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                            />
                            <button
                                onClick={handleSendMessage}
                                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500"
                            >
                                Skicka
                            </button>
                        </div>
                    </div>
                )}

                {/* Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-4">
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <h3 className="font-bold text-white mb-3 uppercase tracking-wide text-sm">Om {club.name}</h3>
                            <div className="space-y-2 text-slate-400 text-sm">
                                <p>📍 <strong className="text-slate-300">Plats:</strong> {club.location || 'Ej angiven'}</p>
                                <p>🏛️ <strong className="text-slate-300">Distrikt:</strong> {club.districtName}</p>
                                {club.website && (
                                    <p>🌐 <strong className="text-slate-300">Hemsida:</strong> <a href={club.website} className="text-emerald-400 hover:underline">{club.website}</a></p>
                                )}
                            </div>
                        </div>
                        <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4">
                            <h4 className="font-bold text-blue-400 mb-2 uppercase tracking-wide text-xs">📫 Kontakt</h4>
                            <p className="text-xs text-blue-300/70">Kontaktuppgifter läggs till av klubbens administratörer.</p>
                        </div>
                    </div>
                )}
            </main>

            <BottomNavigation />
        </div>
    );
}
