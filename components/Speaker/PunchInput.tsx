'use client';

import { useState, useRef, useEffect } from 'react';
import type { Entry } from '@/types/entry';

interface PunchInputProps {
    entries: Entry[];
    controls: { code: string; name?: string }[];
    onPunch: (entryId: string, controlCode: string, time: Date) => void;
}

export default function PunchInput({
    entries,
    controls,
    onPunch
}: PunchInputProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [selectedControl, setSelectedControl] = useState('');
    const [punchTime, setPunchTime] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter entries by search
    const filteredEntries = entries.filter(e => {
        if (!searchQuery) return false;
        const query = searchQuery.toLowerCase();
        return (
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
            e.siCard?.includes(query) ||
            e.clubName.toLowerCase().includes(query)
        );
    });

    // Set current time as default
    useEffect(() => {
        const now = new Date();
        setPunchTime(now.toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }));
    }, []);

    const handleSelectEntry = (entry: Entry) => {
        setSelectedEntry(entry);
        setSearchQuery(`${entry.firstName} ${entry.lastName}`);
        setShowDropdown(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedEntry || !selectedControl || !punchTime) {
            return;
        }

        // Parse time string to Date
        const [hours, minutes, seconds] = punchTime.split(':').map(Number);
        const punchDate = new Date();
        punchDate.setHours(hours, minutes, seconds || 0);

        onPunch(selectedEntry.id, selectedControl, punchDate);

        // Reset form
        setSelectedEntry(null);
        setSearchQuery('');
        setSelectedControl('');
        setPunchTime(new Date().toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }));
        inputRef.current?.focus();
    };

    const handleNow = () => {
        setPunchTime(new Date().toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }));
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                ⏱️ Manuell tidsinmatning
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Entry search */}
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deltagare
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowDropdown(true);
                            if (selectedEntry && e.target.value !== `${selectedEntry.firstName} ${selectedEntry.lastName}`) {
                                setSelectedEntry(null);
                            }
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Sök namn eller SI-nummer..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />

                    {/* Dropdown */}
                    {showDropdown && filteredEntries.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredEntries.slice(0, 10).map(entry => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => handleSelectEntry(entry)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <div className="font-semibold text-gray-800 dark:text-gray-100">
                                        {entry.firstName} {entry.lastName}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {entry.clubName} • {entry.className}
                                        {entry.siCard && ` • SI ${entry.siCard}`}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Control selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kontroll
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {controls.map(ctrl => (
                            <button
                                key={ctrl.code}
                                type="button"
                                onClick={() => setSelectedControl(ctrl.code)}
                                className={`px-3 py-2 rounded-lg font-medium transition-colors ${selectedControl === ctrl.code
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {ctrl.code}
                            </button>
                        ))}
                        <input
                            type="text"
                            value={selectedControl}
                            onChange={(e) => setSelectedControl(e.target.value)}
                            placeholder="Annan..."
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                {/* Time input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tid (HH:MM:SS)
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={punchTime}
                            onChange={(e) => setPunchTime(e.target.value)}
                            pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                            placeholder="HH:MM:SS"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                        />
                        <button
                            type="button"
                            onClick={handleNow}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Nu
                        </button>
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={!selectedEntry || !selectedControl || !punchTime}
                    className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Registrera stämpling
                </button>
            </form>
        </div>
    );
}
