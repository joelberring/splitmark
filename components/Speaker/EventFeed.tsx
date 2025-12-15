'use client';

import { useState, useEffect, useRef } from 'react';
import type { Entry } from '@/types/entry';

export interface RaceEvent {
    id: string;
    type: 'start' | 'finish' | 'punch' | 'dns' | 'dnf' | 'mp';
    timestamp: Date;
    entry: Entry;
    controlCode?: string;
    runningTime?: number; // ms
    position?: number; // Current position in class
    message?: string;
}

interface EventFeedProps {
    events: RaceEvent[];
    classes: { id: string; name: string }[];
    selectedClasses: string[];
    onClassToggle: (classId: string) => void;
    maxEvents?: number;
}

export default function EventFeed({
    events,
    classes,
    selectedClasses,
    onClassToggle,
    maxEvents = 50
}: EventFeedProps) {
    const [isPaused, setIsPaused] = useState(false);
    const [fontSize, setFontSize] = useState(16);
    const feedRef = useRef<HTMLDivElement>(null);

    // Filter events by selected classes
    const filteredEvents = events
        .filter(e => selectedClasses.length === 0 || selectedClasses.includes(e.entry.classId))
        .slice(0, maxEvents);

    // Auto-scroll when new events arrive (unless paused)
    useEffect(() => {
        if (!isPaused && feedRef.current) {
            feedRef.current.scrollTop = 0;
        }
    }, [events, isPaused]);

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

    const getEventIcon = (type: RaceEvent['type']): string => {
        switch (type) {
            case 'start': return '🏁';
            case 'finish': return '🎯';
            case 'punch': return '📍';
            case 'dns': return '❌';
            case 'dnf': return '🚫';
            case 'mp': return '⚠️';
            default: return '•';
        }
    };

    const getEventColor = (type: RaceEvent['type']): string => {
        switch (type) {
            case 'start': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
            case 'finish': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
            case 'punch': return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
            case 'dns': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            case 'dnf': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
            case 'mp': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            default: return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
        }
    };

    const getEventMessage = (event: RaceEvent): string => {
        switch (event.type) {
            case 'start':
                return 'Startar';
            case 'finish':
                return event.runningTime
                    ? `I mål! ${formatTime(event.runningTime)}`
                    : 'I mål!';
            case 'punch':
                return `Passerar ${event.controlCode}`;
            case 'dns':
                return 'Ej start (DNS)';
            case 'dnf':
                return 'Brutet (DNF)';
            case 'mp':
                return 'Felstämplat (MP)';
            default:
                return event.message || '';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
            {/* Header with controls */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    📡 Händelser
                    {filteredEvents.length > 0 && (
                        <span className="text-sm font-normal text-gray-500">
                            ({filteredEvents.length})
                        </span>
                    )}
                </h2>

                <div className="flex items-center gap-3">
                    {/* Font size controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setFontSize(s => Math.max(12, s - 2))}
                            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            A-
                        </button>
                        <button
                            onClick={() => setFontSize(s => Math.min(24, s + 2))}
                            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            A+
                        </button>
                    </div>

                    {/* Pause button */}
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${isPaused
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            }`}
                    >
                        {isPaused ? '⏸️ Pausad' : '▶️ Live'}
                    </button>
                </div>
            </div>

            {/* Class filter */}
            <div className="p-3 border-b dark:border-gray-700 flex flex-wrap gap-2">
                <button
                    onClick={() => classes.forEach(c => {
                        if (selectedClasses.includes(c.id)) onClassToggle(c.id);
                    })}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedClasses.length === 0
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    Alla
                </button>
                {classes.map(cls => (
                    <button
                        key={cls.id}
                        onClick={() => onClassToggle(cls.id)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedClasses.includes(cls.id)
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        {cls.name}
                    </button>
                ))}
            </div>

            {/* Event feed */}
            <div
                ref={feedRef}
                className="flex-1 overflow-y-auto"
                style={{ fontSize: `${fontSize}px` }}
            >
                {filteredEvents.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-4">📡</div>
                        <p>Väntar på händelser...</p>
                    </div>
                ) : (
                    <div className="divide-y dark:divide-gray-700">
                        {filteredEvents.map((event, index) => (
                            <div
                                key={event.id}
                                className={`p-3 border-l-4 transition-colors ${getEventColor(event.type)} ${index === 0 && !isPaused ? 'animate-pulse' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{getEventIcon(event.type)}</span>
                                        <div>
                                            <div className="font-bold text-gray-800 dark:text-gray-100">
                                                {event.entry.firstName} {event.entry.lastName}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {event.entry.clubName} • {event.entry.className}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                                            {getEventMessage(event)}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {event.timestamp.toLocaleTimeString('sv-SE')}
                                            {event.position && ` • #${event.position}`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Helper to convert results to race events
 */
export function resultsToEvents(entries: Entry[]): RaceEvent[] {
    const events: RaceEvent[] = [];

    entries.forEach(entry => {
        if (entry.startTime) {
            events.push({
                id: `start-${entry.id}`,
                type: 'start',
                timestamp: new Date(entry.startTime),
                entry,
            });
        }

        if (entry.status === 'finished' && entry.finishTime) {
            events.push({
                id: `finish-${entry.id}`,
                type: entry.resultStatus === 'mp' ? 'mp' : 'finish',
                timestamp: new Date(entry.finishTime),
                entry,
                runningTime: entry.startTime
                    ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                    : undefined,
            });
        }

        if (entry.status === 'dns') {
            events.push({
                id: `dns-${entry.id}`,
                type: 'dns',
                timestamp: new Date(entry.updatedAt),
                entry,
            });
        }

        if (entry.status === 'dnf') {
            events.push({
                id: `dnf-${entry.id}`,
                type: 'dnf',
                timestamp: new Date(entry.updatedAt),
                entry,
            });
        }
    });

    // Sort by timestamp descending (newest first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
