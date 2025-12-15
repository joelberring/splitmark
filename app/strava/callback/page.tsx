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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                {status === 'loading' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Ansluter till Strava...
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Vänta medan vi kopplar ditt konto
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Strava ansluten!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Du kan nu exportera dina spår direkt till Strava
                        </p>
                        <p className="text-sm text-gray-500">
                            Omdirigerar till din profil...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Något gick fel
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {error}
                        </p>
                        <button
                            onClick={() => router.push('/profile')}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                        >
                            Tillbaka till profil
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
