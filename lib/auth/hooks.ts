'use client';

import { useEffect, useState } from 'react';
import { authManager, type AuthUser } from './manager';

/**
 * React hook for authentication state
 * Supports dev-login bypass for development without Firebase
 */
export function useAuthState() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // First check for dev-auth-user (development login bypass)
        if (typeof window !== 'undefined') {
            const devUser = localStorage.getItem('dev-auth-user');
            if (devUser) {
                try {
                    const parsed = JSON.parse(devUser);
                    setUser({
                        uid: parsed.id,
                        email: parsed.email,
                        displayName: parsed.displayName,
                        photoURL: null,
                        role: parsed.systemRole === 'super_admin' ? 'admin' : 'runner',
                    });
                    setLoading(false);
                    return;
                } catch (e) {
                    // Invalid dev user, continue with Firebase
                }
            }
        }

        // Fall back to Firebase auth
        try {
            const unsubscribe = authManager.onAuthStateChange((newUser) => {
                setUser(newUser);
                setLoading(false);
            });
            return unsubscribe;
        } catch (e) {
            // Firebase not configured, just set loading to false
            setLoading(false);
        }
    }, []);

    return { user, loading, isAuthenticated: !!user };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo: string = '/login') {
    const { user, loading } = useAuthState();

    useEffect(() => {
        if (!loading && !user) {
            window.location.href = redirectTo;
        }
    }, [user, loading, redirectTo]);

    return { user, loading };
}

/**
 * Hook to check user role
 */
export function useUserRole() {
    const { user } = useAuthState();

    return {
        role: user?.role,
        isAdmin: user?.role === 'admin',
        isOrganizer: user?.role === 'organizer',
        isRunner: user?.role === 'runner',
    };
}
