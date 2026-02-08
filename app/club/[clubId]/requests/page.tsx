'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useClubPermissions, useUserWithRoles, useRoleManagement } from '@/lib/auth/usePermissions';
import type { Club } from '@/types/roles';
import {
    processClubMembershipRequest,
    subscribeToClubMembershipRequests,
    subscribeToClubMembershipBlocks,
    unblockClubMembershipRequester,
    type ClubMembershipRequestRecord,
    type ClubMembershipBlockRecord,
} from '@/lib/firestore/club-membership-requests';

export default function MembershipRequestsPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const { user } = useUserWithRoles();
    const { isClubAdmin, loading } = useClubPermissions(clubId);
    const { assignClubRole } = useRoleManagement();

    const [club, setClub] = useState<Club | null>(null);
    const [requests, setRequests] = useState<ClubMembershipRequestRecord[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<ClubMembershipBlockRecord[]>([]);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs) {
            const clubs = JSON.parse(storedClubs);
            const found = clubs.find((item: Club) => item.id === clubId);
            setClub(found || null);
        }
    }, [clubId]);

    useEffect(() => {
        const unsubscribeRequests = subscribeToClubMembershipRequests(
            clubId,
            (nextRequests) => setRequests(nextRequests),
            { status: 'pending' }
        );

        const unsubscribeBlocks = subscribeToClubMembershipBlocks(clubId, (nextBlocks) => {
            setBlockedUsers(nextBlocks);
        });

        return () => {
            unsubscribeRequests?.();
            unsubscribeBlocks?.();
        };
    }, [clubId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!isClubAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Åtkomst Nekad
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Endast klubbadministratörer kan hantera medlemsförfrågningar.
                    </p>
                    <Link href="/" className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold">
                        Tillbaka
                    </Link>
                </div>
            </div>
        );
    }

    const handleApprove = async (request: ClubMembershipRequestRecord) => {
        if (!user) return;
        setProcessing(request.id);

        try {
            const assignResult = assignClubRole(request.userId, clubId, 'member');
            if (!assignResult.success) {
                throw new Error(assignResult.error || 'Kunde inte tilldela medlemsroll.');
            }

            await processClubMembershipRequest({
                clubId,
                userId: request.userId,
                status: 'approved',
                processedBy: user.id,
            });

            const storedClubs = localStorage.getItem('clubs');
            if (storedClubs) {
                const clubs = JSON.parse(storedClubs);
                const updated = clubs.map((item: Club) => (
                    item.id === clubId
                        ? { ...item, memberCount: (item.memberCount || 0) + 1 }
                        : item
                ));
                localStorage.setItem('clubs', JSON.stringify(updated));
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Kunde inte godkänna förfrågan.');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (request: ClubMembershipRequestRecord) => {
        if (!user) return;
        setProcessing(request.id);

        try {
            await processClubMembershipRequest({
                clubId,
                userId: request.userId,
                status: 'rejected',
                processedBy: user.id,
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Kunde inte avslå förfrågan.');
        } finally {
            setProcessing(null);
        }
    };

    const handleBlock = async (request: ClubMembershipRequestRecord) => {
        if (!user) return;
        if (!confirm('Blockera användaren från nya medlemsansökningar till klubben?')) {
            return;
        }

        setProcessing(request.id);

        try {
            await processClubMembershipRequest({
                clubId,
                userId: request.userId,
                status: 'blocked',
                processedBy: user.id,
                rejectionReason: 'Blockerad av klubbadmin',
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Kunde inte blockera användaren.');
        } finally {
            setProcessing(null);
        }
    };

    const handleUnblock = async (blockedUser: ClubMembershipBlockRecord) => {
        setProcessing(blockedUser.id);
        try {
            await unblockClubMembershipRequester({
                clubId,
                userId: blockedUser.userId,
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Kunde inte avblockera.');
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-6">
                    <Link
                        href={`/club/${clubId}/admin`}
                        className="text-sm text-gray-500 hover:text-emerald-600 mb-4 inline-block"
                    >
                        ← Tillbaka till klubbadmin
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        📨 Medlemsförfrågningar
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {club?.name} · {requests.length} väntande
                    </p>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Väntande ansökningar</h2>
                    {requests.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
                            <div className="text-5xl mb-3">✅</div>
                            <p className="text-gray-600 dark:text-gray-400">Inga väntande medlemsansökningar.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((request) => (
                                <div
                                    key={request.id}
                                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-opacity ${processing === request.id ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                                {request.userName || `Användare #${request.userId.slice(-6)}`}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {request.userEmail || 'Ingen e-post'} · ansökte {new Date(request.requestedAt).toLocaleString('sv-SE')}
                                            </p>
                                            {request.requestCount > 1 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                    Tidigare ansökningar: {request.requestCount - 1}
                                                </p>
                                            )}
                                            {request.message && (
                                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                                                        "{request.message}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => void handleApprove(request)}
                                                disabled={processing !== null}
                                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                            >
                                                ✓ Godkänn
                                            </button>
                                            <button
                                                onClick={() => void handleReject(request)}
                                                disabled={processing !== null}
                                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                                            >
                                                ✗ Avslå
                                            </button>
                                            <button
                                                onClick={() => void handleBlock(request)}
                                                disabled={processing !== null}
                                                className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                            >
                                                🚫 Blockera
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Blockerade användare</h2>
                    {blockedUsers.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-sm text-gray-500 dark:text-gray-400">
                            Inga blockeringar aktiva.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {blockedUsers.map((blockedUser) => (
                                <div key={blockedUser.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                            {blockedUser.userId}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Blockerad {new Date(blockedUser.blockedAt).toLocaleString('sv-SE')} av {blockedUser.blockedBy}
                                        </p>
                                        {blockedUser.reason && (
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Orsak: {blockedUser.reason}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => void handleUnblock(blockedUser)}
                                        disabled={processing !== null}
                                        className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50"
                                    >
                                        Avblockera
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
