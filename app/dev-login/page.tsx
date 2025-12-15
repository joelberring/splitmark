'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DevUser {
    password: string;
    id: string;
    displayName: string;
    email: string;
    role: string;
    clubId?: string;
}

const DEV_USERS: Record<string, DevUser> = {
    'admin@orienteer.se': { password: 'admin123', id: 'dev-super-admin', displayName: 'Super Admin', email: 'admin@orienteer.se', role: 'super_admin' },
    'klubb@orienteer.se': { password: 'klubb123', id: 'dev-club-admin', displayName: 'Klubb Admin', email: 'klubb@orienteer.se', role: 'club_admin', clubId: 'demo-club' },
    'user@orienteer.se': { password: 'user123', id: 'dev-member', displayName: 'Test Användare', email: 'user@orienteer.se', role: 'member' },
};

export default function DevLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const user = DEV_USERS[email];
        if (!user || user.password !== password) {
            setError('Fel e-post eller lösenord');
            setLoading(false);
            return;
        }

        const devSession = {
            id: user.id, email: user.email, displayName: user.displayName,
            systemRole: user.role === 'super_admin' ? 'super_admin' : 'user',
            clubs: user.role === 'club_admin' && user.clubId ? { [user.clubId]: { role: 'club_admin', teams: [], trainedTeams: [], joinedAt: new Date().toISOString(), invitedBy: 'system' } } : {},
            eventRoles: {}, createdAt: new Date().toISOString(),
        };

        localStorage.setItem('dev-auth-user', JSON.stringify(devSession));
        localStorage.setItem(`user-roles-${user.id}`, JSON.stringify({ systemRole: devSession.systemRole, clubs: devSession.clubs, eventRoles: {} }));
        if (user.role === 'super_admin') localStorage.setItem('dev-super-admin-active', 'true');

        if (user.role === 'club_admin' && user.clubId) {
            const clubs = JSON.parse(localStorage.getItem('clubs') || '[]');
            if (!clubs.find((c: any) => c.id === user.clubId)) {
                clubs.push({ id: user.clubId, name: 'Demo Klubb', settings: {}, createdBy: user.id, createdAt: new Date().toISOString(), memberCount: 1 });
                localStorage.setItem('clubs', JSON.stringify(clubs));
            }
        }

        setTimeout(() => {
            router.push(user.role === 'super_admin' ? '/super-admin' : user.role === 'club_admin' ? '/admin' : '/');
        }, 500);
    };

    const quickLogin = (email: string, password: string) => { setEmail(email); setPassword(password); };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="max-w-md w-full">
                {/* Dev Warning */}
                <div className="bg-amber-600 text-black rounded-t-xl px-4 py-2 text-center text-xs font-bold uppercase tracking-widest">
                    ⚠️ DEV LOGIN - ENDAST FÖR UTVECKLING ⚠️
                </div>

                <div className="bg-slate-900 border border-slate-800 border-t-0 rounded-b-xl p-8">
                    <div className="text-center mb-6">
                        <span className="text-5xl opacity-50">🏃</span>
                        <h1 className="text-xl font-bold text-white mt-4 uppercase tracking-tight">OrienteerPro Dev Login</h1>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">E-post</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@orienteer.se" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Lösenord</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50">
                            {loading ? 'Loggar in...' : 'Logga in'}
                        </button>
                    </form>

                    {/* Quick Login */}
                    <div className="mt-8 pt-6 border-t border-slate-800">
                        <p className="text-xs text-slate-500 mb-4 text-center uppercase tracking-widest font-bold">Snabbinloggning</p>
                        <div className="grid gap-2">
                            <button onClick={() => quickLogin('admin@orienteer.se', 'admin123')} className="w-full px-4 py-3 bg-purple-900/30 text-purple-400 border border-purple-800/50 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2">
                                <span>👑</span> Super Admin
                            </button>
                            <button onClick={() => quickLogin('klubb@orienteer.se', 'klubb123')} className="w-full px-4 py-3 bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2">
                                <span>🏠</span> Klubb Admin
                            </button>
                            <button onClick={() => quickLogin('user@orienteer.se', 'user123')} className="w-full px-4 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                <span>👤</span> Vanlig Användare
                            </button>
                        </div>
                    </div>

                    {/* Credentials */}
                    <div className="mt-6 p-4 bg-slate-800 rounded-lg">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Test-konton:</p>
                        <div className="text-[10px] text-slate-500 space-y-1 font-mono">
                            <p>👑 admin@orienteer.se / admin123</p>
                            <p>🏠 klubb@orienteer.se / klubb123</p>
                            <p>👤 user@orienteer.se / user123</p>
                        </div>
                    </div>

                    <Link href="/" className="block text-center mt-6 text-slate-500 hover:text-emerald-400 text-xs font-bold uppercase tracking-widest">← Tillbaka</Link>
                </div>
            </div>
        </div>
    );
}
