'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authManager } from '@/lib/auth/manager';

type Mode = 'login' | 'register';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (mode === 'register') {
                // Validate passwords match
                if (password !== confirmPassword) {
                    setError('Lösenorden matchar inte');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Lösenordet måste vara minst 6 tecken');
                    setLoading(false);
                    return;
                }

                await authManager.signUpWithEmail(email, password, displayName);
                setSuccess('Konto skapat! Du kan nu logga in.');
                setMode('login');
            } else {
                await authManager.signInWithEmail(email, password);
                router.push('/');
            }
        } catch (err: any) {
            setError(err.message || 'Något gick fel');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        try {
            localStorage.setItem('demoUser', JSON.stringify({
                uid: 'demo-user',
                email: 'demo@splitmark.se',
                displayName: 'Demo Användare',
            }));
            router.push('/');
        } catch (err) {
            setError('Demo-inloggning misslyckades');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white">
            {/* Hero Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-20"
                style={{ backgroundImage: `url('/hero-bg.png')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />

            {/* Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-7 h-7 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" />
                        </svg>
                    </div>
                    <span className="text-3xl font-bold text-white">Splitmark</span>
                </div>

                <h1 className="text-2xl font-bold uppercase tracking-wider text-center mb-2">
                    {mode === 'login' ? 'Logga in' : 'Skapa konto'}
                </h1>
                <p className="text-slate-400 text-center mb-6 max-w-xs">
                    {mode === 'login'
                        ? 'Logga in för att anmäla dig till tävlingar och se resultat.'
                        : 'Registrera dig för att komma igång med Splitmark.'}
                </p>

                {/* Error */}
                {error && (
                    <div className="w-full max-w-sm bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-4 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className="w-full max-w-sm bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-4 mb-4 text-center">
                        <p className="text-emerald-400 text-sm">{success}</p>
                    </div>
                )}

                {/* Email Login Form */}
                <form onSubmit={handleEmailLogin} className="w-full max-w-sm space-y-4 mb-6">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Namn
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ditt namn"
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            E-post
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="din@epost.se"
                            required
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Lösenord
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                    </div>

                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Bekräfta lösenord
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                        {loading
                            ? '...'
                            : mode === 'login'
                                ? 'Logga in'
                                : 'Skapa konto'}
                    </button>
                </form>

                {/* Toggle mode */}
                <button
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError('');
                        setSuccess('');
                    }}
                    className="text-emerald-400 hover:text-emerald-300 text-sm mb-6"
                >
                    {mode === 'login'
                        ? 'Har du inget konto? Registrera dig'
                        : 'Har du redan ett konto? Logga in'}
                </button>

                {/* Divider */}
                <div className="w-full max-w-sm flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-slate-700"></div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">eller</span>
                    <div className="flex-1 h-px bg-slate-700"></div>
                </div>

                {/* Demo Login */}
                <div className="w-full max-w-sm">
                    <button
                        onClick={handleDemoLogin}
                        disabled={loading}
                        className="w-full px-6 py-4 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        🧪 Testa utan konto
                    </button>
                </div>

                {/* Back Link */}
                <Link
                    href="/"
                    className="mt-8 text-slate-500 hover:text-emerald-400 text-sm uppercase tracking-wider transition-colors"
                >
                    ← Tillbaka till startsidan
                </Link>
            </div>
        </div>
    );
}
