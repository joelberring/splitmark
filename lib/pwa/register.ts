/**
 * Service Worker Registration
 * Register and manage Service Worker lifecycle
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });

        console.log('Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
            registration.update();
        }, 60 * 60 * 1000); // Every hour

        // Listen for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    console.log('New Service Worker available');
                    showUpdateNotification();
                }
            });
        });

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'SYNC_REQUEST') {
                // Trigger sync
                handleSyncRequest();
            }
        });

        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

function showUpdateNotification() {
    if (confirm('En ny version av appen är tillgänglig. Vill du uppdatera?')) {
        window.location.reload();
    }
}

async function handleSyncRequest() {
    // Import sync manager and trigger sync
    const { syncManager } = await import('../sync/manager');
    try {
        await syncManager.syncAll();
        console.log('Background sync completed');
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

/**
 * Unregister service worker (for development)
 */
export async function unregisterServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
        await registration.unregister();
    }

    console.log('Service Worker unregistered');
}

/**
 * Check if app is installable
 */
export function checkInstallable(): boolean {
    return 'BeforeInstallPromptEvent' in window;
}

/**
 * Prompt PWA install
 */
let deferredPrompt: any = null;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });
}

export async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) {
        return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    deferredPrompt = null;

    return outcome === 'accepted';
}
