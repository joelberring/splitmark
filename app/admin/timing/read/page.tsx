'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth/hooks';
import { SportIdentReader, type SICard } from '@/lib/sportident/reader';
import Link from 'next/link';

export default function SportIdentPage() {
    const { user, loading: authLoading } = useRequireAuth('/login');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [reading, setReading] = useState(false);
    const [lastCard, setLastCard] = useState<SICard | null>(null);
    const [error, setError] = useState('');
    const [cardHistory, setCardHistory] = useState<SICard[]>([]);

    const reader = new SportIdentReader();

    const handleConnect = async () => {
        setConnecting(true);
        setError('');

        try {
            await reader.connect();
            setConnected(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        await reader.disconnect();
        setConnected(false);
        setReading(false);
    };

    const handleReadCard = async () => {
        setReading(true);
        setError('');

        try {
            const card = await reader.readCard();
            setLastCard(card);
            setCardHistory(prev => [card, ...prev].slice(0, 10));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setReading(false);
        }
    };

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>;
    }

    const isSupported = SportIdentReader.isSupported();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <Link
                        href="/admin"
                        className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block"
                    >
                        ← Tillbaka till Admin
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        SportIdent Tidtagning
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Anslut och läs SI-brickor via USB
                    </p>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Browser Support Warning */}
                {!isSupported && (
                    <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                                    Web Serial API stöds inte
                                </h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                    Din webbläsare stödjer inte Web Serial API. Använd Chrome, Edge eller Opera för att ansluta SportIdent-stationer.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Connection Panel */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Anslutning
                        </h2>

                        <div className={`mb-6 p-4 rounded-lg ${connected
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                                    }`} />
                                <span className={`font-semibold ${connected
                                        ? 'text-emerald-700 dark:text-emerald-300'
                                        : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                    {connected ? 'Ansluten' : 'Inte ansluten'}
                                </span>
                            </div>
                        </div>

                        {!connected ? (
                            <button
                                onClick={handleConnect}
                                disabled={connecting || !isSupported}
                                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {connecting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Ansluter...
                                    </span>
                                ) : (
                                    '🔌 Anslut SportIdent-station'
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleReadCard}
                                    disabled={reading}
                                    className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {reading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Väntar på bricka...
                                        </span>
                                    ) : (
                                        '💳 Läs SI-bricka'
                                    )}
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                                >
                                    Koppla från
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Hardware Info */}
                        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                                💡 Hårdvarukrav
                            </h3>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                <li>• SportIdent BSM7/BSM8/Master</li>
                                <li>• USB-kabel (CP210x chip)</li>
                                <li>• Chrome/Edge browser</li>
                                <li>• USB OTG för Android</li>
                            </ul>
                        </div>
                    </div>

                    {/* Last Card Panel */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Senast Läst Bricka
                        </h2>

                        {lastCard ? (
                            <div className="space-y-4">
                                <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
                                    <div className="text-center mb-4">
                                        <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                                            {lastCard.cardNumber}
                                        </div>
                                        <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                                            {lastCard.cardType}
                                        </div>
                                    </div>

                                    {lastCard.startTime && (
                                        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                            Start: {lastCard.startTime.toLocaleTimeString('sv-SE')}
                                        </div>
                                    )}
                                    {lastCard.finishTime && (
                                        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                            Mål: {lastCard.finishTime.toLocaleTimeString('sv-SE')}
                                        </div>
                                    )}

                                    {lastCard.punches.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                                Stämplingar: {lastCard.punches.length}
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                {lastCard.punches.map((punch, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                                                    >
                                                        <span>Kontroll {punch.controlCode}</span>
                                                        <span>{punch.timestamp.toLocaleTimeString('sv-SE')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors">
                                    Registrera Resultat
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">💳</div>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Ingen bricka läst ännu
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card History */}
                {cardHistory.length > 0 && (
                    <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Historik ({cardHistory.length})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b dark:border-gray-700">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Bricknummer
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Typ
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Stämplingar
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Åtgärd
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cardHistory.map((card, i) => (
                                        <tr
                                            key={i}
                                            className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <td className="py-3 px-4 font-mono text-sm">
                                                {card.cardNumber}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                                {card.cardType}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                                {card.punches.length}
                                            </td>
                                            <td className="py-3 px-4">
                                                <button className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                                                    Visa detaljer
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
