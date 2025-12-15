'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useClubPermissions, useUserWithRoles, useRoleManagement } from '@/lib/auth/usePermissions';
import type { ClubMembershipRequest, Club } from '@/types/roles';

export default function MembershipRequestsPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const { user } = useUserWithRoles();
    const { isClubAdmin, loading } = useClubPermissions(clubId);
    const { assignClubRole } = useRoleManagement();

    const [club, setClub] = useState<Club | null>(null);
    const [requests, setRequests] = useState<ClubMembershipRequest[]>([]);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        // Load club
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs) {
            const clubs = JSON.parse(storedClubs);
            const found = clubs.find((c: Club) => c.id === clubId);
            setClub(found);
        }

        // Load pending requests
        const key = `club-requests-${clubId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            const allRequests = JSON.parse(stored) as ClubMembershipRequest[];
            setRequests(allRequests.filter(r => r.status === 'pending'));
        }
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

    const handleApprove = (request: ClubMembershipRequest) => {
        setProcessing(request.id);

        // Assign role
        assignClubRole(request.userId, clubId, 'member');

        // Update request status
        updateRequestStatus(request.id, 'approved');

        // Update club member count
        updateClubMemberCount(1);

        setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== request.id));
            setProcessing(null);
        }, 500);
    };

    const handleReject = (request: ClubMembershipRequest) => {
        setProcessing(request.id);
        updateRequestStatus(request.id, 'rejected');

        setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== request.id));
            setProcessing(null);
        }, 500);
    };

    const handleBlock = (request: ClubMembershipRequest) => {
        if (!confirm('Är du säker på att du vill blockera denna användare? De kan inte skicka nya förfrågningar.')) {
            return;
        }

        setProcessing(request.id);
        updateRequestStatus(request.id, 'blocked');

        setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== request.id));
            setProcessing(null);
        }, 500);
    };

    const updateRequestStatus = (requestId: string, status: string) => {
        const key = `club-requests-${clubId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            const allRequests = JSON.parse(stored) as ClubMembershipRequest[];
            const updated = allRequests.map(r =>
                r.id === requestId
                    ? { ...r, status, processedBy: user?.id, processedAt: new Date() }
                    : r
            );
            localStorage.setItem(key, JSON.stringify(updated));
        }
    };

    const updateClubMemberCount = (delta: number) => {
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs && club) {
            const clubs = JSON.parse(storedClubs);
            const updated = clubs.map((c: Club) =>
                c.id === clubId ? { ...c, memberCount: (c.memberCount || 0) + delta } : c
            );
            localStorage.setItem('clubs', JSON.stringify(updated));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-6">
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

            <div className="max-w-4xl mx-auto px-4 py-8">
                {requests.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga väntande förfrågningar
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Alla medlemsförfrågningar har behandlats
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-opacity ${processing === request.id ? 'opacity-50' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                                ?
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                                Användare #{request.userId.slice(-6)}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Ansökte {new Date(request.requestedAt).toLocaleDateString('sv-SE')}
                                            </p>
                                            {request.message && (
                                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                                                        "{request.message}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(request)}
                                            disabled={processing !== null}
                                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                        >
                                            ✓ Godkänn
                                        </button>
                                        <button
                                            onClick={() => handleReject(request)}
                                            disabled={processing !== null}
                                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                                        >
                                            ✗ Avslå
                                        </button>
                                        <button
                                            onClick={() => handleBlock(request)}
                                            disabled={processing !== null}
                                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                        >
                                            🚫
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
