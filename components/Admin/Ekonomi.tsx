'use client';

import { useState, useMemo } from 'react';
import type { Entry } from '@/types/entry';

interface ClassFee {
    classId: string;
    className: string;
    normalFee: number;
    lateFee: number;
}

interface EkonomiProps {
    entries: Entry[];
    classes: { id: string; name: string }[];
    classFees: ClassFee[];
    onUpdateFees: (classFees: ClassFee[]) => void;
    onTogglePayment: (entryId: string, paid: boolean) => void;
}

export default function Ekonomi({
    entries,
    classes,
    classFees,
    onUpdateFees,
    onTogglePayment,
}: EkonomiProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'payments'>('overview');
    const [editingFees, setEditingFees] = useState<ClassFee[]>(classFees);

    // Calculate statistics
    const stats = useMemo(() => {
        const byClub: Record<string, { name: string; count: number; fee: number; paid: number }> = {};
        let totalFees = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;

        entries.forEach(entry => {
            const fee = entry.fee || 0;
            totalFees += fee;

            if (entry.feePaid) {
                totalPaid += fee;
            } else {
                totalUnpaid += fee;
            }

            // Group by club
            if (!byClub[entry.clubName]) {
                byClub[entry.clubName] = { name: entry.clubName, count: 0, fee: 0, paid: 0 };
            }
            byClub[entry.clubName].count++;
            byClub[entry.clubName].fee += fee;
            if (entry.feePaid) {
                byClub[entry.clubName].paid += fee;
            }
        });

        return {
            totalEntries: entries.length,
            totalFees,
            totalPaid,
            totalUnpaid,
            paidCount: entries.filter(e => e.feePaid).length,
            unpaidCount: entries.filter(e => !e.feePaid && (e.fee || 0) > 0).length,
            byClub: Object.values(byClub).sort((a, b) => b.fee - a.fee),
        };
    }, [entries]);

    const handleSaveFees = () => {
        onUpdateFees(editingFees);
    };

    const handleFeeChange = (classId: string, field: 'normalFee' | 'lateFee', value: number) => {
        setEditingFees(prev => prev.map(f =>
            f.classId === classId ? { ...f, [field]: value } : f
        ));
    };

    const formatCurrency = (amount: number) => {
        return `${amount.toLocaleString('sv-SE')} kr`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b dark:border-gray-700">
                {(['overview', 'fees', 'payments'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-4 py-3 font-semibold text-sm transition-colors ${activeTab === tab
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        {tab === 'overview' && '📊 Översikt'}
                        {tab === 'fees' && '💰 Avgifter'}
                        {tab === 'payments' && '✅ Betalningar'}
                    </button>
                ))}
            </div>

            <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Summary cards */}
                        <div className="grid grid-cols-4 gap-4">
                            <StatCard
                                label="Totala avgifter"
                                value={formatCurrency(stats.totalFees)}
                                color="blue"
                            />
                            <StatCard
                                label="Betalat"
                                value={formatCurrency(stats.totalPaid)}
                                color="emerald"
                            />
                            <StatCard
                                label="Ej betalat"
                                value={formatCurrency(stats.totalUnpaid)}
                                color="red"
                            />
                            <StatCard
                                label="Betalningsgrad"
                                value={`${stats.totalFees > 0 ? Math.round((stats.totalPaid / stats.totalFees) * 100) : 0}%`}
                                color="purple"
                            />
                        </div>

                        {/* By club */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                                Per klubb
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {stats.byClub.map(club => (
                                    <div
                                        key={club.name}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {club.name || 'Utan klubb'}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {club.count} deltagare
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-gray-800 dark:text-gray-100">
                                                {formatCurrency(club.fee)}
                                            </div>
                                            <div className={`text-sm ${club.paid === club.fee ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                {formatCurrency(club.paid)} betalat
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Fees Tab */}
                {activeTab === 'fees' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Ange avgifter per klass. Efteranmälningsavgift läggs på vid sen anmälan.
                        </p>

                        <div className="space-y-3">
                            {classes.map(cls => {
                                const fee = editingFees.find(f => f.classId === cls.id) || {
                                    classId: cls.id,
                                    className: cls.name,
                                    normalFee: 0,
                                    lateFee: 0,
                                };

                                return (
                                    <div
                                        key={cls.id}
                                        className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        <div className="w-32 font-semibold text-gray-800 dark:text-gray-100">
                                            {cls.name}
                                        </div>
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">Normal:</label>
                                                <input
                                                    type="number"
                                                    value={fee.normalFee}
                                                    onChange={(e) => handleFeeChange(cls.id, 'normalFee', parseInt(e.target.value) || 0)}
                                                    className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-right"
                                                />
                                                <span className="text-sm text-gray-500">kr</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">Efteranm.:</label>
                                                <input
                                                    type="number"
                                                    value={fee.lateFee}
                                                    onChange={(e) => handleFeeChange(cls.id, 'lateFee', parseInt(e.target.value) || 0)}
                                                    className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-right"
                                                />
                                                <span className="text-sm text-gray-500">kr</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleSaveFees}
                            className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            Spara avgifter
                        </button>
                    </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {entries
                            .filter(e => (e.fee || 0) > 0)
                            .sort((a, b) => (a.feePaid ? 1 : 0) - (b.feePaid ? 1 : 0))
                            .map(entry => (
                                <div
                                    key={entry.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => onTogglePayment(entry.id, !entry.feePaid)}
                                            className={`w-6 h-6 rounded border-2 flex items-center justify-center ${entry.feePaid
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                        >
                                            {entry.feePaid && '✓'}
                                        </button>
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {entry.firstName} {entry.lastName}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {entry.clubName} • {entry.className}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${entry.feePaid ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-100'}`}>
                                            {formatCurrency(entry.fee || 0)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {entry.feePaid ? 'Betalat' : 'Ej betalat'}
                                        </div>
                                    </div>
                                </div>
                            ))}

                        {entries.filter(e => (e.fee || 0) > 0).length === 0 && (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Inga avgifter att visa. Sätt avgifter i "Avgifter" fliken först.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    };

    return (
        <div className={`rounded-xl p-4 ${colors[color]}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm opacity-75">{label}</div>
        </div>
    );
}

/**
 * Calculate fees for entries based on class fees
 */
export function applyClassFees(
    entries: Entry[],
    classFees: ClassFee[]
): Entry[] {
    const feeMap = new Map(classFees.map(f => [f.classId, f]));

    return entries.map(entry => {
        const classFee = feeMap.get(entry.classId);
        if (!classFee) return entry;

        const fee = entry.entryType === 'late'
            ? classFee.normalFee + classFee.lateFee
            : classFee.normalFee;

        return { ...entry, fee };
    });
}
