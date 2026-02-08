'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { CLUBS, DISTRICTS, type Club } from '@/types/clubs';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import {
    createOrRenewClubMembershipRequest,
    getClubMembershipRequest,
} from '@/lib/firestore/club-membership-requests';

interface UserProfile {
    clubId?: string;
    club?: string;
    clubless?: boolean;
}

export default function JoinClubPage() {
    const router = useRouter();
    const { user, loading: userLoading } = useUserWithRoles();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [submittingClubId, setSubmittingClubId] = useState<string | null>(null);
    const [pendingClubIds, setPendingClubIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const stored = localStorage.getItem('userProfile');
        if (stored) {
            const profile = JSON.parse(stored);
            setUserProfile(profile);
            if (profile.clubId && !profile.clubless && !user) {
                router.push(`/club/${profile.clubId}`);
            }
        }
        setLoading(false);
    }, [router, user]);

    useEffect(() => {
        let cancelled = false;
        if (!user) return;

        const loadPending = async () => {
            const next: Record<string, boolean> = {};
            await Promise.all(
                CLUBS.map(async (club) => {
                    const existing = await getClubMembershipRequest(club.id, user.id);
                    if (existing?.status === 'pending') {
                        next[club.id] = true;
                    }
                })
            );

            if (!cancelled) {
                setPendingClubIds(next);
            }
        };

        void loadPending();
        return () => {
            cancelled = true;
        };
    }, [user]);

    const filteredClubs = CLUBS.filter((club) => {
        const matchesSearch = !searchQuery
            || club.name.toLowerCase().includes(searchQuery.toLowerCase())
            || club.location?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDistrict = !selectedDistrict || club.districtId === selectedDistrict;
        return matchesSearch && matchesDistrict;
    });

    const handleRequestMembership = async (club: Club) => {
        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent('/join-club')}`);
            return;
        }

        setSubmittingClubId(club.id);
        setSubmitMessage(null);

        try {
            const response = await createOrRenewClubMembershipRequest({
                clubId: club.id,
                userId: user.id,
                userName: user.displayName,
                userEmail: user.email,
                message: '',
            });

            if (response.status === 'blocked') {
                setSubmitMessage({
                    type: 'error',
                    text: `Du är blockerad från medlemsansökan till ${club.name}. Kontakta klubbens admin.`,
                });
                return;
            }

            if (response.status === 'rate_limited') {
                const nextTime = response.nextAllowedAt
                    ? new Date(response.nextAllowedAt).toLocaleString('sv-SE')
                    : 'senare';
                setSubmitMessage({
                    type: 'error',
                    text: `Du har redan ansökt nyligen till ${club.name}. Ny ansökan möjlig: ${nextTime}.`,
                });
                return;
            }

            if (response.status === 'already_pending') {
                setPendingClubIds((prev) => ({ ...prev, [club.id]: true }));
                setSubmitMessage({
                    type: 'success',
                    text: `Ansökan till ${club.name} väntar redan på godkännande.`,
                });
                return;
            }

            setPendingClubIds((prev) => ({ ...prev, [club.id]: true }));
            setSubmitMessage({
                type: 'success',
                text: `Ansökan skickad till ${club.name}. Klubben måste godkänna innan medlemskap aktiveras.`,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kunde inte skicka ansökan.';
            setSubmitMessage({ type: 'error', text: message });
        } finally {
            setSubmittingClubId(null);
        }
    };

    if (loading || userLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (userProfile?.clubId && !userProfile.clubless && !user) {
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
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            <PageHeader
                title="Välj din klubb"
                subtitle="Anslut till en klubb för att se aktiviteter och chatta"
                showLogo
            />

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
                        {DISTRICTS.map((district) => (
                            <option key={district.id} value={district.id}>{district.shortName}</option>
                        ))}
                    </select>
                </div>

                <div className="max-w-2xl mx-auto mt-3">
                    {!user ? (
                        <div className="text-xs text-slate-400">
                            Du behöver logga in för att skicka medlemsansökan.
                            {' '}
                            <Link href="/login?redirect=%2Fjoin-club" className="text-emerald-400 hover:underline">Logga in</Link>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400">
                            Inloggad som <span className="text-white font-semibold">{user.displayName || user.email || user.id}</span>. Välj klubb och skicka ansökan.
                        </div>
                    )}
                </div>

                {submitMessage && (
                    <div className={`max-w-2xl mx-auto mt-3 rounded-lg px-3 py-2 text-xs ${
                        submitMessage.type === 'success'
                            ? 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-300'
                            : 'bg-red-900/20 border border-red-700/40 text-red-300'
                    }`}>
                        {submitMessage.text}
                    </div>
                )}
            </div>

            <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                    {filteredClubs.map((club) => (
                        <div
                            key={club.id}
                            className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-4 justify-between">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-emerald-900/30 border border-emerald-800/50 rounded-lg flex items-center justify-center text-2xl">🏠</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{club.name}</h3>
                                        <p className="text-xs text-slate-500">
                                            {club.districtName}{club.location && ` • ${club.location}`}
                                        </p>
                                    </div>
                                </div>

                                {user?.clubs?.[club.id] ? (
                                    <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 font-bold uppercase tracking-widest">
                                        Medlem
                                    </span>
                                ) : pendingClubIds[club.id] ? (
                                    <span className="text-[10px] px-3 py-1 rounded-full bg-amber-900/30 border border-amber-700/40 text-amber-300 font-bold uppercase tracking-widest">
                                        Väntar godkännande
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => void handleRequestMembership(club)}
                                        disabled={submittingClubId === club.id}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                                    >
                                        {submittingClubId === club.id ? 'Skickar…' : 'Ansök'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredClubs.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <p className="uppercase tracking-wide text-sm font-bold">Inga klubbar hittades</p>
                            <p className="text-xs mt-2">Prova att ändra sökfilter</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <p className="text-slate-500 text-sm">
                        Hittar du inte din klubb?{' '}
                        <Link href="/profile" className="text-emerald-400 font-bold hover:underline">
                            Ange den manuellt i profilen
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
