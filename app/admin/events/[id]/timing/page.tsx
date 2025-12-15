'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import ResultEditModal from '@/components/Admin/ResultEditModal';
import UnpairedCardsPanel, { type UnpairedCard } from '@/components/Admin/UnpairedCardsPanel';
import { SportIdentReader, type SICard } from '@/lib/sportident/reader';
import type { Entry } from '@/types/entry';
import type { Course, Control } from '@/types/course';

interface ReadResult {
    id: string;
    timestamp: Date;
    cardNumber: string;
    entry?: Entry;
    runningTime?: number;
    status: 'ok' | 'mp' | 'unknown' | 'error' | 'dns' | 'dnf'; // Added dns/dnf
    missingControls?: string[];
    message?: string;
    punches?: { controlCode: number; time: Date }[];
}

export default function TimingPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    // Editing State
    const [editingResult, setEditingResult] = useState<{ entry: Entry, punches: any[] } | null>(null);

    // SI Reader state
    const readerRef = useRef<SportIdentReader | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Results
    const [results, setResults] = useState<ReadResult[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Unpaired cards (cards that don't match any participant)
    const [unpairedCards, setUnpairedCards] = useState<UnpairedCard[]>([]);

    // Demo mode
    const [demoMode, setDemoMode] = useState(false);

    useEffect(() => {
        loadData();
        return () => {
            // Cleanup
            if (readerRef.current?.isConnected()) {
                readerRef.current.disconnect();
            }
        };
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setClasses(event.classes || []);
                setCourses(event.courses || []);
                setEntries(event.entries || []);
            }
        }
        setLoading(false);
    };

    const handleConnect = async () => {
        setConnectionError(null);

        if (!SportIdentReader.isSupported()) {
            setConnectionError('Web Serial API stöds inte. Använd Chrome eller Edge.');
            return;
        }

        try {
            readerRef.current = new SportIdentReader();
            await readerRef.current.connect();
            setIsConnected(true);
            startReading();
        } catch (error: any) {
            setConnectionError(error.message);
        }
    };

    const handleDisconnect = async () => {
        setIsReading(false);
        if (readerRef.current) {
            await readerRef.current.disconnect();
        }
        setIsConnected(false);
    };

    const startReading = async () => {
        if (!readerRef.current) return;

        setIsReading(true);

        try {
            for await (const card of readerRef.current.watchCards()) {
                processCard(card);
            }
        } catch (error) {
            console.error('Reading error:', error);
        }

        setIsReading(false);
    };

    const processCard = (card: SICard) => {
        // Find entry by SI card number
        const entry = entries.find(e => e.siCard === card.cardNumber);

        // Find course for validation
        let course: Course | undefined;
        if (entry) {
            const entryClass = classes.find((c: any) => c.id === entry.classId);
            if (entryClass?.courseId) {
                course = courses.find(c => c.id === entryClass.courseId);
            }
        }

        // Validate punches
        // Map SIPunch (string code, timestamp) to local format (number code, time)
        const mappedPunches = card.punches.map(p => ({
            controlCode: parseInt(p.controlCode),
            time: p.timestamp
        }));

        const validationResult = validatePunches(mappedPunches, course);

        // Calculate running time
        let runningTime: number | undefined;
        if (card.startTime && card.finishTime) {
            runningTime = card.finishTime.getTime() - card.startTime.getTime();
        } else if (entry?.startTime && card.finishTime) {
            // Handle HH:MM:SS string from manual input
            // Assuming entry.startTime is "HH:MM:SS" or ISO string
            const startStr = entry.startTime;
            const now = new Date();
            let startMs = 0;

            if (startStr.includes(':') && startStr.length <= 8) {
                const [h, m, s] = startStr.split(':').map(Number);
                const startDate = new Date(card.finishTime);
                startDate.setHours(h, m, s || 0);
                startMs = startDate.getTime();
            } else {
                startMs = new Date(startStr).getTime();
            }

            runningTime = card.finishTime.getTime() - startMs;
        }

        // Create result
        const result: ReadResult = {
            id: `result-${Date.now()}`,
            timestamp: new Date(),
            cardNumber: card.cardNumber,
            entry,
            runningTime,
            status: entry ? validationResult.status : 'unknown',
            missingControls: validationResult.missingControls,
            message: entry
                ? `${entry.firstName} ${entry.lastName}`
                : 'Okänd bricka',
            punches: mappedPunches,
        };

        // Add to results or unpaired cards
        if (entry) {
            setResults(prev => [result, ...prev]);
            updateEntryResult(entry, card, validationResult.status);
        } else {
            // Add to unpaired cards
            const unpairedCard: UnpairedCard = {
                id: `unpaired-${Date.now()}`,
                cardNumber: card.cardNumber,
                readTime: new Date(),
                punches: mappedPunches,
                startTime: card.startTime,
                finishTime: card.finishTime,
            };
            setUnpairedCards(prev => [unpairedCard, ...prev]);
            setResults(prev => [result, ...prev]);
        }

        // Play sound
        if (soundEnabled) {
            playSound(entry ? validationResult.status : 'unknown');
        }
    };

    const handleEditResult = (result: ReadResult) => {
        if (!result.entry) return;
        setEditingResult({
            entry: result.entry,
            punches: result.punches || []
        });
    };

    const handleSaveResult = (updatedEntry: Entry, updatedPunches: any[]) => {
        // Update local storage
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const eventIndex = events.findIndex((e: any) => e.id === eventId);
            if (eventIndex >= 0) {
                const entryIndex = events[eventIndex].entries.findIndex((e: Entry) => e.id === updatedEntry.id);
                if (entryIndex >= 0) {
                    events[eventIndex].entries[entryIndex] = updatedEntry;
                    localStorage.setItem('events', JSON.stringify(events));

                    // Update local state
                    setEntries(events[eventIndex].entries);

                    // Also update the transient result view to reflect status change
                    setResults(prev => prev.map(r =>
                        r.entry?.id === updatedEntry.id
                            ? { ...r, status: updatedEntry.resultStatus || 'ok', entry: updatedEntry, punches: updatedPunches } as ReadResult
                            : r
                    ));
                }
            }
        }
        setEditingResult(null);
    };

    const validatePunches = (
        punches: { controlCode: number; time: Date }[],
        course?: Course
    ): { status: 'ok' | 'mp'; missingControls?: string[] } => {
        if (!course || course.controls.length === 0) {
            return { status: 'ok' }; // No course to validate against
        }

        // Get expected control codes (excluding start/finish)
        const expectedCodes = course.controls
            .filter(c => c.type === 'control')
            .map(c => parseInt(c.code));

        // Get punched codes
        const punchedCodes = punches.map(p => p.controlCode);

        // Check for missing punches
        const missingControls: string[] = [];
        for (const expected of expectedCodes) {
            if (!punchedCodes.includes(expected)) {
                missingControls.push(expected.toString());
            }
        }

        if (missingControls.length > 0) {
            return { status: 'mp', missingControls };
        }

        return { status: 'ok' };
    };

    const updateEntryResult = (entry: Entry, card: SICard, status: 'ok' | 'mp' | 'dns' | 'dnf' | 'unknown' | 'error') => {
        const storedEvents = localStorage.getItem('events');
        if (!storedEvents) return;

        const events = JSON.parse(storedEvents);
        const eventIndex = events.findIndex((e: any) => e.id === eventId);
        if (eventIndex < 0) return;

        const updatedEntries = events[eventIndex].entries.map((e: Entry) => {
            if (e.id === entry.id) {
                return {
                    ...e,
                    status: 'finished',
                    resultStatus: status as any,
                    finishTime: card.finishTime?.toISOString(),
                    updatedAt: new Date().toISOString(),
                };
            }
            return e;
        });

        events[eventIndex].entries = updatedEntries;
        localStorage.setItem('events', JSON.stringify(events));
        setEntries(updatedEntries);
    };

    const playSound = (status: 'ok' | 'mp' | 'unknown' | 'error' | 'dns' | 'dnf') => {
        try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();

            oscillator.connect(gain);
            gain.connect(audio.destination);

            if (status === 'ok') {
                // Success: high pitch beep
                oscillator.frequency.value = 880;
                gain.gain.value = 0.3;
            } else {
                // Error: low pitch
                oscillator.frequency.value = 220;
                gain.gain.value = 0.3;
            }

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audio.close();
            }, status === 'ok' ? 100 : 300);
        } catch (e) {
            // Audio not available
        }
    };

    // Unpaired cards handlers
    const handlePairCard = (cardId: string, entryId: string) => {
        const card = unpairedCards.find(c => c.id === cardId);
        const entry = entries.find(e => e.id === entryId);
        if (!card || !entry) return;

        // Create a SICard-like object to process
        const siCard: SICard = {
            cardNumber: card.cardNumber,
            cardType: 'SI10',
            startTime: card.startTime,
            finishTime: card.finishTime,
            punches: card.punches.map(p => ({
                controlCode: p.controlCode.toString(),
                timestamp: p.time
            })),
        };

        // Find course for validation
        let course: Course | undefined;
        const entryClass = classes.find((c: any) => c.id === entry.classId);
        if (entryClass?.courseId) {
            course = courses.find(c => c.id === entryClass.courseId);
        }

        // Validate and update
        const validationResult = validatePunches(card.punches, course);

        // Calculate running time
        let runningTime: number | undefined;
        if (card.startTime && card.finishTime) {
            runningTime = card.finishTime.getTime() - card.startTime.getTime();
        }

        // Create result
        const result: ReadResult = {
            id: `result-${Date.now()}`,
            timestamp: new Date(),
            cardNumber: card.cardNumber,
            entry,
            runningTime,
            status: validationResult.status,
            missingControls: validationResult.missingControls,
            message: `${entry.firstName} ${entry.lastName}`,
            punches: card.punches,
        };

        // Update states
        setResults(prev => [result, ...prev.filter(r => r.cardNumber !== card.cardNumber)]);
        setUnpairedCards(prev => prev.filter(c => c.id !== cardId));
        updateEntryResult(entry, siCard, validationResult.status);

        if (soundEnabled) {
            playSound(validationResult.status);
        }
    };

    const handleCreateEntryFromCard = (card: UnpairedCard) => {
        // Create new entry with the SI card number
        const newEntry: Entry = {
            id: `entry-${Date.now()}`,
            eventId,
            firstName: 'Okänd',
            lastName: card.cardNumber,
            clubName: '',
            classId: classes[0]?.id || '',
            className: classes[0]?.name || '',
            siCard: card.cardNumber,
            status: 'registered',
            entryType: 'late',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Add to storage
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const eventIndex = events.findIndex((e: any) => e.id === eventId);
            if (eventIndex >= 0) {
                events[eventIndex].entries = [...(events[eventIndex].entries || []), newEntry];
                localStorage.setItem('events', JSON.stringify(events));
                setEntries(events[eventIndex].entries);
            }
        }

        // Now pair the card with the new entry
        handlePairCard(card.id, newEntry.id);
    };

    const handleDismissCard = (cardId: string) => {
        setUnpairedCards(prev => prev.filter(c => c.id !== cardId));
    };

    // Demo mode functions
    const simulateCardRead = () => {
        // 50% chance of unknown card for testing unpaired functionality
        const useUnknownCard = Math.random() > 0.5;
        const randomEntry = useUnknownCard ? null : entries[Math.floor(Math.random() * entries.length)];

        const demoCard: SICard = {
            cardNumber: randomEntry?.siCard || Math.floor(100000 + Math.random() * 900000).toString(),
            cardType: 'SI10',
            startTime: new Date(Date.now() - 45 * 60 * 1000),
            finishTime: new Date(),
            punches: [
                { controlCode: '31', timestamp: new Date() },
                { controlCode: '32', timestamp: new Date() },
                { controlCode: '33', timestamp: new Date() },
            ],
        };

        processCard(demoCard);
    };

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
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            ⏱️ Tidtagning
                            <HelpButton topic="timing" />
                        </h1>
                        <div className="flex items-center gap-4">
                            {/* Sound Toggle */}
                            <button
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={`p-2 rounded-lg ${soundEnabled
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                    }`}
                                title={soundEnabled ? 'Ljud på' : 'Ljud av'}
                            >
                                {soundEnabled ? '🔊' : '🔇'}
                            </button>

                            {/* Demo Mode Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={demoMode}
                                    onChange={(e) => setDemoMode(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Demo</span>
                            </label>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Connection Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                💳 SportIdent Station
                                <HelpButton topic="si-cards" size="sm" />
                            </h2>

                            {/* Connection Status */}
                            <div className={`p-4 rounded-lg mb-4 ${isConnected
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-gray-100 dark:bg-gray-700'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${isConnected
                                        ? 'bg-emerald-500 animate-pulse'
                                        : 'bg-gray-400'
                                        }`}></div>
                                    <span className={`font-semibold ${isConnected
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                        {isConnected
                                            ? isReading ? 'Läser brickor...' : 'Ansluten'
                                            : 'Ej ansluten'
                                        }
                                    </span>
                                </div>
                            </div>

                            {connectionError && (
                                <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4 text-sm">
                                    {connectionError}
                                </div>
                            )}

                            {!isConnected ? (
                                <button
                                    onClick={handleConnect}
                                    className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                                >
                                    🔌 Anslut station
                                </button>
                            ) : (
                                <button
                                    onClick={handleDisconnect}
                                    className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
                                >
                                    Koppla från
                                </button>
                            )}

                            {/* Demo Mode */}
                            {demoMode && (
                                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        Demo-läge: Simulera brickavläsning
                                    </p>
                                    <button
                                        onClick={simulateCardRead}
                                        className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600"
                                    >
                                        🎲 Simulera avläsning
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                                Statistik
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Avlästa</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-100">{results.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">OK</span>
                                    <span className="font-bold text-emerald-600">{results.filter(r => r.status === 'ok').length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Fel (MP)</span>
                                    <span className="font-bold text-red-600">{results.filter(r => r.status === 'mp').length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Okända</span>
                                    <span className="font-bold text-yellow-600">{results.filter(r => r.status === 'unknown').length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Feed */}
                    <div className="lg:col-span-2">
                        {/* Unpaired Cards Panel */}
                        <UnpairedCardsPanel
                            cards={unpairedCards}
                            entries={entries}
                            onPairCard={handlePairCard}
                            onCreateEntry={handleCreateEntryFromCard}
                            onDismiss={handleDismissCard}
                        />

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                                <h2 className="font-bold text-gray-800 dark:text-gray-100">
                                    Avläsningar ({results.length})
                                </h2>
                                {results.length > 0 && (
                                    <button
                                        onClick={() => setResults([])}
                                        className="text-sm text-gray-500 hover:text-red-600"
                                    >
                                        Rensa
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[600px] overflow-y-auto">
                                {results.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                        <div className="text-6xl mb-4">💳</div>
                                        <p>Väntar på brickavläsningar...</p>
                                        {!isConnected && !demoMode && (
                                            <p className="text-sm mt-2">
                                                Anslut en SportIdent-station eller aktivera demo-läge
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="divide-y dark:divide-gray-700">
                                        {results.map((result, index) => (
                                            <div
                                                key={result.id}
                                                onClick={() => handleEditResult(result)}
                                                className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${index === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                                                    } ${result.status === 'mp' ? 'border-l-4 border-red-500' : ''
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${result.status === 'ok' ? 'bg-emerald-500' :
                                                            result.status === 'mp' ? 'bg-red-500' :
                                                                'bg-yellow-500'
                                                            }`}>
                                                            {result.status === 'ok' ? '✓' :
                                                                result.status === 'mp' ? '✗' : '?'}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                                                {result.entry
                                                                    ? `${result.entry.firstName} ${result.entry.lastName}`
                                                                    : `Bricka ${result.cardNumber}`
                                                                }
                                                                {result.entry && (
                                                                    <span className="text-xs text-gray-400 font-normal">
                                                                        (Klicka för att redigera)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                {result.entry?.clubName || 'Okänd'}
                                                                {result.entry?.className && ` · ${result.entry.className}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {result.runningTime && (
                                                            <div className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-100">
                                                                {formatTime(result.runningTime)}
                                                            </div>
                                                        )}
                                                        <div className="text-sm text-gray-500">
                                                            {result.timestamp.toLocaleTimeString('sv-SE')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {result.status === 'mp' && result.missingControls && (
                                                    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                                                        Saknade kontroller: {result.missingControls.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Editing Modal */}
            {editingResult && (
                <ResultEditModal
                    entry={editingResult.entry}
                    punches={editingResult.punches}
                    onSave={handleSaveResult}
                    onClose={() => setEditingResult(null)}
                />
            )}
        </div>
    );
}
