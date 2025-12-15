'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Ekonomi, { applyClassFees } from '@/components/Admin/Ekonomi';
import type { Entry } from '@/types/entry';

interface ClassFee {
    classId: string;
    className: string;
    normalFee: number;
    lateFee: number;
}

export default function EkonomiPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
    const [classFees, setClassFees] = useState<ClassFee[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setClasses(event.classes || []);
                setEntries(event.entries || []);

                // Load class fees or initialize defaults
                const storedFees = event.classFees || (event.classes || []).map((c: any) => ({
                    classId: c.id,
                    className: c.name,
                    normalFee: 0,
                    lateFee: 0,
                }));
                setClassFees(storedFees);
            }
        }
        setLoading(false);
    };

    const saveData = (newEntries: Entry[], newFees: ClassFee[]) => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const index = events.findIndex((e: any) => e.id === eventId);
            if (index >= 0) {
                events[index].entries = newEntries;
                events[index].classFees = newFees;
                localStorage.setItem('events', JSON.stringify(events));
            }
        }
    };

    const handleUpdateFees = (newFees: ClassFee[]) => {
        setClassFees(newFees);
        // Apply fees to entries
        const updatedEntries = applyClassFees(entries, newFees);
        setEntries(updatedEntries);
        saveData(updatedEntries, newFees);
    };

    const handleTogglePayment = (entryId: string, paid: boolean) => {
        const updatedEntries = entries.map(e =>
            e.id === entryId ? { ...e, feePaid: paid, updatedAt: new Date().toISOString() } : e
        );
        setEntries(updatedEntries);
        saveData(updatedEntries, classFees);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block">
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                            💰 Ekonomi & Avgifter
                        </h1>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Hantera avgifter och betalningar
                    </p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <Ekonomi
                    entries={entries}
                    classes={classes}
                    classFees={classFees}
                    onUpdateFees={handleUpdateFees}
                    onTogglePayment={handleTogglePayment}
                />
            </div>
        </div>
    );
}
