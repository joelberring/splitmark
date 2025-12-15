'use client';

import { useState, useEffect } from 'react';
import { notificationService } from '@/lib/notifications/service';

export default function NotificationPrompt() {
    const [show, setShow] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (!notificationService.isSupported()) return;

        const currentPermission = notificationService.getPermission();
        setPermission(currentPermission);

        // Show prompt if permission is default and user hasn't dismissed
        if (currentPermission === 'default') {
            const dismissed = localStorage.getItem('notification-prompt-dismissed');
            if (!dismissed) {
                setTimeout(() => setShow(true), 10000); // Show after 10 seconds
            }
        }
    }, []);

    const handleAllow = async () => {
        const result = await notificationService.requestPermission();
        setPermission(result);
        setShow(false);

        if (result === 'granted') {
            // Show welcome notification
            await notificationService.show({
                title: '🎉 Notifieringar aktiverade!',
                body: 'Du kommer nu få uppdateringar om resultat och tävlingar.',
            });
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('notification-prompt-dismissed', 'true');
        setShow(false);
    };

    if (!show || permission !== 'default') return null;

    return (
        <div className="fixed top-4 right-4 max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border-2 border-blue-500 z-50 animate-slide-in">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <span className="text-gray-500">✕</span>
            </button>

            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl">
                    🔔
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">
                        Aktivera notifieringar?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Få uppdateringar om resultat, live-tracking och tävlingar
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={handleAllow}
                            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors text-sm"
                        >
                            Aktivera
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
