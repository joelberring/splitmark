'use client';

import { useState, useMemo } from 'react';
import type { Entry } from '@/types/entry';

export interface UnpairedCard {
    id: string;
    cardNumber: string;
    readTime: Date;
    punches: { controlCode: number; time: Date }[];
    startTime?: Date;
    finishTime?: Date;
}

interface UnpairedCardsPanelProps {
    cards: UnpairedCard[];
    entries: Entry[];
    onPairCard: (cardId: string, entryId: string) => void;
    onCreateEntry: (card: UnpairedCard) => void;
    onDismiss: (cardId: string) => void;
}

export default function UnpairedCardsPanel({
    cards,
    entries,
    onPairCard,
    onCreateEntry,
    onDismiss,
}: UnpairedCardsPanelProps) {
    const [selectedCard, setSelectedCard] = useState<UnpairedCard | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPairModal, setShowPairModal] = useState(false);

    // Filter entries without results for pairing
    const availableEntries = useMemo(() => {
        return entries.filter(e =>
            e.status === 'registered' || e.status === 'confirmed' || e.status === 'started'
        );
    }, [entries]);

    const filteredEntries = useMemo(() => {
        if (!searchQuery) return availableEntries;
        const query = searchQuery.toLowerCase();
        return availableEntries.filter(e =>
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
            e.clubName.toLowerCase().includes(query) ||
            e.siCard?.includes(query)
        );
    }, [availableEntries, searchQuery]);

    const handlePair = (entryId: string) => {
        if (selectedCard) {
            onPairCard(selectedCard.id, entryId);
            setShowPairModal(false);
            setSelectedCard(null);
            setSearchQuery('');
        }
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (cards.length === 0) {
        return null;
    }

    return (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200">
                    Oparade brickor ({cards.length})
                </h3>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
                Dessa SI-kort kunde inte kopplas till någon deltagare. Koppla dem manuellt eller skapa ny deltagare.
            </p>

            <div className="space-y-2">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-2xl">💳</div>
                            <div>
                                <div className="font-mono font-bold text-gray-800 dark:text-gray-100">
                                    SI {card.cardNumber}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Avläst: {formatTime(card.readTime)} • {card.punches.length} stämplingar
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedCard(card);
                                    setShowPairModal(true);
                                }}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600"
                            >
                                Koppla till deltagare
                            </button>
                            <button
                                onClick={() => onCreateEntry(card)}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600"
                            >
                                Ny deltagare
                            </button>
                            <button
                                onClick={() => onDismiss(card.id)}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                                title="Ignorera denna bricka"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pair Modal */}
            {showPairModal && selectedCard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Koppla SI {selectedCard.cardNumber} till deltagare
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {selectedCard.punches.length} stämplingar •
                                {selectedCard.finishTime && ` Mål: ${formatTime(selectedCard.finishTime)}`}
                            </p>
                        </div>

                        <div className="p-4 border-b dark:border-gray-700">
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Sök namn, klubb eller SI-nummer..."
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {filteredEntries.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    Inga matchande deltagare hittades
                                </div>
                            ) : (
                                <div className="divide-y dark:divide-gray-700">
                                    {filteredEntries.map((entry) => (
                                        <button
                                            key={entry.id}
                                            onClick={() => handlePair(entry.id)}
                                            className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                        {entry.firstName} {entry.lastName}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {entry.clubName} • {entry.className}
                                                        {entry.siCard && ` • SI ${entry.siCard}`}
                                                    </div>
                                                </div>
                                                <div className="text-blue-500 font-semibold">
                                                    Välj →
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <button
                                onClick={() => {
                                    setShowPairModal(false);
                                    setSelectedCard(null);
                                    setSearchQuery('');
                                }}
                                className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                            >
                                Avbryt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
