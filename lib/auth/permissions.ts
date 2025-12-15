/**
 * Permission Checking Service
 * Handles role-based access control for all resources
 */

import type {
    UserWithRoles,
    Action,
    ResourceType,
    PermissionResult,
    Club,
    Team,
    EventWithOwnership,
} from '@/types/roles';

type ResourceContext = {
    type: ResourceType;
    id: string;
    clubId?: string;
    teamId?: string;
    ownerId?: string;
};

/**
 * Check if user has permission to perform action on resource
 */
export function checkPermission(
    user: UserWithRoles | null,
    action: Action,
    resource: ResourceContext
): PermissionResult {
    // Not logged in
    if (!user) {
        // Only allow read on public resources
        if (action === 'read' && resource.type === 'event') {
            return { allowed: true };
        }
        return { allowed: false, reason: 'Inte inloggad' };
    }

    // Super admin has full access
    if (user.systemRole === 'super_admin') {
        return { allowed: true };
    }

    switch (resource.type) {
        case 'club':
            return checkClubPermission(user, action, resource.id);

        case 'event':
            return checkEventPermission(user, action, resource.id, resource.clubId);

        case 'team':
            return checkTeamPermission(user, action, resource.id, resource.clubId);

        case 'member':
            return checkMemberPermission(user, action, resource.id, resource.clubId, resource.teamId);

        case 'training':
        case 'track':
            return checkTrainingPermission(user, action, resource.ownerId, resource.clubId, resource.teamId);

        default:
            return { allowed: false, reason: 'Okänd resurstyp' };
    }
}

/**
 * Check club-level permissions
 */
function checkClubPermission(
    user: UserWithRoles,
    action: Action,
    clubId: string
): PermissionResult {
    const membership = user.clubs[clubId];

    // Not a member of this club
    if (!membership) {
        if (action === 'read') {
            return { allowed: true }; // Public club info
        }
        return { allowed: false, reason: 'Du är inte medlem i denna klubb' };
    }

    // Club admin can do everything in their club
    if (membership.role === 'club_admin') {
        return { allowed: true };
    }

    // Members and trainers
    switch (action) {
        case 'read':
            return { allowed: true };
        case 'invite':
        case 'manage_roles':
        case 'delete':
            return { allowed: false, reason: 'Endast klubbadmin kan utföra denna åtgärd' };
        default:
            return { allowed: false, reason: 'Åtgärden kräver klubbadmin-behörighet' };
    }
}

/**
 * Check event-level permissions
 */
function checkEventPermission(
    user: UserWithRoles,
    action: Action,
    eventId: string,
    clubId?: string
): PermissionResult {
    // Check if user is organizer for this event
    const eventRole = user.eventRoles[eventId];
    if (eventRole?.role === 'organizer') {
        return { allowed: true };
    }

    // Check if user is club admin for event's club
    if (clubId && user.clubs[clubId]?.role === 'club_admin') {
        return { allowed: true };
    }

    // Regular members
    switch (action) {
        case 'read':
            return { allowed: true };
        case 'manage_si':
        case 'upload_results':
            return { allowed: false, reason: 'Endast arrangörer kan hantera tidtagning' };
        case 'update':
        case 'delete':
            return { allowed: false, reason: 'Endast arrangörer eller klubbadmin kan ändra tävlingen' };
        default:
            return { allowed: false, reason: 'Du har inte behörighet för denna åtgärd' };
    }
}

/**
 * Check team-level permissions
 */
