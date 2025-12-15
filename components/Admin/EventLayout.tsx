'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import EventSidebar from '@/components/Admin/EventSidebar';

interface EventLayoutProps {
    children: React.ReactNode;
}

export default function EventLayout({ children }: EventLayoutProps) {
    const params = useParams();
    const eventId = params.id as string;
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
            }
        }
        setLoading(false);
    }, [eventId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="flex">
                <div className="fixed top-0 left-0 h-screen p-4 overflow-y-auto">
                    <EventSidebar eventId={eventId} eventName={eventName || 'Tävling'} />
                </div>
                <main className="flex-1 ml-72">
                    {children}
                </main>
            </div>
        </div>
    );
}
