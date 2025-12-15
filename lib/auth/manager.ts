/**
 * Authentication Service
 * Persistent login with offline support for competitions
 */

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    updateProfile,
    type User,
    type UserCredential,
} from 'firebase/auth';
import { auth } from '../firebase';
import { db } from '../db';

export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    eventorId?: string;
}

export type UserRole = 'runner' | 'organizer' | 'admin';

/**
 * Authentication Manager
 * Handles persistent login state with offline fallback
 */
export class AuthManager {
    private currentUser: AuthUser | null = null;
    private authStateListeners: ((user: AuthUser | null) => void)[] = [];

    constructor() {
        // Set persistence to LOCAL (survives browser restarts)
        if (typeof window !== 'undefined' && auth) {
            // Check if Firebase is configured
            if (!auth.app) {
                console.warn('Firebase Auth not initialized - running in offline demo mode');
                this.restoreOfflineAuthState();
                return;
            }

            setPersistence(auth, browserLocalPersistence).catch(console.error);

            // Listen to auth state changes
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    await this.handleUserSignIn(user);
                } else {
                    await this.handleUserSignOut();
                }
            });

            // Restore offline auth state
            this.restoreOfflineAuthState();
        }
    }

    /**
     * Sign in with email and password
     */
    async signInWithEmail(email: string, password: string): Promise<AuthUser> {
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            return await this.handleUserSignIn(credential.user);
        } catch (error: any) {
            throw this.handleAuthError(error);
        }
    }

    /**
     * Sign up with email and password
     */
    async signUpWithEmail(
        email: string,
        password: string,
        displayName?: string
    ): Promise<AuthUser> {
        try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);

            // Update profile if displayName provided
            if (displayName && credential.user) {
                await updateProfile(credential.user, { displayName });
            }

            return await this.handleUserSignIn(credential.user);
        } catch (error: any) {
            throw this.handleAuthError(error);
        }
    }

    /**
     * Sign in with Google
     */
    async signInWithGoogle(): Promise<AuthUser> {
        try {
            const provider = new GoogleAuthProvider();
            // Request additional scopes if needed
            provider.addScope('profile');
            provider.addScope('email');

            const credential = await signInWithPopup(auth, provider);
            return await this.handleUserSignIn(credential.user);
        } catch (error: any) {
            throw this.handleAuthError(error);
        }
    }

    /**
     * Sign out
     */
    async signOut(): Promise<void> {
        try {
            await firebaseSignOut(auth);
            await this.handleUserSignOut();
        } catch (error: any) {
            console.error('Sign out error:', error);
            throw new Error('Misslyckades att logga ut');
        }
    }

    /**
     * Get current user (works offline)
     */
    getCurrentUser(): AuthUser | null {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.currentUser !== null;
    }

    /**
     * Check if user has specific role
     */
    hasRole(role: UserRole): boolean {
        return this.currentUser?.role === role;
    }

    /**
     * Subscribe to auth state changes
     */
    onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
        this.authStateListeners.push(callback);

        // Immediately call with current state
        callback(this.currentUser);

        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    /**
     * Update user role (admin only)
     */
    async updateUserRole(uid: string, role: UserRole): Promise<void> {
        if (!this.hasRole('admin')) {
            throw new Error('Endast administratörer kan ändra roller');
        }

        // Update in database
        await db.settings.update('default', {
            // Store user roles in settings for now
            // TODO: Move to Firestore for multi-user support
        });

        // If updating current user, refresh state
        if (this.currentUser?.uid === uid) {
            this.currentUser.role = role;
            this.notifyListeners();
            await this.saveOfflineAuthState();
        }
    }

    /**
     * Link Eventor account
     */
    async linkEventorAccount(eventorId: string): Promise<void> {
        if (!this.currentUser) {
            throw new Error('Inte inloggad');
        }

        this.currentUser.eventorId = eventorId;
        await this.saveOfflineAuthState();
        this.notifyListeners();
    }

    /**
     * Handle user sign in
     */
    private async handleUserSignIn(user: User): Promise<AuthUser> {
        // Determine user role (default to runner)
        const role = await this.getUserRole(user.uid);

        const authUser: AuthUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role,
        };

        this.currentUser = authUser;

        // Save to IndexedDB for offline access
        await this.saveOfflineAuthState();

        // Notify listeners
        this.notifyListeners();

        return authUser;
    }

    /**
     * Handle user sign out
     */
    private async handleUserSignOut(): Promise<void> {
        this.currentUser = null;

        // Clear offline auth state
        await this.clearOfflineAuthState();

        // Notify listeners
        this.notifyListeners();
    }

    /**
     * Get user role from database
     */
    private async getUserRole(uid: string): Promise<UserRole> {
        try {
            const settings = await db.settings.get('default');
            // TODO: Implement proper role storage
            // For now, check if it's the first user (make them admin)
            const userCount = 0; // await getUserCount()
            return userCount === 0 ? 'admin' : 'runner';
        } catch (error) {
            return 'runner';
        }
    }

    /**
     * Save auth state to IndexedDB (for offline use)
     */
    private async saveOfflineAuthState(): Promise<void> {
        if (!this.currentUser) return;

        try {
            await db.settings.put({
                id: 'auth_state',
                ...this.currentUser,
            } as any);
        } catch (error) {
            console.error('Failed to save offline auth state:', error);
        }
    }

    /**
     * Restore auth state from IndexedDB (offline fallback)
     */
    private async restoreOfflineAuthState(): Promise<void> {
        try {
            const authState = await db.settings.get('auth_state');
            if (authState && !this.currentUser) {
                this.currentUser = {
                    uid: authState.userId || '',
                    email: null,
                    displayName: null,
                    photoURL: null,
                    role: 'runner',
                };
                this.notifyListeners();
            }
        } catch (error) {
            console.error('Failed to restore offline auth state:', error);
        }
    }

    /**
     * Clear offline auth state
     */
    private async clearOfflineAuthState(): Promise<void> {
        try {
            await db.settings.delete('auth_state');
        } catch (error) {
            console.error('Failed to clear offline auth state:', error);
        }
    }

    /**
     * Notify all listeners of auth state change
     */
    private notifyListeners(): void {
        this.authStateListeners.forEach((listener) => {
            try {
                listener(this.currentUser);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    /**
     * Handle Firebase Auth errors
     */
    private handleAuthError(error: any): Error {
        const code = error.code || '';

        switch (code) {
            case 'auth/email-already-in-use':
                return new Error('E-postadressen används redan');
            case 'auth/invalid-email':
                return new Error('Ogiltig e-postadress');
            case 'auth/operation-not-allowed':
                return new Error('Inloggningsmetoden är inte aktiverad');
            case 'auth/weak-password':
                return new Error('Lösenordet är för svagt (minst 6 tecken)');
            case 'auth/user-disabled':
                return new Error('Kontot är inaktiverat');
            case 'auth/user-not-found':
                return new Error('Användaren finns inte');
            case 'auth/wrong-password':
                return new Error('Felaktigt lösenord');
            case 'auth/popup-closed-by-user':
                return new Error('Inloggning avbruten');
            case 'auth/network-request-failed':
                return new Error('Nätverksfel - kontrollera anslutningen');
            default:
                return new Error(error.message || 'Inloggning misslyckades');
        }
    }
}

// Export singleton instance
export const authManager = new AuthManager();

// Helper hooks for React components
export function useAuth() {
    if (typeof window === 'undefined') return null;
    return authManager;
}

/**
 * Session timeout warning
 * Firebase sessions last a long time by default, but we can implement
 * custom session management if needed
 */
export class SessionManager {
    private lastActivity: number = Date.now();
    private sessionTimeout: number = 7 * 24 * 60 * 60 * 1000; // 7 days
    private warningTime: number = 24 * 60 * 60 * 1000; // Warn 24h before expiry

    constructor() {
        if (typeof window !== 'undefined') {
            // Track user activity
            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach((event) => {
                window.addEventListener(event, () => this.updateActivity(), { passive: true });
            });

            // Check session periodically
            setInterval(() => this.checkSession(), 60000); // Every minute
        }
    }

    private updateActivity(): void {
        this.lastActivity = Date.now();
    }

    private checkSession(): void {
        const timeSinceActivity = Date.now() - this.lastActivity;

        if (timeSinceActivity > this.sessionTimeout) {
            // Session expired - could auto-logout
            console.warn('Session expired due to inactivity');
        } else if (timeSinceActivity > this.sessionTimeout - this.warningTime) {
            // Warn user about upcoming expiry
            console.log('Session will expire soon');
        }
    }

    getLastActivity(): Date {
        return new Date(this.lastActivity);
    }
}

export const sessionManager = new SessionManager();