function checkTeamPermission(
    user: UserWithRoles,
    action: Action,
    teamId: string,
    clubId?: string
): PermissionResult {
    if (!clubId) {
        return { allowed: false, reason: 'Klubb-ID saknas' };
    }

    const membership = user.clubs[clubId];
    if (!membership) {
        return { allowed: false, reason: 'Du är inte medlem i klubben' };
    }

    // Club admin can manage all teams
    if (membership.role === 'club_admin') {
        return { allowed: true };
    }

    // Trainers can manage their teams
    if (membership.role === 'trainer' && membership.trainedTeams.includes(teamId)) {
        switch (action) {
            case 'read':
            case 'update':
            case 'view_training':
                return { allowed: true };
            case 'delete':
            case 'manage_roles':
                return { allowed: false, reason: 'Endast klubbadmin kan ta bort lag' };
            default:
                return { allowed: true };
        }
    }

    // Team members
    if (membership.teams.includes(teamId)) {
        if (action === 'read') {
            return { allowed: true };
        }
        return { allowed: false, reason: 'Du kan bara visa ditt lag, inte ändra' };
    }

    return { allowed: false, reason: 'Du har inte tillgång till detta lag' };
}

/**
 * Check member data permissions
 */
function checkMemberPermission(
    user: UserWithRoles,
    action: Action,
    memberId: string,
    clubId?: string,
    teamId?: string
): PermissionResult {
    // Own data - always allowed
    if (memberId === user.id) {
        return { allowed: true };
    }

    if (!clubId) {
        return { allowed: false, reason: 'Klubb-ID saknas' };
    }

    const membership = user.clubs[clubId];
    if (!membership) {
        return { allowed: false, reason: 'Du är inte medlem i klubben' };
    }

    // Club admin sees all
    if (membership.role === 'club_admin') {
        return { allowed: true };
    }

    // Trainer sees their team members
    if (membership.role === 'trainer' && teamId && membership.trainedTeams.includes(teamId)) {
        switch (action) {
            case 'read':
            case 'read_results':
            case 'view_training':
                return { allowed: true };
            default:
                return { allowed: false, reason: 'Tränare kan endast se, inte ändra medlemsdata' };
        }
    }

    // Regular member - only see self
    return { allowed: false, reason: 'Du kan endast se din egen data' };
}

/**
 * Check training data permissions
 */
function checkTrainingPermission(
    user: UserWithRoles,
    action: Action,
    ownerId?: string,
    clubId?: string,
    teamId?: string
): PermissionResult {
    // Own training data
    if (ownerId === user.id) {
        return { allowed: true };
    }

    // Check if trainer for owner's team
    if (clubId && teamId) {
        const membership = user.clubs[clubId];
        if (membership?.role === 'club_admin') {
            return { allowed: true };
        }
        if (membership?.role === 'trainer' && membership.trainedTeams.includes(teamId)) {
            if (action === 'read' || action === 'view_training') {
                return { allowed: true };
            }
        }
    }

    return { allowed: false, reason: 'Du har inte tillgång till denna träningsdata' };
}

/**
 * Get user's highest role for display
 */
export function getHighestRole(user: UserWithRoles): string {
    if (user.systemRole === 'super_admin') {
        return 'Super Admin';
    }

    const clubRoles = Object.values(user.clubs);
    if (clubRoles.some(m => m.role === 'club_admin')) {
        return 'Klubbadmin';
    }
    if (clubRoles.some(m => m.role === 'trainer')) {
        return 'Tränare';
    }
    if (Object.keys(user.eventRoles).length > 0) {
        return 'Arrangör';
    }
    if (clubRoles.length > 0) {
        return 'Medlem';
    }

    return 'Användare';
}

/**
 * Check if user can invite to club
 */
export function canInviteToClub(user: UserWithRoles, clubId: string): boolean {
    if (user.systemRole === 'super_admin') return true;
    return user.clubs[clubId]?.role === 'club_admin';
}

/**
 * Check if user can create events for club
 */
export function canCreateEvent(user: UserWithRoles, clubId: string): boolean {
    if (user.systemRole === 'super_admin') return true;
    const role = user.clubs[clubId]?.role;
    return role === 'club_admin' || role === 'trainer';
}

/**
 * Check if user can manage SportIdent for event
 */
export function canManageTiming(user: UserWithRoles, eventId: string, clubId: string): boolean {
    if (user.systemRole === 'super_admin') return true;
    if (user.clubs[clubId]?.role === 'club_admin') return true;
    return user.eventRoles[eventId]?.role === 'organizer';
}
