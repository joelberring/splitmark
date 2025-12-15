/**
 * Push Notifications Service
 * Request permission and handle notifications
 */

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
    url?: string;
}

export class NotificationService {
    private permission: NotificationPermission = 'default';

    constructor() {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            this.permission = Notification.permission;
        }
    }

    /**
     * Check if notifications are supported
     */
    isSupported(): boolean {
        return typeof window !== 'undefined' && 'Notification' in window;
    }

    /**
     * Get current permission status
     */
    getPermission(): NotificationPermission {
        return this.permission;
    }

    /**
     * Request notification permission
     */
    async requestPermission(): Promise<NotificationPermission> {
        if (!this.isSupported()) {
            return 'denied';
        }

        this.permission = await Notification.requestPermission();
        return this.permission;
    }

    /**
     * Show a notification
     */
    async show(payload: NotificationPayload): Promise<boolean> {
        if (!this.isSupported() || this.permission !== 'granted') {
            console.log('Notifications not available');
            return false;
        }

        try {
            // Use service worker notification if available
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(payload.title, {
                    body: payload.body,
                    icon: payload.icon || '/icon-192.png',
                    badge: payload.badge || '/icon-192.png',
                    data: { ...payload.data, url: payload.url },
                    requireInteraction: true,
                } as NotificationOptions);
            } else {
                // Fallback to regular notification
                const notification = new Notification(payload.title, {
                    body: payload.body,
                    icon: payload.icon || '/icon-192.png',
                });

                if (payload.url) {
                    notification.onclick = () => {
                        window.open(payload.url, '_blank');
                        notification.close();
                    };
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to show notification:', error);
            return false;
        }
    }

    /**
     * Notify about new result
     */
    async notifyResult(params: {
        runnerName: string;
        className: string;
        position: number;
        time: string;
        eventName: string;
    }): Promise<void> {
        const positionEmoji = params.position === 1 ? '🥇' : params.position === 2 ? '🥈' : params.position === 3 ? '🥉' : '🏃';

        await this.show({
            title: `${positionEmoji} Nytt resultat!`,
            body: `${params.runnerName} - ${params.position}:a plats i ${params.className} (${params.time})`,
            data: { type: 'result', eventName: params.eventName },
        });
    }

    /**
     * Notify about upcoming event
     */
    async notifyUpcomingEvent(params: {
        eventName: string;
        date: string;
        daysUntil: number;
    }): Promise<void> {
        await this.show({
            title: '📅 Påminnelse',
            body: `${params.eventName} startar ${params.daysUntil === 0 ? 'idag' : params.daysUntil === 1 ? 'imorgon' : `om ${params.daysUntil} dagar`}!`,
            data: { type: 'event', eventName: params.eventName },
        });
    }

    /**
     * Notify about live tracking update
     */
    async notifyLiveUpdate(params: {
        runnerName: string;
        control: string;
        position: number;
    }): Promise<void> {
        await this.show({
            title: '📍 Live Update',
            body: `${params.runnerName} passerade kontroll ${params.control} (${params.position}:a)`,
            data: { type: 'live' },
        });
    }

    /**
     * Subscribe to push notifications via VAPID
     */
    async subscribeToPush(): Promise<PushSubscription | null> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Get VAPID public key from environment
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                console.warn('VAPID public key not configured');
                return null;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
            });

            // Send subscription to server
            // await fetch('/api/push/subscribe', {
            //   method: 'POST',
            //   body: JSON.stringify(subscription),
            // });

            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push:', error);
            return null;
        }
    }

    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }
}

// Export singleton
export const notificationService = new NotificationService();
