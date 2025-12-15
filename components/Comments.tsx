'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import type { Comment } from '@/types/social';

interface CommentsProps {
    resourceType: 'event' | 'training' | 'track';
    resourceId: string;
    showQA?: boolean; // Show as Q&A section
}

export default function Comments({ resourceType, resourceId, showQA = false }: CommentsProps) {
    const { user } = useUserWithRoles();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isQuestion, setIsQuestion] = useState(false);
    const [replyTo, setReplyTo] = useState<string | null>(null);

    useEffect(() => {
        // Load comments from localStorage (in production, from Firestore)
        const key = `comments-${resourceType}-${resourceId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            setComments(JSON.parse(stored));
        }
    }, [resourceType, resourceId]);

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        if (!user) {
            alert('Du måste logga in för att kommentera');
            return;
        }

        const comment: Comment = {
            id: `comment-${Date.now()}`,
            resourceType,
            resourceId,
            userId: user.id,
            userName: user.displayName,
            userPhoto: user.photoURL,
            text: newComment,
            createdAt: new Date(),
            likes: [],
            replies: [],
            isQuestion: showQA && isQuestion,
            isAnswered: false,
        };

        let updatedComments: Comment[];
        if (replyTo) {
            // Add as reply
            updatedComments = comments.map(c =>
                c.id === replyTo
                    ? { ...c, replies: [...c.replies, comment] }
                    : c
            );
        } else {
            updatedComments = [comment, ...comments];
        }

        setComments(updatedComments);
        localStorage.setItem(`comments-${resourceType}-${resourceId}`, JSON.stringify(updatedComments));
        setNewComment('');
        setReplyTo(null);
        setIsQuestion(false);
    };

    const handleLike = (commentId: string) => {
        if (!user) return;

        const updatedComments = comments.map(c => {
            if (c.id === commentId) {
                const likes = c.likes.includes(user.id)
                    ? c.likes.filter(id => id !== user.id)
                    : [...c.likes, user.id];
                return { ...c, likes };
            }
            return c;
        });

        setComments(updatedComments);
        localStorage.setItem(`comments-${resourceType}-${resourceId}`, JSON.stringify(updatedComments));
    };

    const formatTime = (date: Date) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just nu';
        if (diffMins < 60) return `${diffMins} min sedan`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} tim sedan`;
        return d.toLocaleDateString('sv-SE');
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {showQA ? '❓ Frågor & Svar' : '💬 Kommentarer'}
            </h3>

            {/* New Comment */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {replyTo && (
                    <div className="mb-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <span>Svarar på kommentar</span>
                        <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                )}
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={showQA ? 'Ställ en fråga eller skriv en kommentar...' : 'Skriv en kommentar...'}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:text-white resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                    {showQA && (
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <input
                                type="checkbox"
                                checked={isQuestion}
                                onChange={(e) => setIsQuestion(e.target.checked)}
                                className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                            />
                            Detta är en fråga
                        </label>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!newComment.trim() || !user}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                        {showQA && isQuestion ? 'Ställ fråga' : 'Kommentera'}
                    </button>
                </div>
                {!user && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <a href="/login" className="text-emerald-600 hover:underline">Logga in</a> för att kommentera
                    </p>
                )}
            </div>

            {/* Comments List */}
            <div className="space-y-4">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {showQA ? 'Inga frågor ännu. Var först att ställa en!' : 'Inga kommentarer ännu'}
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow ${comment.isQuestion ? 'border-l-4 border-yellow-500' : ''
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                    {comment.userPhoto ? (
                                        <img src={comment.userPhoto} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {comment.userName.charAt(0)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                                            {comment.userName}
                                        </span>
                                        {comment.isQuestion && (
                                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                                                Fråga
                                            </span>
                                        )}
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatTime(comment.createdAt)}
                                        </span>
                                    </div>

                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {comment.text}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-4 mt-2">
                                        <button
                                            onClick={() => handleLike(comment.id)}
                                            className={`text-sm flex items-center gap-1 ${user && comment.likes.includes(user.id)
                                                    ? 'text-red-500'
                                                    : 'text-gray-500 hover:text-red-500'
                                                }`}
                                        >
                                            ❤️ {comment.likes.length > 0 && comment.likes.length}
                                        </button>
                                        <button
                                            onClick={() => setReplyTo(comment.id)}
                                            className="text-sm text-gray-500 hover:text-emerald-600"
                                        >
                                            Svara
                                        </button>
                                    </div>

                                    {/* Replies */}
                                    {comment.replies.length > 0 && (
                                        <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-3">
                                            {comment.replies.map((reply) => (
                                                <div key={reply.id} className="flex items-start gap-2">
                                                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm">
                                                        {reply.userName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                                                                {reply.userName}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {formatTime(reply.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                                            {reply.text}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
