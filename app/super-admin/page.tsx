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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    // Check for dev mode bypass
    const isDevMode = typeof window !== 'undefined' && localStorage.getItem('dev-super-admin-active') === 'true';

    // Show setup/password prompt if not super admin
    if (!isSuperAdmin && !isDevMode) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full"></div>
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-10 relative z-10">
                    <div className="text-center mb-10">
                        <span className="text-6xl mb-6 block">👑</span>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-4">
                            Super Admin
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                            Ange lösenord för att aktivera admin-läge
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                                Lösenord
                            </label>
                            <input
                                type="password"
                                value={devPassword}
                                onChange={(e) => setDevPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleDevActivation()}
                                placeholder="••••••••"
                                className={`w-full px-5 py-4 bg-slate-950 border rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-white font-mono transition-all ${passwordError
                                    ? 'border-red-500 bg-red-500/5'
                                    : 'border-slate-800 focus:border-purple-500'
                                    }`}
                                autoFocus
                            />
                            {passwordError && (
                                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-500 ml-1">
                                    Fel lösenord. Försök igen.
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleDevActivation}
                            className="w-full px-6 py-5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:from-purple-500 hover:to-indigo-600 transition-all shadow-xl shadow-purple-900/20"
                        >
                            🔐 Aktivera Tillträde
                        </button>

                        {user && (
                            <div className="text-center pt-6 border-t border-slate-800">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">
                                    Eller aktivera via konto
                                </p>
                                <button
                                    onClick={setupAsSuperAdmin}
                                    className="text-purple-400 hover:text-purple-300 font-black uppercase tracking-widest text-[10px] transition-colors"
                                >
                                    Aktivera för {user.email}
                                </button>
                            </div>
                        )}
                    </div>

                    <Link
                        href="/"
                        className="block text-center mt-8 text-slate-500 hover:text-white font-black uppercase tracking-widest text-[10px] transition-colors"
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
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-purple-500/30 sticky top-0 z-40">
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <Link
                                href="/"
                                className="text-slate-500 hover:text-purple-400 font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                                ← Hem
                            </Link>
                            <div>
                                <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    <span className="text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">👑</span> Super Admin
                                </h1>
                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400/60 mt-1">
                                    Plattformsadministration
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg text-xs font-black uppercase tracking-widest">
                            {user?.email}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full"></div>
                        <div className="text-5xl font-black text-white mb-2 group-hover:text-purple-400 transition-colors">
                            {clubs.length}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Klubbar</div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
                        <div className="text-5xl font-black text-white mb-2">
                            {clubs.reduce((sum, c) => sum + (c.memberCount || 0), 0)}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Medlemmar</div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl">
                        <div className="text-5xl font-black text-slate-700 mb-2">
                            0
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aktiva tävlingar</div>
                    </div>
                </div>

                {/* Clubs Section */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                        <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                            <span className="text-purple-500">🏠</span> Registrerade Klubbar
                        </h2>
                        <button
                            onClick={() => setShowCreateClub(true)}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-purple-900/40"
                        >
                            + Ny Klubb
                        </button>
                    </div>

                    {clubs.length === 0 ? (
                        <div className="p-24 text-center">
                            <div className="text-7xl mb-8 opacity-10">🏢</div>
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                Inga klubbar ännu
                            </h3>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-10">
                                Skapa din första klubb för att komma igång
                            </p>
                            <button
                                onClick={() => setShowCreateClub(true)}
                                className="px-10 py-5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-purple-900/40"
                            >
                                Skapa Klubb
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {clubs.map((club) => (
                                <div key={club.id} className="p-8 hover:bg-slate-800/50 transition-colors group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                                <span className="text-2xl">🏠</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-purple-400 transition-colors">
                                                    {club.name}
                                                </h3>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                                                    {club.memberCount || 0} medlemmar · Skapad {new Date(club.createdAt).toLocaleDateString('sv-SE')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => alert(`Hantering av ${club.name} kommer snart!`)}
                                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-700"
                                            >
                                                Hantera
                                            </button>
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
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-10 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-8">
                            Skapa Ny Klubb
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                                    Klubbnamn
                                </label>
                                <input
                                    type="text"
                                    value={newClubName}
                                    onChange={(e) => setNewClubName(e.target.value)}
                                    placeholder="T.ex. OK Linné"
                                    className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-white font-bold placeholder-slate-700 transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setShowCreateClub(false)}
                                    className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-700"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleCreateClub}
                                    disabled={!newClubName.trim()}
                                    className="flex-1 px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-purple-900/40 disabled:opacity-50 disabled:shadow-none"
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
