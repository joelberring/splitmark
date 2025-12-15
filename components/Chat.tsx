'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import type { ChatMessage } from '@/types/social';

interface ChatProps {
    roomId: string;
    roomName: string;
    roomType: 'event' | 'team' | 'club';
}

export default function Chat({ roomId, roomName, roomType }: ChatProps) {
    const { user } = useUserWithRoles();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load messages
    useEffect(() => {
        const key = `chat-${roomId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            setMessages(JSON.parse(stored));
        }

        // Simulating real-time connection
        // In production, use Firestore onSnapshot
        setIsConnected(true);
    }, [roomId]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!newMessage.trim() || !user) return;

        const message: ChatMessage = {
            id: `msg-${Date.now()}`,
            roomId,
            userId: user.id,
            userName: user.displayName,
            userPhoto: user.photoURL,
            text: newMessage,
            timestamp: new Date(),
            type: 'message',
        };

        const updatedMessages = [...messages, message];
        setMessages(updatedMessages);
        localStorage.setItem(`chat-${roomId}`, JSON.stringify(updatedMessages));
        setNewMessage('');

        // In production, send to Firestore
        // sendChatMessage(message);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Idag';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Igår';
        return d.toLocaleDateString('sv-SE');
    };

    // Group messages by date
    const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
    messages.forEach((msg) => {
        const date = formatDate(msg.timestamp);
        const lastGroup = groupedMessages[groupedMessages.length - 1];
        if (lastGroup && lastGroup.date === date) {
            lastGroup.messages.push(msg);
        } else {
            groupedMessages.push({ date, messages: [msg] });
        }
    });

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">
                        {roomType === 'event' ? '📅' : roomType === 'team' ? '👥' : '🏠'}
                    </span>
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                            {roomName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {messages.length} meddelanden
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-500">{isConnected ? 'Ansluten' : 'Frånkopplad'}</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <span className="text-4xl block mb-2">💬</span>
                        Inga meddelanden ännu. Starta konversationen!
                    </div>
                ) : (
                    groupedMessages.map((group, gi) => (
                        <div key={gi}>
                            {/* Date separator */}
                            <div className="flex items-center gap-4 my-4">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {group.date}
                                </span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                            </div>

                            {group.messages.map((msg, mi) => {
                                const isOwn = msg.userId === user?.id;
                                const showAvatar = mi === 0 || group.messages[mi - 1]?.userId !== msg.userId;

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'
                                            }`}
                                    >
                                        {/* Avatar */}
                                        {showAvatar && !isOwn && (
                                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                                {msg.userPhoto ? (
                                                    <img src={msg.userPhoto} alt="" className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                        {msg.userName.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {!showAvatar && !isOwn && <div className="w-8"></div>}

                                        {/* Message bubble */}
                                        <div
                                            className={`max-w-[70%] ${isOwn
                                                    ? 'bg-emerald-500 text-white rounded-2xl rounded-br-md'
                                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-md shadow'
                                                } px-4 py-2`}
                                        >
                                            {showAvatar && !isOwn && (
                                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                                                    {msg.userName}
                                                </p>
                                            )}
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                            <p
                                                className={`text-xs mt-1 ${isOwn ? 'text-emerald-100' : 'text-gray-400'
                                                    }`}
                                            >
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4">
                {!user ? (
                    <div className="text-center py-2 text-gray-500 dark:text-gray-400">
                        <a href="/login" className="text-emerald-600 hover:underline">Logga in</a>{' '}
                        för att chatta
                    </div>
                ) : (
                    <div className="flex items-end gap-2">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Skriv ett meddelande..."
                            rows={1}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white resize-none"
                            style={{ maxHeight: '120px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
