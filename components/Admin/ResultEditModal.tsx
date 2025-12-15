'use client';

import { useState, useEffect } from 'react';
import type { Entry } from '@/types/entry';

interface Punch {
    controlCode: number;
    time: Date;
}

interface ResultEditModalProps {
    entry: Entry;
    punches: Punch[]; // Punches associated with this result
    onSave: (entry: Entry, punches: Punch[]) => void;
    onClose: () => void;
}

export default function ResultEditModal({ entry, punches: initialPunches, onSave, onClose }: ResultEditModalProps) {
    // Local state for editing
    const [status, setStatus] = useState(entry.status);
    const [resultStatus, setResultStatus] = useState(entry.resultStatus || 'ok');
    const [punches, setPunches] = useState<Punch[]>(initialPunches.map(p => ({ ...p })));
    const [newPunchCode, setNewPunchCode] = useState('');
    const [newPunchTime, setNewPunchTime] = useState('');

    const handleAddPunch = () => {
        if (!newPunchCode) return;

        const time = newPunchTime
            ? new Date(`2000-01-01T${newPunchTime}`) // Dummy date, we care about time
            : new Date();

        // In a real app we'd handle the date properly relative to race start
        // For this UI demo we just assume current date or similar

        setPunches([...punches, {
            controlCode: parseInt(newPunchCode),
            time
        }].sort((a, b) => a.time.getTime() - b.time.getTime()));

        setNewPunchCode('');
        setNewPunchTime('');
    };

    const handleRemovePunch = (index: number) => {
        setPunches(punches.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave({
            ...entry,
            status: status,
            resultStatus: resultStatus as 'ok' | 'mp' | 'dns' | 'dnf',
        }, punches);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Hantera resultat: {entry.firstName} {entry.lastName}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Section */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tävlingsstatus
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="registered">Anmäld</option>
                                <option value="started">Startad</option>
                                <option value="finished">I Mål</option>
                                <option value="dns">Ej start (DNS)</option>
                                <option value="dnf">Brutit (DNF)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Godkänd?
                            </label>
                            <select
                                value={resultStatus}
                                onChange={(e) => setResultStatus(e.target.value as any)}
                                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-bold ${resultStatus === 'ok' ? 'text-emerald-600' :
                                        resultStatus === 'mp' ? 'text-red-600' : ''
                                    }`}
                            >
                                <option value="ok">Godkänd (OK)</option>
                                <option value="mp">Felstämplat (MP)</option>
                                <option value="dnf">Brutit</option>
                            </select>
                        </div>
                    </div>

                    {/* Punches Section */}
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Stämplingar</h3>
                        <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Kod</th>
                                        <th className="px-4 py-2 text-left">Tid</th>
                                        <th className="px-4 py-2 text-right">Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {punches.map((punch, idx) => (
                                        <tr key={idx} className="bg-white dark:bg-gray-800">
                                            <td className="px-4 py-2 font-mono">{punch.controlCode}</td>
                                            <td className="px-4 py-2 font-mono">
                                                {punch.time instanceof Date
                                                    ? punch.time.toLocaleTimeString('sv-SE')
                                                    : punch.time}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    onClick={() => handleRemovePunch(idx)}
                                                    className="text-red-500 hover:text-red-700 px-2"
                                                >
                                                    Ta bort
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Add Punch Row */}
                                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                placeholder="Kod"
                                                value={newPunchCode}
                                                onChange={(e) => setNewPunchCode(e.target.value)}
                                                className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="time"
                                                step="1"
                                                value={newPunchTime}
                                                onChange={(e) => setNewPunchTime(e.target.value)}
                                                className="w-32 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={handleAddPunch}
                                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                                                disabled={!newPunchCode}
                                            >
                                                + Lägg till
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-semibold"
                    >
                        Spara ändringar
                    </button>
                </div>
            </div>
        </div>
    );
}
