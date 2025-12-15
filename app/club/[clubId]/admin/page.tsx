'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useClubPermissions, useUserWithRoles } from '@/lib/auth/usePermissions';
import type { Club, Team } from '@/types/roles';

export default function ClubAdminPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const { user } = useUserWithRoles();
    const { isClubAdmin, isMember, loading, canInvite, teams } = useClubPermissions(clubId);

    const [club, setClub] = useState<Club | null>(null);
    const [clubTeams, setClubTeams] = useState<Team[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'teams' | 'settings'>('overview');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showCreateTeam, setShowCreateTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    useEffect(() => {
        // Load club data
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs) {
            const clubs = JSON.parse(storedClubs);
            const foundClub = clubs.find((c: Club) => c.id === clubId);
            setClub(foundClub);
        }

        // Load teams
        const storedTeams = localStorage.getItem(`teams-${clubId}`);
        if (storedTeams) {
            setClubTeams(JSON.parse(storedTeams));
        }

        // Load pending membership requests count
        const requestsKey = `club-requests-${clubId}`;
        const storedRequests = localStorage.getItem(requestsKey);
        if (storedRequests) {
            const requests = JSON.parse(storedRequests);
            const pending = requests.filter((r: any) => r.status === 'pending');
            setPendingRequestsCount(pending.length);
        }

        // Load members (mock)
        setMembers([
            { id: '1', name: 'Anna Svensson', email: 'anna@example.com', role: 'club_admin' },
            { id: '2', name: 'Erik Johansson', email: 'erik@example.com', role: 'trainer' },
            { id: '3', name: 'Lisa Karlsson', email: 'lisa@example.com', role: 'member' },
        ]);
    }, [clubId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!isClubAdmin && !isMember) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Åtkomst Nekad
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Du är inte medlem i denna klubb.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                    >
                        Tillbaka
                    </Link>
                </div>
            </div>
        );
    }

    const handleInvite = () => {
        alert(`Inbjudan skickad till ${inviteEmail} (demo)`);
        setInviteEmail('');
        setShowInviteModal(false);
    };

    const handleCreateTeam = () => {
        if (!newTeamName.trim()) return;

        const newTeam: Team = {
            id: `team-${Date.now()}`,
            clubId,
            name: newTeamName,
            trainers: [],
            members: [],
            createdAt: new Date(),
        };

        const updatedTeams = [...clubTeams, newTeam];
        setClubTeams(updatedTeams);
        localStorage.setItem(`teams-${clubId}`, JSON.stringify(updatedTeams));
        setNewTeamName('');
        setShowCreateTeam(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b-4 border-emerald-500">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-gray-500 hover:text-emerald-600">
                                ← Hem
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span>🏠</span> {club?.name || 'Klubb'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {isClubAdmin ? 'Klubbadministration' : 'Medlemsvy'}
                                </p>
                            </div>
                        </div>
                        {isClubAdmin && (
                            <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg font-semibold">
                                Klubbadmin
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex gap-8">
                        {[
                            { id: 'overview', label: 'Översikt', icon: '📊' },
                            { id: 'members', label: 'Medlemmar', icon: '👥' },
                            { id: 'teams', label: 'Lag', icon: '🏃‍♂️' },
                            ...(isClubAdmin ? [{ id: 'settings', label: 'Inställningar', icon: '⚙️' }] : []),
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-all ${activeTab === tab.id
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {members.length}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Medlemmar</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                                    {clubTeams.length}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Lag</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                                    0
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Tävlingar</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                                Snabbåtgärder
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {isClubAdmin && pendingRequestsCount > 0 && (
                                    <Link
                                        href={`/club/${clubId}/requests`}
                                        className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors relative"
                                    >
                                        <span className="text-2xl">📨</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Förfrågningar
                                        </div>
                                        <span className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                            {pendingRequestsCount}
                                        </span>
                                    </Link>
                                )}
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowInviteModal(true)}
                                        className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left"
                                    >
                                        <span className="text-2xl">✉️</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Bjud in medlem
                                        </div>
                                    </button>
                                )}
                                <Link
                                    href={`/admin/events/create?club=${clubId}`}
                                    className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                    <span className="text-2xl">📅</span>
                                    <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                        Skapa tävling
                                    </div>
                                </Link>
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowCreateTeam(true)}
                                        className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
                                    >
                                        <span className="text-2xl">👥</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Skapa lag
                                        </div>
                                    </button>
                                )}
                                <Link
                                    href={`/training`}
                                    className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                >
                                    <span className="text-2xl">📊</span>
                                    <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                        Träningslogg
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Medlemmar
                            </h2>
                            {isClubAdmin && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    + Bjud in
                                </button>
                            )}
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {members.map((member) => (
                                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {member.name}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {member.email}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${member.role === 'club_admin'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                        : member.role === 'trainer'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                        {member.role === 'club_admin' ? 'Admin' : member.role === 'trainer' ? 'Tränare' : 'Medlem'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Teams Tab */}
                {activeTab === 'teams' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Lag
                            </h2>
                            {isClubAdmin && (
                                <button
                                    onClick={() => setShowCreateTeam(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    + Nytt Lag
                                </button>
                            )}
                        </div>

                        {clubTeams.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                                <div className="text-6xl mb-4">👥</div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                    Inga lag ännu
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Skapa lag för att gruppera medlemmar
                                </p>
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowCreateTeam(true)}
                                        className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                    >
                                        Skapa Lag
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {clubTeams.map((team) => (
                                    <div key={team.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                                {team.name}
                                            </h3>
                                            <span className="text-sm text-gray-500">
                                                {team.members.length} medlemmar
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                            {team.trainers.length > 0 ? `${team.trainers.length} tränare` : 'Ingen tränare'}
                                        </div>
                                        <Link
                                            href={`/club/${clubId}/teams/${team.id}`}
                                            className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            Hantera →
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && isClubAdmin && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Klubbinställningar
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Inställningar flyttade till <Link href="/admin" className="text-emerald-600 underline">Admin-panelen</Link>
                        </p>
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Bjud in Medlem
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    E-postadress
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="namn@example.com"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail.includes('@')}
                                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    Skicka Inbjudan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Team Modal */}
            {showCreateTeam && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Skapa Lag
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Lagnamn
                                </label>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="T.ex. D16, Veteraner, Elit"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowCreateTeam(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleCreateTeam}
                                    disabled={!newTeamName.trim()}
                                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    Skapa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
