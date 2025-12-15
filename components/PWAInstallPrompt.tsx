'use client';

import { useState, useEffect } from 'react';
import { promptInstall } from '@/lib/pwa/register';

export default function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return; // Already installed
        }

        // Listen for install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Show prompt after 30 seconds
            setTimeout(() => {
                setShowPrompt(true);
            }, 30000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        const installed = await promptInstall();

        if (installed) {
            setShowPrompt(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Don't show again for 7 days
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    };

    if (!showPrompt || !deferredPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border-2 border-emerald-500 animate-slide-up z-50">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Stäng"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-2xl">
                    📱
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">
                        Installera Splitmark
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Få snabbare åtkomst och fungera offline genom att installera appen
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={handleInstall}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg text-sm"
                        >
                            Installera
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                        >
                            Inte nu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
