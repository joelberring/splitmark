'use client';

import { useState, useEffect } from 'react';
import { useSuperAdmin, useSetupSuperAdmin, useUserWithRoles, useRoleManagement } from '@/lib/auth/usePermissions';
import Link from 'next/link';
import type { Club } from '@/types/roles';

// TEMPORARY: Development super admin password
const DEV_SUPER_ADMIN_PASSWORD = 'orienteer2024';

export default function SuperAdminPage() {
    const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
    const { setupAsSuperAdmin } = useSetupSuperAdmin();
    const { user } = useUserWithRoles();
    const { assignClubRole } = useRoleManagement();

    const [clubs, setClubs] = useState<Club[]>([]);
    const [showCreateClub, setShowCreateClub] = useState(false);
    const [newClubName, setNewClubName] = useState('');
    const [devPassword, setDevPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);

    useEffect(() => {
        // Load clubs from localStorage (in production, from Firestore)
        const stored = localStorage.getItem('clubs');
        if (stored) {
            setClubs(JSON.parse(stored));
        }
    }, []);

    const handleDevActivation = () => {
        if (devPassword === DEV_SUPER_ADMIN_PASSWORD) {
            // Set super admin in localStorage
            const roles = {
                systemRole: 'super_admin',
                clubs: {},
                eventRoles: {},
                createdAt: new Date().toISOString(),
            };

            // Use a dev user ID if not logged in
            const userId = user?.id || 'dev-super-admin';
            localStorage.setItem(`user-roles-${userId}`, JSON.stringify(roles));
            localStorage.setItem('dev-super-admin-active', 'true');
            window.location.reload();
        } else {
            setPasswordError(true);
            setTimeout(() => setPasswordError(false), 2000);
        }
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    // Check for dev mode bypass
    const isDevMode = typeof window !== 'undefined' && localStorage.getItem('dev-super-admin-active') === 'true';

    // Show setup/password prompt if not super admin
    if (!isSuperAdmin && !isDevMode) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-6">
                        <span className="text-6xl">👑</span>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-4">
                            Super Admin
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Ange lösenord för att aktivera admin-läge
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Lösenord
                            </label>
                            <input
                                type="password"
                                value={devPassword}
                                onChange={(e) => setDevPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleDevActivation()}
                                placeholder="Ange admin-lösenord"
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white ${passwordError
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : 'border-gray-300 dark:border-gray-600'
                                    }`}
                                autoFocus
                            />
                            {passwordError && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                    Fel lösenord. Försök igen.
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleDevActivation}
                            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg"
                        >
                            🔐 Aktivera Super Admin
                        </button>

                        {user && (
                            <div className="text-center pt-4 border-t dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    Eller aktivera via ditt konto:
                                </p>
                                <button
                                    onClick={setupAsSuperAdmin}
                                    className="text-purple-600 hover:underline text-sm"
                                >
                                    Aktivera för {user.email}
                                </button>
                            </div>
                        )}
                    </div>

                    <Link
                        href="/"
                        className="block text-center mt-6 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        Avbryt
                    </Link>
                </div>
            </div>
        );
    }

    // After dev mode or super admin check, show the dashboard

    const handleCreateClub = () => {
        if (!newClubName.trim()) return;

        const newClub: Club = {
            id: `club-${Date.now()}`,
            name: newClubName,
            settings: {},
            createdBy: user?.id || '',
            createdAt: new Date(),
            memberCount: 0,
        };

        const updatedClubs = [...clubs, newClub];
        setClubs(updatedClubs);
        localStorage.setItem('clubs', JSON.stringify(updatedClubs));
        setNewClubName('');
        setShowCreateClub(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b-4 border-purple-500">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="text-gray-500 hover:text-purple-600"
                            >
                                ← Hem
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span>👑</span> Super Admin
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    Plattformsadministration
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-semibold">
                            {user?.email}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                            {clubs.length}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Klubbar</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                            {clubs.reduce((sum, c) => sum + c.memberCount, 0)}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Medlemmar</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                            0
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">Aktiva tävlingar</div>
                    </div>
                </div>

                {/* Clubs Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                            🏠 Registrerade Klubbar
                        </h2>
                        <button
                            onClick={() => setShowCreateClub(true)}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                        >
                            + Ny Klubb
                        </button>
                    </div>

                    {clubs.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">🏢</div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                Inga klubbar ännu
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Skapa din första klubb för att komma igång
                            </p>
                            <button
                                onClick={() => setShowCreateClub(true)}
                                className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                            >
                                Skapa Klubb
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y dark:divide-gray-700">
                            {clubs.map((club) => (
                                <div key={club.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                                <span className="text-2xl">🏠</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 dark:text-gray-100">
                                                    {club.name}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {club.memberCount} medlemmar · Skapad {new Date(club.createdAt).toLocaleDateString('sv-SE')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/super-admin/clubs/${club.id}`}
                                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                Hantera
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Club Modal */}
            {showCreateClub && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Skapa Ny Klubb
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Klubbnamn
                                </label>
                                <input
                                    type="text"
                                    value={newClubName}
                                    onChange={(e) => setNewClubName(e.target.value)}
                                    placeholder="T.ex. OK Linné"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowCreateClub(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleCreateClub}
                                    disabled={!newClubName.trim()}
                                    className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50"
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
