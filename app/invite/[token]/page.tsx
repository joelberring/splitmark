'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserWithRoles, useRoleManagement } from '@/lib/auth/usePermissions';
import type { Club } from '@/types/roles';

export default function InvitePage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const token = params.token as string;
    const clubId = searchParams.get('club');
    const membershipKind = searchParams.get('kind') === 'training' ? 'training' : 'competition';

    const { user, loading: userLoading } = useUserWithRoles();
    const { assignClubRole } = useRoleManagement();

    const [club, setClub] = useState<Club | null>(null);
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'accepted'>('loading');

    useEffect(() => {
        // Verify invite token
        const verifyInvite = async () => {
            if (!clubId) {
                setStatus('invalid');
                return;
            }

            // Load club
            const storedClubs = localStorage.getItem('clubs');
            if (storedClubs) {
                const clubs = JSON.parse(storedClubs);
                const found = clubs.find((c: Club) => c.id === clubId);
                if (found) {
                    setClub(found);
                    setStatus('valid');
                } else {
                    setStatus('invalid');
                }
            } else {
                setStatus('invalid');
            }
        };

        verifyInvite();
    }, [token, clubId]);

    const handleAccept = async () => {
        if (!user || !clubId) return;

        // Assign member role
        assignClubRole(user.id, clubId, 'member', membershipKind);

        // Update club member count
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs) {
            const clubs = JSON.parse(storedClubs);
            const updated = clubs.map((c: Club) =>
                c.id === clubId ? { ...c, memberCount: (c.memberCount || 0) + 1 } : c
            );
            localStorage.setItem('clubs', JSON.stringify(updated));
        }

        setStatus('accepted');
    };

    if (userLoading || status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-12 text-center">
                    <div className="text-6xl mb-6 opacity-30">❌</div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-4">
                        Ogiltig Inbjudan
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">
                        Denna inbjudningslänk är ogiltig eller har redan använts.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-8 py-4 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all border border-slate-700"
                    >
                        Till startsidan
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-12 text-center">
                    <div className="text-6xl mb-6 opacity-30">⏰</div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-4">
                        Inbjudan Utgången
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">
                        Denna inbjudan har gått ut. Kontakta klubben för en ny inbjudan.
                    </p>
                    <Link
                        href="/join-club"
                        className="inline-block px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40"
                    >
                        Sök efter klubbar
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'accepted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                    <div className="text-6xl mb-6 relative z-10">🎉</div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-4 relative z-10">
                        Välkommen till {club?.name}!
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8 relative z-10">
                        Du är nu medlem i klubben och har tillgång till klubbens funktioner.
                    </p>
                    <div className="space-y-4 relative z-10">
                        <Link
                            href={`/club/${clubId}/admin`}
                            className="block w-full px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40"
                        >
                            Gå till klubbsidan
                        </Link>
                        <Link
                            href="/"
                            className="block w-full px-8 py-4 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all border border-slate-700"
                        >
                            Till startsidan
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Valid invite - show acceptance form
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-10 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"></div>
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
                        <span className="text-4xl">🏠</span>
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-white">
                        Inbjudan till {club?.name}
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">
                        Du har blivit inbjuden att gå med i klubben
                    </p>
                </div>

                {!user ? (
                    <div>
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 mb-8">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 text-center">
                                Du måste logga in för att acceptera inbjudan
                            </p>
                        </div>
                        <Link
                            href={`/login?redirect=/invite/${token}?club=${clubId}`}
                            className="block w-full px-8 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm text-center hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40"
                        >
                            Logga in och gå med
                        </Link>
                        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-6">
                            Har du inget konto?{' '}
                            <Link href={`/register?redirect=/invite/${token}?club=${clubId}`} className="text-emerald-500 hover:text-emerald-400 transition-colors">
                                Registrera dig
                            </Link>
                        </p>
                    </div>
                ) : user.clubs[clubId || ''] ? (
                    <div className="text-center">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 mb-8">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 text-center">
                                ✓ Du är redan medlem i denna klubb
                            </p>
                        </div>
                        <Link
                            href={`/club/${clubId}/admin`}
                            className="inline-block px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all"
                        >
                            Gå till klubbsidan
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Inloggad som</p>
                            <p className="text-white font-bold"><strong>{user.displayName}</strong></p>
                            <p className="text-slate-400 text-xs mt-0.5">{user.email}</p>
                        </div>

                        <button
                            onClick={handleAccept}
                            className="w-full px-8 py-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-sm hover:from-emerald-400 hover:to-teal-500 transition-all shadow-xl shadow-emerald-900/20"
                        >
                            Acceptera och gå med
                        </button>

                        <Link
                            href="/"
                            className="block w-full px-8 py-4 bg-slate-800 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[10px] text-center hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                        >
                            Avböj inbjudan
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
