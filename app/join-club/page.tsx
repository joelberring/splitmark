'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { CLUBS, DISTRICTS, type Club } from '@/types/clubs';

interface UserProfile {
    clubId?: string;
    club?: string;
    clubless?: boolean;
}

export default function JoinClubPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('userProfile');
        if (stored) {
            const profile = JSON.parse(stored);
            setUserProfile(profile);
            if (profile.clubId && !profile.clubless) {
                router.push(`/club/${profile.clubId}`);
            }
        }
        setLoading(false);
    }, [router]);

    const filteredClubs = CLUBS.filter(club => {
        const matchesSearch = !searchQuery ||
            club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            club.location?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDistrict = !selectedDistrict || club.districtId === selectedDistrict;
        return matchesSearch && matchesDistrict;
    });

    const handleSelectClub = (club: Club) => {
        const updatedProfile = { ...userProfile, clubId: club.id, club: club.name, clubless: false };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        router.push(`/club/${club.id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (userProfile?.clubId && !userProfile.clubless) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="text-6xl mb-4 opacity-30">🏠</div>
                    <h1 className="text-xl font-bold text-white mb-2">Laddar din klubb...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-24">
            {/* Header */}
            <header className="bg-gradient-to-b from-emerald-900/50 to-slate-900 border-b border-slate-800 px-4 py-8 text-center">
                <div className="text-5xl mb-4 opacity-70">🏠</div>
                <h1 className="text-2xl font-bold uppercase tracking-tight mb-2">Välj din klubb</h1>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Anslut dig till din orienteringsklubb för att se träningar, tävlingar och chatta med klubbkompisar.
                </p>
            </header>

            {/* Search & Filter */}
            <div className="px-4 py-4 sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10 border-b border-slate-800">
                <div className="flex gap-2 max-w-2xl mx-auto">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Sök klubb..."
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                    <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white min-w-[140px]"
                    >
                        <option value="">Alla distrikt</option>
                        {DISTRICTS.map(d => <option key={d.id} value={d.id}>{d.shortName}</option>)}
                    </select>
                </div>
            </div>

            {/* Club List */}
            <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                    {filteredClubs.map(club => (
                        <button
                            key={club.id}
                            onClick={() => handleSelectClub(club)}
                            className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-900/30 border border-emerald-800/50 rounded-lg flex items-center justify-center text-2xl">🏠</div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{club.name}</h3>
                                    <p className="text-xs text-slate-500">
                                        {club.districtName}{club.location && ` • ${club.location}`}
                                    </p>
                                </div>
                                <span className="text-emerald-500 text-lg group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </button>
                    ))}

                    {filteredClubs.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <p className="uppercase tracking-wide text-sm font-bold">Inga klubbar hittades</p>
                            <p className="text-xs mt-2">Prova att ändra sökfilter</p>
                        </div>
                    )}
                </div>

                {/* Clubless option */}
                <div className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <p className="text-slate-500 text-sm">
                        Hittar du inte din klubb?{' '}
                        <Link href="/profile" className="text-emerald-400 font-bold hover:underline">
                            Ange den manuellt i profilen
                        </Link>
                    </p>
                </div>
            </main>

            <BottomNavigation />
        </div>
    );
}
