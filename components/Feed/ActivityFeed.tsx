'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export interface Activity {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    eventName: string;
    eventId: string;
    courseName: string;
    date: Date;
    duration: number; // seconds
    distance: number; // meters
    resultStatus: 'ok' | 'mp' | 'dnf';
    position?: number;
    totalInClass?: number;
    className?: string;
    mapPreviewUrl?: string;
    kudos: number;
    comments: number;
    hasKudoed?: boolean;
}

interface ActivityFeedProps {
    activities: Activity[];
    filter: 'all' | 'friends' | 'mine';
    onFilterChange: (filter: 'all' | 'friends' | 'mine') => void;
    onKudos: (activityId: string) => void;
    currentUserId?: string;
}

export default function ActivityFeed({
    activities,
    filter,
    onFilterChange,
    onKudos,
    currentUserId,
}: ActivityFeedProps) {
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDistance = (meters: number): string => {
        return (meters / 1000).toFixed(1) + ' km';
    };

    const formatDate = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Just nu';
        if (hours < 24) return `${hours}h sedan`;
        if (days < 7) return `${days}d sedan`;
        return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    };

    const filteredActivities = activities.filter(a => {
        if (filter === 'mine') return a.userId === currentUserId;
        if (filter === 'friends') return a.userId !== currentUserId;
        return true;
    });

    return (
        <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex gap-2 px-4">
                {[
                    { id: 'all', label: 'Alla' },
                    { id: 'friends', label: 'Vänner' },
                    { id: 'mine', label: 'Mina' },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => onFilterChange(f.id as typeof filter)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${filter === f.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Activities */}
            {filteredActivities.length === 0 ? (
                <div className="text-center py-12 px-4">
                    <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">
                        Inga aktiviteter att visa
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredActivities.map(activity => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onKudos={onKudos}
                            formatDuration={formatDuration}
                            formatDistance={formatDistance}
                            formatDate={formatDate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ActivityCard({
    activity,
    onKudos,
    formatDuration,
    formatDistance,
    formatDate,
}: {
    activity: Activity;
    onKudos: (id: string) => void;
    formatDuration: (s: number) => string;
    formatDistance: (m: number) => string;
    formatDate: (d: Date) => string;
}) {
    return (
        <div className="bg-slate-900 border-b border-slate-800 mx-4 rounded-lg mb-3 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3">
                {activity.userAvatar ? (
                    <img
                        src={activity.userAvatar}
                        alt={activity.userName}
                        className="w-10 h-10 rounded-full"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold">
                        {activity.userName.charAt(0)}
                    </div>
                )}
                <div className="flex-1">
                    <p className="font-semibold text-white">
                        {activity.userName}
                    </p>
                    <p className="text-xs text-slate-500">
                        {formatDate(activity.date)}
                    </p>
                </div>
            </div>

            {/* Map Preview */}
            {activity.mapPreviewUrl && (
                <Link href={`/tracks/${activity.id}`}>
                    <div className="aspect-video bg-slate-800 relative">
                        <img
                            src={activity.mapPreviewUrl}
                            alt="Karta"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>
            )}

            {/* Content */}
            <div className="px-4 py-3">
                <Link href={activity.eventId === 'ans-2025' ? '/test-event' : `/events/${activity.eventId}`}>
                    <h3 className="font-bold text-white hover:text-emerald-400 transition-colors">
                        {activity.eventName}
                    </h3>
                </Link>
                <p className="text-sm text-slate-400">
                    {activity.courseName}
                    {activity.className && ` · ${activity.className}`}
                </p>

                {/* Stats */}
                <div className="flex gap-6 mt-3 text-sm">
                    <div>
                        <span className="text-slate-500 text-xs uppercase tracking-wider">Tid</span>
                        <p className={`font-semibold font-mono ${activity.resultStatus === 'mp'
                            ? 'text-red-500'
                            : 'text-white'
                            }`}>
                            {activity.resultStatus === 'mp'
                                ? 'Felst.'
                                : activity.resultStatus === 'dnf'
                                    ? 'DNF'
                                    : formatDuration(activity.duration)
                            }
                        </p>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs uppercase tracking-wider">Distans</span>
                        <p className="font-semibold text-white font-mono">
                            {formatDistance(activity.distance)}
                        </p>
                    </div>
                    {activity.position && activity.totalInClass && (
                        <div>
                            <span className="text-slate-500 text-xs uppercase tracking-wider">Placering</span>
                            <p className="font-semibold text-white">
                                <span className={activity.position <= 3 ? 'text-emerald-400' : ''}>{activity.position}</span>/{activity.totalInClass}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-4">
                <button
                    onClick={() => onKudos(activity.id)}
                    className={`flex items-center gap-1.5 text-sm transition-all ${activity.hasKudoed
                        ? 'text-emerald-400 font-semibold'
                        : 'text-slate-500 hover:text-emerald-400'
                        }`}
                >
                    <span className="text-base">{activity.hasKudoed ? '👍' : '👍'}</span>
                    {activity.kudos} kudos
                </button>
                <Link
                    href={`/tracks/${activity.id}`}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                >
                    💬 {activity.comments} kommentarer
                </Link>
            </div>
        </div>
    );
}

// Demo data generator
export function generateDemoActivities(): Activity[] {
    return [
        {
            id: 'act-1',
            userId: 'user-2',
            userName: 'Erik Johansson',
            eventName: 'Bosön Sprint',
            eventId: 'event-1',
            courseName: 'H21',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000),
            duration: 1842,
            distance: 4200,
            resultStatus: 'ok',
            position: 3,
            totalInClass: 24,
            className: 'H21',
            kudos: 12,
            comments: 2,
        },
        {
            id: 'act-2',
            userId: 'user-1',
            userName: 'Anna Svensson',
            eventName: 'Tyresta Medel',
            eventId: 'event-2',
            courseName: 'D21 Lång',
            date: new Date(Date.now() - 24 * 60 * 60 * 1000),
            duration: 3245,
            distance: 7800,
            resultStatus: 'ok',
            position: 1,
            totalInClass: 18,
            className: 'D21',
            kudos: 34,
            comments: 8,
        },
        {
            id: 'act-3',
            userId: 'user-3',
            userName: 'Lisa Karlsson',
            eventName: 'Klubbmästerskap',
            eventId: 'event-3',
            courseName: 'Medel',
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            duration: 2567,
            distance: 5400,
            resultStatus: 'mp',
            kudos: 5,
            comments: 1,
        },
    ];
}
