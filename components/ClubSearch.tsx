'use client';

import { useState, useEffect, useRef } from 'react';

interface Club {
    id: string;
    name: string;
    shortName?: string;
}

interface ClubSearchProps {
    selectedClubId?: string;
    selectedClubName?: string;
    onSelect: (id: string, name: string) => void;
}

export default function ClubSearch({ selectedClubId, selectedClubName, onSelect }: ClubSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Club[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchClubs = async (q: string) => {
        if (q.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/eventor/clubs');
            if (res.ok) {
                const data = await res.json();
                const filtered = data.clubs.filter((c: Club) =>
                    c.name.toLowerCase().includes(q.toLowerCase()) ||
                    c.shortName?.toLowerCase().includes(q.toLowerCase())
                ).slice(0, 10);
                setResults(filtered);
                setShowResults(true);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        searchClubs(val);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query || selectedClubName || ''}
                    onChange={handleInput}
                    onFocus={() => query.length >= 2 && setShowResults(true)}
                    placeholder="Sök klubb (t.ex. Centrum OK)..."
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold"
                />
                {loading && (
                    <div className="absolute right-3 top-3.5">
                        <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                    </div>
                )}
            </div>

            {showResults && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                    {results.map((club) => (
                        <button
                            key={club.id}
                            onClick={() => {
                                onSelect(club.id, club.name);
                                setQuery(club.name);
                                setShowResults(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                        >
                            <div className="text-white font-bold text-sm">{club.name}</div>
                            {club.shortName && <div className="text-slate-500 text-[10px] uppercase font-bold">{club.shortName}</div>}
                        </button>
                    ))}
                </div>
            )}

            {showResults && query.length >= 2 && results.length === 0 && !loading && (
                <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-center text-slate-500 text-sm italic">
                    Inga klubbar hittades
                </div>
            )}
        </div>
    );
}
