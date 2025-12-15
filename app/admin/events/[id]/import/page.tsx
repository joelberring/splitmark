'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';

interface EventorEvent {
    id: string;
    name: string;
    date: string;
    organiser: string;
    classification: string;
}

interface EventorEntry {
    personId: string;
    firstName: string;
    lastName: string;
    club: string;
    className: string;
    siCard?: string;
}

export default function EventorImportPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.id as string;

    const [apiKey, setApiKey] = useState('');
    const [eventorEventId, setEventorEventId] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'config' | 'preview' | 'done'>('config');
    const [entries, setEntries] = useState<EventorEntry[]>([]);
    const [error, setError] = useState('');
    const [eventName, setEventName] = useState('');

    useEffect(() => {
        // Load saved API key
        const savedKey = localStorage.getItem('eventor-api-key');
        if (savedKey) setApiKey(savedKey);

        // Load event name
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) setEventName(event.name);
        }
    }, [eventId]);

    const handleFetchEntries = async () => {
        if (!eventorEventId) {
            setError('Ange Eventor event-ID');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // In a real implementation, this would call the Eventor API
            // For now, we simulate with demo data
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Demo entries
            const demoEntries: EventorEntry[] = [
                { personId: '1', firstName: 'Anna', lastName: 'Andersson', club: 'OK Linné', className: 'D21', siCard: '7234567' },
                { personId: '2', firstName: 'Erik', lastName: 'Eriksson', club: 'IFK Göteborg', className: 'H21', siCard: '8345678' },
                { personId: '3', firstName: 'Maria', lastName: 'Månsson', club: 'Järla', className: 'D35', siCard: '9456789' },
                { personId: '4', firstName: 'Johan', lastName: 'Johansson', club: 'OK Linné', className: 'H35' },
                { personId: '5', firstName: 'Lisa', lastName: 'Larsson', club: 'Snättringe SK', className: 'D21', siCard: '1567890' },
            ];

            setEntries(demoEntries);
            setStep('preview');
        } catch (err) {
            setError('Kunde inte hämta anmälningar från Eventor');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = () => {
        setLoading(true);

        // Save API key
        localStorage.setItem('eventor-api-key', apiKey);

        // Convert to entries format
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const eventIndex = events.findIndex((e: any) => e.id === eventId);

            if (eventIndex >= 0) {
                const existingEntries = events[eventIndex].entries || [];
                const existingClasses = events[eventIndex].classes || [];

                // Add new entries
                const newEntries = entries.map(e => ({
                    id: `entry-${Date.now()}-${e.personId}`,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    clubName: e.club,
                    classId: e.className,
                    className: e.className,
                    siCard: e.siCard,
                    status: 'registered',
                    entryType: 'online',
                    createdAt: new Date().toISOString(),
                }));

                // Add missing classes
                const classNames = new Set(existingClasses.map((c: any) => c.name));
                const newClasses = [...new Set(entries.map(e => e.className))]
                    .filter(name => !classNames.has(name))
                    .map(name => ({
                        id: `class-${Date.now()}-${name}`,
                        name,
                        entryCount: 0,
                    }));

                events[eventIndex].entries = [...existingEntries, ...newEntries];
                events[eventIndex].classes = [...existingClasses, ...newClasses];

                localStorage.setItem('events', JSON.stringify(events));
            }
        }

        setStep('done');
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <Link
                        href={`/admin/events/${eventId}`}
                        className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block"
                    >
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            📥 Eventor Import
                            <HelpButton topic="entries" />
                        </h1>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Steps */}
                <div className="flex items-center gap-4 mb-8">
                    {[
                        { id: 'config', label: '1. Konfigurera' },
                        { id: 'preview', label: '2. Förhandsgranska' },
                        { id: 'done', label: '3. Klart' },
                    ].map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === s.id
                                    ? 'bg-emerald-500 text-white'
                                    : i < ['config', 'preview', 'done'].indexOf(step)
                                        ? 'bg-emerald-200 text-emerald-700'
                                        : 'bg-gray-200 text-gray-500'
                                }`}>
                                {i + 1}
                            </div>
                            <span className={step === s.id ? 'font-semibold' : 'text-gray-500'}>
                                {s.label}
                            </span>
                            {i < 2 && <div className="w-8 h-0.5 bg-gray-200"></div>}
                        </div>
                    ))}
                </div>

                {/* Step 1: Config */}
                {step === 'config' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Eventor API-nyckel
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Din personliga API-nyckel från Eventor"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Hämta din nyckel från Eventor → Min profil → API-nyckel
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Eventor Event-ID
                            </label>
                            <input
                                type="text"
                                value={eventorEventId}
                                onChange={(e) => setEventorEventId(e.target.value)}
                                placeholder="T.ex. 123456"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Finns i URL:en när du tittar på tävlingen i Eventor
                            </p>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleFetchEntries}
                            disabled={loading || !eventorEventId}
                            className="w-full py-4 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {loading ? 'Hämtar...' : 'Hämta anmälningar'}
                        </button>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700">
                                <h2 className="font-bold text-gray-800 dark:text-gray-100">
                                    {entries.length} anmälningar hittade
                                </h2>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Namn</th>
                                            <th className="px-4 py-2 text-left">Klubb</th>
                                            <th className="px-4 py-2 text-left">Klass</th>
                                            <th className="px-4 py-2 text-left">SI-bricka</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {entries.map(entry => (
                                            <tr key={entry.personId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 font-medium">{entry.firstName} {entry.lastName}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.club}</td>
                                                <td className="px-4 py-3">{entry.className}</td>
                                                <td className="px-4 py-3 font-mono text-gray-500">{entry.siCard || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep('config')}
                                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                            >
                                ← Tillbaka
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={loading}
                                className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                            >
                                {loading ? 'Importerar...' : `Importera ${entries.length} anmälningar`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Done */}
                {step === 'done' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Import klar!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {entries.length} anmälningar har importerats från Eventor
                        </p>
                        <Link
                            href={`/admin/events/${eventId}/entries`}
                            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            Visa anmälningar
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
