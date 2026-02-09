/**
 * React Hooks for Permission Checking
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from './hooks';
import {
    checkPermission,
    getHighestRole,
    canInviteToClub,
    canCreateEvent,
    canManageTiming,
    isEventAdminRole,
    isEventAdmin,
} from './permissions';
import { registerKnownUserIdentity } from './event-admins';
import type { ClubMembershipKind, UserWithRoles, Action, ResourceType, PermissionResult } from '@/types/roles';

/**
 * Convert basic user to UserWithRoles
 * In production, fetch full role data from Firestore
 */
function normalizeMembershipKind(value: unknown): ClubMembershipKind {
    return value === 'training' ? 'training' : 'competition';
}

function normalizeClubMemberships(input: unknown): UserWithRoles['clubs'] {
    if (!input || typeof input !== 'object') return {};

    const next: UserWithRoles['clubs'] = {};
    for (const [clubId, membership] of Object.entries(input as Record<string, any>)) {
        if (!clubId || !membership || typeof membership !== 'object') continue;
        next[clubId] = {
            clubId,
            role: membership.role === 'club_admin' || membership.role === 'trainer' ? membership.role : 'member',
            membershipKind: normalizeMembershipKind(membership.membershipKind),
            teams: Array.isArray(membership.teams) ? membership.teams.filter(Boolean) : [],
            trainedTeams: Array.isArray(membership.trainedTeams) ? membership.trainedTeams.filter(Boolean) : [],
            joinedAt: new Date(membership.joinedAt || Date.now()),
            invitedBy: typeof membership.invitedBy === 'string' && membership.invitedBy.trim()
                ? membership.invitedBy.trim()
                : 'unknown',
        };
    }
    return next;
}

