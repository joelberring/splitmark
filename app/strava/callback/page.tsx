'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { stravaClient } from '@/lib/strava/client';

function StravaCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState('');

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setStatus('error');
            setError('Authorization denied');
            return;
        }

        if (!code) {
            setStatus('error');
            setError('No authorization code received');
            return;
        }

        // Exchange code for token
        stravaClient.exchangeToken(code)
            .then((data) => {
                // Store tokens in localStorage (in production, use secure storage)
                localStorage.setItem('strava_access_token', data.access_token);
                localStorage.setItem('strava_refresh_token', data.refresh_token);
                localStorage.setItem('strava_expires_at', data.expires_at.toString());
                localStorage.setItem('strava_athlete', JSON.stringify(data.athlete));

                setStatus('success');

                // Redirect to profile after 2 seconds
                setTimeout(() => {
                    router.push('/profile');
                }, 2000);
            })
            .catch((err) => {
                setStatus('error');
                setError(err.message);
            });
    }, [searchParams, router]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-10 relative z-10 text-center">
                {status === 'loading' && (
                    <div className="space-y-8">
                        <div className="relative w-20 h-20 mx-auto">
                            <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                Ansluter Strava
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-relaxed">
                                Vi verifierar din anslutning. Vänta ett ögonblick...
                            </p>
                        </div>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-8">
                        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-4xl">🚀</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                Klart!
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 mb-6">
                                Ditt Strava-konto är nu anslutet
                            </p>
                            <p className="text-xs font-bold text-slate-400 mb-10 leading-relaxed">
                                Dina aktiviteter kommer nu synkroniseras automatiskt till ditt flöde.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/profile')}
                            className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-900/40"
                        >
                            Tillbaka till Profil
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-8">
                        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-4xl">⚠️</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                Något gick fel
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-500/80 mb-6">
                                {error || 'Kunde inte ansluta till Strava'}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/profile')}
                            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-slate-700"
                        >
                            Försök igen
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function StravaCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500"></div>
            </div>
        }>
            <StravaCallbackContent />
        </Suspense>
    );
}
