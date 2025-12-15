/**
 * React Hooks for Permission Checking
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from './hooks';
import { checkPermission, getHighestRole, canInviteToClub, canCreateEvent, canManageTiming } from './permissions';
import type { UserWithRoles, Action, ResourceType, PermissionResult } from '@/types/roles';

/**
 * Convert basic user to UserWithRoles
 * In production, fetch full role data from Firestore
 */
function enrichUserWithRoles(user: any): UserWithRoles | null {
    if (!user) return null;

    // For now, get from localStorage or default
    const storedRoles = typeof window !== 'undefined'
        ? localStorage.getItem(`user-roles-${user.uid}`)
        : null;

    if (storedRoles) {
        const parsed = JSON.parse(storedRoles);
        return {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Användare',
            photoURL: user.photoURL,
            systemRole: parsed.systemRole || 'user',
            clubs: parsed.clubs || {},
            eventRoles: parsed.eventRoles || {},
            createdAt: new Date(parsed.createdAt || Date.now()),
            lastLoginAt: new Date(),
        };
    }

    // Default user with no special roles
    return {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Användare',
        photoURL: user.photoURL,
        systemRole: 'user',
        clubs: {},
        eventRoles: {},
        createdAt: new Date(),
        lastLoginAt: new Date(),
    };
}

/**
 * Hook to get user with full role information
 */
export function useUserWithRoles(): {
    user: UserWithRoles | null;
    loading: boolean;
    highestRole: string;
} {
    const { user: basicUser, loading } = useAuthState();
    const [fullUser, setFullUser] = useState<UserWithRoles | null>(null);

    useEffect(() => {
        // First check for dev-auth-user (development login)
        if (typeof window !== 'undefined') {
            const devUser = localStorage.getItem('dev-auth-user');
            if (devUser) {
                const parsed = JSON.parse(devUser);
                setFullUser({
                    id: parsed.id,
                    email: parsed.email || '',
                    displayName: parsed.displayName || 'Dev User',
                    photoURL: undefined,
                    systemRole: parsed.systemRole || 'user',
                    clubs: parsed.clubs || {},
                    eventRoles: parsed.eventRoles || {},
                    createdAt: new Date(parsed.createdAt || Date.now()),
                    lastLoginAt: new Date(),
                });
                return;
            }
        }

        if (basicUser) {
            // TODO: In production, fetch from Firestore
            const enriched = enrichUserWithRoles(basicUser);
            setFullUser(enriched);
        } else {
            setFullUser(null);
        }
    }, [basicUser]);

    return {
        user: fullUser,
        loading,
        highestRole: fullUser ? getHighestRole(fullUser) : 'Gäst',
    };
}

/**
 * Hook to check permission for a specific action
 */
export function usePermission(
    action: Action,
    resourceType: ResourceType,
    resourceId: string,
    options?: {
        clubId?: string;
        teamId?: string;
        ownerId?: string;
    }
): PermissionResult & { loading: boolean } {
    const { user, loading } = useUserWithRoles();

    if (loading) {
        return { allowed: false, loading: true };
    }

    const result = checkPermission(user, action, {
        type: resourceType,
        id: resourceId,
        ...options,
    });

    return { ...result, loading: false };
}

/**
 * Hook for club-specific permissions
 */
export function useClubPermissions(clubId: string) {
    const { user, loading } = useUserWithRoles();

    const membership = user?.clubs[clubId];

    return {
        loading,
        isClubAdmin: user?.systemRole === 'super_admin' || membership?.role === 'club_admin',
        isTrainer: membership?.role === 'trainer',
        isMember: !!membership,
        canInvite: user ? canInviteToClub(user, clubId) : false,
        canCreateEvent: user ? canCreateEvent(user, clubId) : false,
        role: membership?.role,
        teams: membership?.teams || [],
        trainedTeams: membership?.trainedTeams || [],
    };
}

/**
 * Hook for event-specific permissions
 */
export function useEventPermissions(eventId: string, clubId: string) {
    const { user, loading } = useUserWithRoles();

    const isOrganizer = user?.eventRoles[eventId]?.role === 'organizer';
    const isClubAdmin = user?.systemRole === 'super_admin' || user?.clubs[clubId]?.role === 'club_admin';

    return {
        loading,
        isOrganizer,
        isClubAdmin,
        canEdit: isOrganizer || isClubAdmin,
        canManageTiming: user ? canManageTiming(user, eventId, clubId) : false,
        canUploadResults: isOrganizer || isClubAdmin,
    };
}

/**
 * Hook for super admin check
 */
export function useSuperAdmin() {
    const { user, loading } = useUserWithRoles();

    return {
        loading,
        isSuperAdmin: user?.systemRole === 'super_admin',
    };
}

/**
 * Hook to set up a user as super admin (for initial setup)
 */
export function useSetupSuperAdmin() {
    const { user } = useUserWithRoles();

    const setupAsSuperAdmin = useCallback(() => {
        if (!user) return false;

        const roles: Partial<UserWithRoles> = {
            systemRole: 'super_admin',
            clubs: {},
            eventRoles: {},
        };

        localStorage.setItem(`user-roles-${user.id}`, JSON.stringify(roles));
        window.location.reload();
        return true;
    }, [user]);

    return { setupAsSuperAdmin };
}

/**
 * Hook to manage user roles (for admins)
 */
export function useRoleManagement() {
    const { user } = useUserWithRoles();
    const { isSuperAdmin } = useSuperAdmin();

    const assignClubRole = useCallback(
        (targetUserId: string, clubId: string, role: 'club_admin' | 'trainer' | 'member') => {
            if (!isSuperAdmin && user?.clubs[clubId]?.role !== 'club_admin') {
                return { success: false, error: 'Ingen behörighet' };
            }

            // TODO: Update in Firestore
            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            const parsed = storedRoles ? JSON.parse(storedRoles) : { systemRole: 'user', clubs: {}, eventRoles: {} };

            parsed.clubs[clubId] = {
                role,
                teams: [],
                trainedTeams: [],
                joinedAt: new Date().toISOString(),
                invitedBy: user?.id,
            };

            localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            return { success: true };
        },
        [user, isSuperAdmin]
    );

    const assignEventRole = useCallback(
        (targetUserId: string, eventId: string, clubId: string) => {
            if (!isSuperAdmin && user?.clubs[clubId]?.role !== 'club_admin') {
                return { success: false, error: 'Ingen behörighet' };
            }

            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            const parsed = storedRoles ? JSON.parse(storedRoles) : { systemRole: 'user', clubs: {}, eventRoles: {} };

            parsed.eventRoles[eventId] = {
                role: 'organizer',
                assignedBy: user?.id,
                assignedAt: new Date().toISOString(),
            };

            localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            return { success: true };
        },
        [user, isSuperAdmin]
    );

    return {
        assignClubRole,
        assignEventRole,
    };
}