function enrichUserWithRoles(user: any): UserWithRoles | null {
    if (!user) return null;

    registerKnownUserIdentity({
        id: user.uid,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
    });

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
            clubs: normalizeClubMemberships(parsed.clubs),
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
                registerKnownUserIdentity({
                    id: parsed.id,
                    email: parsed.email || undefined,
                    displayName: parsed.displayName || undefined,
                });
                setFullUser({
                    id: parsed.id,
                    email: parsed.email || '',
                    displayName: parsed.displayName || 'Dev User',
                    photoURL: undefined,
                    systemRole: parsed.systemRole || 'user',
                    clubs: normalizeClubMemberships(parsed.clubs),
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

    const isOrganizer = !!user && isEventAdminRole(user.eventRoles[eventId]?.role);
    const isClubAdmin = user?.systemRole === 'super_admin' || user?.clubs[clubId]?.role === 'club_admin';
    const canEdit = !!user && isEventAdmin(user, eventId, clubId);

    return {
        loading,
        isOrganizer,
        isClubAdmin,
        canEdit,
        canManageTiming: user ? canManageTiming(user, eventId, clubId) : false,
        canUploadResults: canEdit,
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
        (
            targetUserId: string,
            clubId: string,
            role: 'club_admin' | 'trainer' | 'member',
            membershipKind?: ClubMembershipKind
        ) => {
            if (!isSuperAdmin && user?.clubs[clubId]?.role !== 'club_admin') {
                return { success: false, error: 'Ingen behörighet' };
            }

            // TODO: Update in Firestore
            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            const parsed = storedRoles ? JSON.parse(storedRoles) : { systemRole: 'user', clubs: {}, eventRoles: {} };

            parsed.clubs = parsed.clubs || {};

            const existingMembership = parsed.clubs?.[clubId];
            const currentKind = normalizeMembershipKind(existingMembership?.membershipKind);
            const nextKind = normalizeMembershipKind(membershipKind ?? existingMembership?.membershipKind);
            const isAddingNewClub = !existingMembership;
            const isKindChanging = !!existingMembership && !!membershipKind && nextKind !== currentKind;

            const otherMemberships = Object.entries(parsed.clubs as Record<string, any>)
                .filter(([existingClubId]) => existingClubId !== clubId);

            if (isAddingNewClub) {
                if (otherMemberships.length >= 2) {
                    return { success: false, error: 'Användaren kan bara vara medlem i max två klubbar.' };
                }
            }

            if (isAddingNewClub || isKindChanging) {
                const conflict = otherMemberships.find(([, membership]) =>
                    normalizeMembershipKind(membership?.membershipKind) === nextKind
                );
                if (conflict) {
                    return {
                        success: false,
                        error: nextKind === 'training'
                            ? 'Användaren har redan träningsmedlemskap i en annan klubb.'
                            : 'Användaren har redan tävlingsmedlemskap i en annan klubb.',
                    };
                }
            }

            parsed.clubs[clubId] = {
                ...(existingMembership || {}),
                clubId,
                role,
                membershipKind: nextKind,
                teams: Array.isArray(existingMembership?.teams) ? existingMembership.teams : [],
                trainedTeams: Array.isArray(existingMembership?.trainedTeams) ? existingMembership.trainedTeams : [],
                joinedAt: existingMembership?.joinedAt || new Date().toISOString(),
                invitedBy: existingMembership?.invitedBy || user?.id,
            };

            localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            return { success: true };
        },
        [user, isSuperAdmin]
    );

    const removeClubRole = useCallback(
        (targetUserId: string, clubId: string) => {
            if (!isSuperAdmin && user?.clubs[clubId]?.role !== 'club_admin') {
                return { success: false, error: 'Ingen behörighet' };
            }

            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            if (!storedRoles) {
                return { success: true };
            }

            const parsed = JSON.parse(storedRoles);
            if (parsed.clubs?.[clubId]) {
                delete parsed.clubs[clubId];
                localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            }

            return { success: true };
        },
        [user, isSuperAdmin]
    );

    const assignEventRole = useCallback(
        (targetUserId: string, eventId: string, clubId: string) => {
            const canManageRoles = !!user && isEventAdmin(user, eventId, clubId);
            if (!isSuperAdmin && !canManageRoles) {
                return { success: false, error: 'Ingen behörighet' };
            }

            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            const parsed = storedRoles ? JSON.parse(storedRoles) : { systemRole: 'user', clubs: {}, eventRoles: {} };

            parsed.eventRoles[eventId] = {
                role: 'event_admin',
                assignedBy: user?.id,
                assignedAt: new Date().toISOString(),
            };

            localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            return { success: true };
        },
        [user, isSuperAdmin]
    );

    const removeEventRole = useCallback(
        (targetUserId: string, eventId: string, clubId: string) => {
            const canManageRoles = !!user && isEventAdmin(user, eventId, clubId);
            if (!isSuperAdmin && !canManageRoles) {
                return { success: false, error: 'Ingen behörighet' };
            }

            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            if (!storedRoles) {
                return { success: true };
            }

            const parsed = JSON.parse(storedRoles);
            if (parsed.eventRoles?.[eventId]) {
                delete parsed.eventRoles[eventId];
                localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            }

            return { success: true };
        },
        [user, isSuperAdmin]
    );

    const assignSystemRole = useCallback(
        (targetUserId: string, systemRole: 'super_admin' | 'user') => {
            if (!isSuperAdmin) {
                return { success: false, error: 'Endast superadmin kan ändra systemroller' };
            }

            const storedRoles = localStorage.getItem(`user-roles-${targetUserId}`);
            const parsed = storedRoles ? JSON.parse(storedRoles) : { systemRole: 'user', clubs: {}, eventRoles: {} };
            parsed.systemRole = systemRole;
            localStorage.setItem(`user-roles-${targetUserId}`, JSON.stringify(parsed));
            return { success: true };
        },
        [isSuperAdmin]
    );

    return {
        assignClubRole,
        removeClubRole,
        assignEventRole,
        removeEventRole,
        assignSystemRole,
    };
}
