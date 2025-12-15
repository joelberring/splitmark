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
        assignClubRole(user.id, clubId, 'member');

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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Ogiltig Inbjudan
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Denna inbjudningslänk är ogiltig eller har redan använts.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                    >
                        Till startsidan
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="text-6xl mb-4">⏰</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Inbjudan Utgången
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Denna inbjudan har gått ut. Kontakta klubben för en ny inbjudan.
                    </p>
                    <Link
                        href="/join-club"
                        className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                    >
                        Sök efter klubbar
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'accepted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Välkommen till {club?.name}!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Du är nu medlem i klubben och har tillgång till klubbens funktioner.
                    </p>
                    <div className="space-y-3">
                        <Link
                            href={`/club/${clubId}/admin`}
                            className="block w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                        >
                            Gå till klubbsidan
                        </Link>
                        <Link
                            href="/"
                            className="block w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🏠</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        Inbjudan till {club?.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Du har blivit inbjuden att gå med i klubben
                    </p>
                </div>

                {!user ? (
                    <div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                Du måste logga in för att acceptera inbjudan
                            </p>
                        </div>
                        <Link
                            href={`/login?redirect=/invite/${token}?club=${clubId}`}
                            className="block w-full px-6 py-4 bg-emerald-500 text-white rounded-xl font-bold text-center hover:bg-emerald-600 transition-colors"
                        >
                            Logga in och gå med
                        </Link>
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                            Har du inget konto?{' '}
                            <Link href={`/register?redirect=/invite/${token}?club=${clubId}`} className="text-emerald-600 hover:underline">
                                Registrera dig
                            </Link>
                        </p>
                    </div>
                ) : user.clubs[clubId || ''] ? (
                    <div className="text-center">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
                            <p className="text-emerald-700 dark:text-emerald-300">
                                ✓ Du är redan medlem i denna klubb
                            </p>
                        </div>
                        <Link
                            href={`/club/${clubId}/admin`}
                            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                        >
                            Gå till klubbsidan
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Inloggad som <strong>{user.displayName}</strong> ({user.email})
                            </p>
                        </div>

                        <button
                            onClick={handleAccept}
                            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg"
                        >
                            ✓ Acceptera och gå med
                        </button>

                        <Link
                            href="/"
                            className="block w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold text-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Avböj
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
