'use client';

import Link from 'next/link';
import type { EventFeedItem } from '@/types/discover';

interface EventCardProps {
    event: EventFeedItem;
    variant?: 'grid' | 'featured';
    onLike?: (eventId: string) => void;
    onSave?: (eventId: string) => void;
}

export default function EventCard({
    event,
    variant = 'grid',
    onLike,
    onSave,
}: EventCardProps) {
    const isFeatured = variant === 'featured';

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('sv-SE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    const getTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            sprint: 'Sprint',
            medel: 'Medeldistans',
            lång: 'Långdistans',
            ultra: 'Ultralång',
            natt: 'Natt',
            stafett: 'Stafett',
            träning: 'Träning',
            ol: 'Orienteringslöpning',
        };
        return labels[type] || type;
    };

    const getTypeColor = (type: string): string => {
        const colors: Record<string, string> = {
            sprint: 'bg-orange-500',
            medel: 'bg-emerald-500',
            lång: 'bg-blue-500',
            ultra: 'bg-purple-500',
            natt: 'bg-indigo-900',
            stafett: 'bg-pink-500',
            träning: 'bg-gray-500',
            ol: 'bg-teal-500',
        };
        return colors[type] || 'bg-gray-500';
    };

    return (
        <article
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${isFeatured ? 'md:col-span-2' : ''
                }`}
        >
            {/* Hero Image */}
            <div className={`relative ${isFeatured ? 'aspect-[21/9]' : 'aspect-[4/3]'}`}>
                {event.heroImage ? (
                    <img
                        src={event.heroImage}
                        alt={event.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                        <span className="text-6xl">🧭</span>
                    </div>
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Type badge */}
                <div className={`absolute top-3 left-3 ${getTypeColor(event.type)} text-white text-xs font-bold px-2 py-1 rounded-full`}>
                    {getTypeLabel(event.type)}
                </div>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-2">
                    <button
                        onClick={(e) => { e.preventDefault(); onLike?.(event.id); }}
                        className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors ${event.isLiked
                                ? 'bg-red-500 text-white'
                                : 'bg-black/30 text-white hover:bg-black/50'
                            }`}
                    >
                        ❤️
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); onSave?.(event.id); }}
                        className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors ${event.isSaved
                                ? 'bg-yellow-500 text-white'
                                : 'bg-black/30 text-white hover:bg-black/50'
                            }`}
                    >
                        ⭐
                    </button>
                </div>

                {/* Social proof on image */}
                <div className="absolute bottom-3 left-3 flex items-center gap-3 text-white text-sm">
                    <span className="flex items-center gap-1 backdrop-blur-sm bg-black/30 px-2 py-1 rounded-full">
                        ❤️ {event.social.likes}
                    </span>
                    <span className="flex items-center gap-1 backdrop-blur-sm bg-black/30 px-2 py-1 rounded-full">
                        💬 {event.social.comments}
                    </span>
                </div>

                {/* Featured badge */}
                {event.isFeatured && (
                    <div className="absolute bottom-3 right-3 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                        ⭐ Utvalt event
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Title */}
                <h3 className={`font-bold text-gray-800 dark:text-gray-100 mb-2 ${isFeatured ? 'text-xl' : 'text-lg'
                    }`}>
                    {event.name}
                </h3>

                {/* Location & Date */}
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span className="truncate">
                            {event.location.name}, {event.location.municipality}
                        </span>
                        {event.location.distanceFromUser && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {Math.round(event.location.distanceFromUser)} km
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span>📅</span>
                        <span>{formatDate(event.date)}</span>
                        {event.time && <span>kl {event.time}</span>}
                    </div>
                </div>

                {/* Stats chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
                        👥 {event.entryCount} anmälda
                    </span>
                    {event.courseLength && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
                            🗺️ {event.courseLength} km
                        </span>
                    )}
                    {event.clubMatesGoingCount && event.clubMatesGoingCount > 0 && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full">
                            🏃 {event.clubMatesGoingCount} från din klubb
                        </span>
                    )}
                </div>

                {/* Organiser */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {event.organiser.name}
                </div>

                {/* CTA */}
                <div className="flex gap-2">
                    <Link
                        href={`/events/${event.id}`}
                        className="flex-1 py-2 text-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Läs mer
                    </Link>
                    {event.registrationOpen ? (
                        <Link
                            href={event.registrationUrl || `/events/${event.id}/register`}
                            className="flex-1 py-2 text-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all"
                        >
                            Anmäl →
                        </Link>
                    ) : (
                        <span className="flex-1 py-2 text-center bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg font-semibold cursor-not-allowed">
                            {event.registrationDeadline ? 'Stängt' : 'Öppnar snart'}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
