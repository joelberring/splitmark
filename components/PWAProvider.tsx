'use client';

import { useEffect } from 'react';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Register Service Worker for PWA
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            import('@/lib/pwa/register').then(({ registerServiceWorker }) => {
                registerServiceWorker();
            });
        }
    }, []);

    return <>{children}</>;
}
