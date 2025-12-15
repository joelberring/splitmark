/**
 * Event and Club Configuration Types
 * For competition administrators to manage Eventor API keys per club
 */

import type { DBEvent } from './database';

export interface ClubConfiguration {
    id: string;
    clubName: string;
    clubId: string; // Eventor organisation ID
    eventorApiKey: string; // Club-specific API key
    createdBy: string; // User ID who added it
    createdAt: Date;
    lastUsed?: Date;
}

export interface EventConfiguration extends DBEvent {
    clubConfig?: ClubConfiguration;
    adminUsers: string[]; // User IDs with admin access to this event
    allowedRoles: ('admin' | 'organizer')[]; // Who can manage this event
}

// Extend UserSettings to include club memberships
export interface UserClubMembership {
    clubId: string;
    clubName: string;
    role: 'member' | 'organizer' | 'admin';
    eventorApiKey?: string; // Optional: user's personal key for their club
}
