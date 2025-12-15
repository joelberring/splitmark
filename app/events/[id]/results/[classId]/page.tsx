'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface SplitTime {
    controlCode: string;
    time: number;
    position: number;
    timeBehind: number;
    bestTime: number;
}

interface Result {
    id: string;
    name: string;
    club: string;
    time: number;
    status: 'OK' | 'MP' | 'DNF';
    splits: SplitTime[];
}

export default function ResultsPage() {
    const params = useParams();
    const eventId = params.id as string;
    const classId = params.classId as string;

    const [selectedRunner, setSelectedRunner] = useState<string | null>(null);
    const [comparisonRunner, setComparisonRunner] = useState<string | null>(null);

    // Mock data
    const mockResults: Result[] = [
        {
            id: '1',
            name: 'Anna Svensson',
            club: 'OK Linné',
            time: 3245, // 54:05
            status: 'OK',
            splits: [
                { controlCode: '101', time: 182, position: 1, timeBehind: 0, bestTime: 182 },
                { controlCode: '102', time: 456, position: 2, timeBehind: 12, bestTime: 444 },
                { controlCode: '103', time: 823, position: 1, timeBehind: 0, bestTime: 823 },
                { controlCode: '104', time: 1245, position: 3, timeBehind: 23, bestTime: 1222 },
                { controlCode: '105', time: 1876, position: 2, timeBehind: 15, bestTime: 1861 },
            ],
        },
        {
            id: '2',
            name: 'Erik Johansson',
            club: 'IFK Göteborg',
            time: 3189,
            status: 'OK',
            splits: [
                { controlCode: '101', time: 195, position: 3, timeBehind: 13, bestTime: 182 },
                { controlCode: '102', time: 444, position: 1, timeBehind: 0, bestTime: 444 },
                { controlCode: '103', time: 845, position: 2, timeBehind: 22, bestTime: 823 },
                { controlCode: '104', time: 1222, position: 1, timeBehind: 0, bestTime: 1222 },
                { controlCode: '105', time: 1861, position: 1, timeBehind: 0, bestTime: 1861 },
            ],
        },
    ];

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const selectedResult = mockResults.find(r => r.id === selectedRunner);
    const comparisonResult = mockResults.find(r => r.id === comparisonRunner);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link
                        href={`/events/${eventId}`}
                        className="text-sm text-gray-500 hover:text-emerald-600 mb-4 inline-block"
                    >
                        ← Tillbaka till tävling
                    </Link>

                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        Resultat - {classId}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {mockResults.length} deltagare
                    </p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Results List */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                            <div className="p-6 border-b dark:border-gray-700">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                    Resultat
                                </h2>
                            </div>

                            <div className="divide-y dark:divide-gray-700">
                                {mockResults.map((result, index) => (
                                    <div
                                        key={result.id}
                                        onClick={() => setSelectedRunner(result.id)}
                                        className={`p-4 cursor-pointer transition-colors ${selectedRunner === result.id
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl font-bold text-gray-400">
                                                        {index + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                            {result.name}
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            {result.club}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-gray-800 dark:text-gray-100">
                                                    {formatTime(result.time)}
                                                </div>
                                                {index > 0 && (
                                                    <div className="text-sm text-gray-500">
                                                        +{formatTime(result.time - mockResults[0].time)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Split Times Visualization */}
                    <div className="lg:col-span-2">
                        {selectedResult ? (
                            <div className="space-y-6">
                                {/* Runner Info */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                                {selectedResult.name}
                                            </h2>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                {selectedResult.club} · {formatTime(selectedResult.time)}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors text-sm">
                                                Exportera GPX
                                            </button>
                                            <button className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors text-sm">
                                                Dela till Strava
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Split Times Table */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                                    <div className="p-6 border-b dark:border-gray-700">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                            Sträcktider
                                        </h3>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-700">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Kontroll
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Tid
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Sträcktid
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Placering
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        +/-
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Visualisering
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-gray-700">
                                                {selectedResult.splits.map((split, index) => {
                                                    const legTime = index === 0 ? split.time : split.time - selectedResult.splits[index - 1].time;
                                                    const bestLegTime = index === 0 ? split.bestTime : split.bestTime - mockResults[0].splits[index - 1].bestTime;
                                                    const percentOfBest = (legTime / bestLegTime) * 100;

                                                    return (
                                                        <tr key={split.controlCode} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="font-semibold text-gray-800 dark:text-gray-100">
                                                                    {split.controlCode}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-800 dark:text-gray-100">
                                                                {formatTime(split.time)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-800 dark:text-gray-100">
                                                                {formatTime(legTime)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${split.position === 1
                                                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                                        : split.position <= 3
                                                                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                                            : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                                    }`}>
                                                                    {split.position}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <span className={`font-mono text-sm ${split.timeBehind === 0
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : 'text-red-600 dark:text-red-400'
                                                                    }`}>
                                                                    {split.timeBehind > 0 ? `+${split.timeBehind}` : '0'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                    <div
                                                                        className={`h-2 rounded-full transition-all ${percentOfBest <= 105
                                                                                ? 'bg-emerald-500'
                                                                                : percentOfBest <= 115
                                                                                    ? 'bg-yellow-500'
                                                                                    : 'bg-red-500'
                                                                            }`}
                                                                        style={{ width: `${Math.min(percentOfBest, 200)}%` }}
                                                                    ></div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
                                <div className="text-6xl mb-4">👈</div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                    Välj en löpare
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Klicka på en löpare i listan för att se sträcktider
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
