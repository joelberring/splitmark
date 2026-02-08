/**
 * Role and Permission Types
 */

// System-level role (platform-wide)
export type SystemRole = 'super_admin' | 'user';

// Club-level role (per club)
export type ClubRole = 'club_admin' | 'trainer' | 'member';

// Event-level role (per event)
// Keep "organizer" for backward compatibility with already stored role data.
export type EventRole = 'event_admin' | 'organizer';

// Resource types for permission checking
export type ResourceType = 'club' | 'event' | 'team' | 'member' | 'training' | 'track';

// Actions that can be performed
export type Action =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'invite'
    | 'manage_roles'
    | 'read_results'
    | 'upload_results'
    | 'manage_si'
    | 'view_training';

// User's club membership
export interface ClubMembership {
    clubId: string;
    role: ClubRole;
    teams: string[]; // Team IDs user belongs to
    trainedTeams: string[]; // Team IDs user trains (if trainer)
    joinedAt: Date;
    invitedBy: string; // User ID who invited
}

// User's event roles
export interface EventRoleAssignment {
    eventId: string;
    role: EventRole;
    assignedBy: string;
    assignedAt: Date;
}

// Extended User type with roles
export interface UserWithRoles {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;

    // System-level role
    systemRole: SystemRole;

    // Club memberships
    clubs: Record<string, ClubMembership>;

    // Event roles
    eventRoles: Record<string, EventRoleAssignment>;

    // Metadata
    createdAt: Date;
    lastLoginAt: Date;
}

// Club entity
export interface Club {
    id: string;
    name: string;
    shortName?: string; // "OK Linné" -> "OKL"
    eventorOrgId?: string;
    logo?: string;

    // Settings (encrypted in production)
    settings: {
        eventorApiKey?: string;
        gokartorUsername?: string;
        gokartorPassword?: string;
    };

    // Metadata
    createdBy: string; // Super admin
    createdAt: Date;
    memberCount: number;
}

// Team entity
export interface Team {
    id: string;
    clubId: string;
    name: string; // "D16", "Veteraner 50+", "Elit herrar"
    description?: string;
    trainers: string[]; // User IDs
    members: string[]; // User IDs
    createdAt: Date;
}

// Event with ownership
export interface EventWithOwnership {
    id: string;
    clubId: string;
    name: string;
    organizers: string[]; // User IDs with organizer role
    visibility: 'draft' | 'club_only' | 'public';
    createdBy: string;
    createdAt: Date;
}

// Invitation
export interface Invitation {
    id: string;
    email: string;
    clubId: string;
    role: ClubRole;
    token: string;
    invitedBy: string;
    expiresAt: Date;
    usedAt?: Date;
}

// Permission check result
export interface PermissionResult {
    allowed: boolean;
    reason?: string;
}

// Club membership request
export interface ClubMembershipRequest {
    id: string;
    clubId: string;
    userId: string;
    message?: string;
    requestedAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'blocked';
    processedBy?: string;
    processedAt?: Date;
    rejectionReason?: string;
}
