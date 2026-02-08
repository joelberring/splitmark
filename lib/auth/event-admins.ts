import type { UserWithRoles } from '@/types/roles';
import { isEventAdminRole } from './permissions';

const USER_ROLES_PREFIX = 'user-roles-';
const USER_DIRECTORY_KEY = 'user-directory';

interface StoredUserRoles {
    systemRole?: string;
    clubs?: Record<string, { role?: string }>;
    eventRoles?: Record<string, { role?: string; assignedBy?: string; assignedAt?: string }>;
    createdAt?: string;
}

export interface EventAdminEventRef {
    id: string;
    clubId?: string;
    createdBy?: string;
    eventAdminIds?: string[];
}

export interface KnownRoleUser {
    id: string;
    email?: string;
    displayName?: string;
}

const DEV_USER_DIRECTORY: KnownRoleUser[] = [
    {
        id: 'dev-super-admin',
        email: 'admin@orienteer.se',
        displayName: 'Super Admin',
    },
    {
        id: 'dev-club-admin',
        email: 'klubb@orienteer.se',
        displayName: 'Klubb Admin',
    },
    {
        id: 'dev-member',
        email: 'user@orienteer.se',
        displayName: 'Test Användare',
    },
];

function mergeKnownUser(target: KnownRoleUser, source: Partial<KnownRoleUser>): KnownRoleUser {
    return {
        id: target.id,
        email: target.email || source.email,
        displayName: target.displayName || source.displayName,
    };
}

function parseJson<T>(value: string | null): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

function readStoredRoles(userId: string): StoredUserRoles {
    if (!isBrowser()) {
        return { systemRole: 'user', clubs: {}, eventRoles: {} };
    }

    const parsed = parseJson<StoredUserRoles>(localStorage.getItem(`${USER_ROLES_PREFIX}${userId}`));

    return {
        systemRole: parsed?.systemRole || 'user',
        clubs: parsed?.clubs || {},
        eventRoles: parsed?.eventRoles || {},
        createdAt: parsed?.createdAt,
    };
}

function writeStoredRoles(userId: string, roles: StoredUserRoles): void {
    if (!isBrowser()) return;
    localStorage.setItem(`${USER_ROLES_PREFIX}${userId}`, JSON.stringify(roles));
}

function getProfileClubId(): string | undefined {
    if (!isBrowser()) return undefined;
    const profile = parseJson<{ clubId?: string }>(localStorage.getItem('userProfile'));
    const clubId = profile?.clubId?.trim();
    return clubId || undefined;
}

function getStoredUserDirectory(): KnownRoleUser[] {
    if (!isBrowser()) return [];
    const parsed = parseJson<KnownRoleUser[]>(localStorage.getItem(USER_DIRECTORY_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed
        .filter((entry) => !!entry?.id?.trim())
        .map((entry) => ({
            id: entry.id.trim(),
            email: entry.email?.trim() || undefined,
            displayName: entry.displayName?.trim() || undefined,
        }));
}

function saveStoredUserDirectory(users: KnownRoleUser[]): void {
    if (!isBrowser()) return;
    const dedupedById = new Map<string, KnownRoleUser>();
    for (const user of users) {
        if (!user.id?.trim()) continue;
        const existing = dedupedById.get(user.id);
        if (existing) {
            dedupedById.set(user.id, mergeKnownUser(existing, user));
        } else {
            dedupedById.set(user.id, {
                id: user.id.trim(),
                email: user.email?.trim() || undefined,
                displayName: user.displayName?.trim() || undefined,
            });
        }
    }
    localStorage.setItem(USER_DIRECTORY_KEY, JSON.stringify(Array.from(dedupedById.values())));
}

export function registerKnownUserIdentity(user: KnownRoleUser): void {
    if (!isBrowser() || !user.id?.trim()) return;

    const existingUsers = getStoredUserDirectory();
    const usersById = new Map(existingUsers.map((entry) => [entry.id, entry]));
    const current = usersById.get(user.id) || { id: user.id.trim() };
    usersById.set(user.id.trim(), mergeKnownUser(current, {
        id: user.id.trim(),
        email: user.email?.trim() || undefined,
        displayName: user.displayName?.trim() || undefined,
    }));

    saveStoredUserDirectory(Array.from(usersById.values()));
}

export function getStoredRoleUserIds(): string[] {
    if (!isBrowser()) return [];

    const userIds = new Set<string>();
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(USER_ROLES_PREFIX)) continue;
        const userId = key.slice(USER_ROLES_PREFIX.length).trim();
        if (userId) {
            userIds.add(userId);
        }
    }

    return Array.from(userIds);
}

export function getClubAdminUserIds(clubId?: string): string[] {
    if (!clubId || !isBrowser()) return [];

    const clubAdminIds = new Set<string>();
    for (const userId of getStoredRoleUserIds()) {
        const roles = readStoredRoles(userId);
        if (roles.clubs?.[clubId]?.role === 'club_admin') {
            clubAdminIds.add(userId);
        }
    }

    return Array.from(clubAdminIds);
}

export function assignEventAdminRole(
    targetUserId: string,
    eventId: string,
    assignedByUserId: string
): boolean {
    const userId = targetUserId.trim();
    if (!userId || !eventId.trim()) {
        return false;
    }

    const roles = readStoredRoles(userId);
    const existingRole = roles.eventRoles?.[eventId]?.role;
    if (isEventAdminRole(existingRole)) {
        return true;
    }

    roles.eventRoles = roles.eventRoles || {};
    roles.eventRoles[eventId] = {
        role: 'event_admin',
        assignedBy: assignedByUserId,
        assignedAt: new Date().toISOString(),
    };
    writeStoredRoles(userId, roles);
    return true;
}

export function removeEventAdminRole(targetUserId: string, eventId: string): boolean {
    const userId = targetUserId.trim();
    if (!userId || !eventId.trim()) {
        return false;
    }

    const roles = readStoredRoles(userId);
    if (!roles.eventRoles?.[eventId]) {
        return true;
    }

    delete roles.eventRoles[eventId];
    writeStoredRoles(userId, roles);
    return true;
}

export function initializeEventAdminsForNewEvent(params: {
    eventId: string;
    createdBy?: string;
    clubId?: string;
}): string[] {
    const adminIds = new Set<string>();
    const creatorId = params.createdBy?.trim();

    if (creatorId && creatorId !== 'unknown') {
        adminIds.add(creatorId);
    }

    for (const clubAdminId of getClubAdminUserIds(params.clubId)) {
        adminIds.add(clubAdminId);
    }

    const assignedBy = creatorId && creatorId !== 'unknown' ? creatorId : 'system';
    for (const adminId of adminIds) {
        assignEventAdminRole(adminId, params.eventId, assignedBy);
    }

    return Array.from(adminIds);
}

export function resolveEventAdminIds(event: EventAdminEventRef): string[] {
    const adminIds = new Set<string>();

    for (const adminId of event.eventAdminIds || []) {
        if (adminId?.trim()) {
            adminIds.add(adminId.trim());
        }
    }

    const creatorId = event.createdBy?.trim();
    if (creatorId && creatorId !== 'unknown') {
        adminIds.add(creatorId);
    }

    for (const clubAdminId of getClubAdminUserIds(event.clubId)) {
        adminIds.add(clubAdminId);
    }

    for (const userId of getStoredRoleUserIds()) {
        const role = readStoredRoles(userId).eventRoles?.[event.id]?.role;
        if (isEventAdminRole(role)) {
            adminIds.add(userId);
        }
    }

    return Array.from(adminIds);
}

export function persistEventAdminIds(eventId: string, eventAdminIds: string[]): void {
    if (!isBrowser()) return;

    const events = parseJson<Array<Record<string, unknown>>>(localStorage.getItem('events')) || [];
    const nextAdminIds = Array.from(
        new Set(eventAdminIds.map(id => id.trim()).filter(Boolean))
    );

    const eventIndex = events.findIndex(event => event.id === eventId);
    if (eventIndex === -1) return;

    events[eventIndex] = {
        ...events[eventIndex],
        eventAdminIds: nextAdminIds,
    };

    localStorage.setItem('events', JSON.stringify(events));
}

export function getPreferredClubIdForUser(user: UserWithRoles | null): string | undefined {
    if (!user) return getProfileClubId();

    const profileClubId = getProfileClubId();
    const clubIds = Object.keys(user.clubs || {});
    const clubAdminIds = clubIds.filter(clubId => user.clubs[clubId]?.role === 'club_admin');

    if (profileClubId && user.clubs[profileClubId]) {
        return profileClubId;
    }

    if (clubAdminIds.length > 0) {
        return clubAdminIds[0];
    }

    if (clubIds.length > 0) {
        return clubIds[0];
    }

    return profileClubId;
}

export function getKnownRoleUsers(): KnownRoleUser[] {
    const usersById = new Map<string, KnownRoleUser>();

    for (const devUser of DEV_USER_DIRECTORY) {
        usersById.set(devUser.id, devUser);
    }

    if (isBrowser()) {
        for (const directoryUser of getStoredUserDirectory()) {
            const existing = usersById.get(directoryUser.id) || { id: directoryUser.id };
            usersById.set(directoryUser.id, mergeKnownUser(existing, directoryUser));
        }

        const devAuthUser = parseJson<{ id?: string; email?: string; displayName?: string }>(
            localStorage.getItem('dev-auth-user')
        );

        if (devAuthUser?.id) {
            const existing = usersById.get(devAuthUser.id) || { id: devAuthUser.id };
            usersById.set(devAuthUser.id, mergeKnownUser(existing, devAuthUser));
        }

        for (const userId of getStoredRoleUserIds()) {
            const existing = usersById.get(userId);
            usersById.set(userId, existing || { id: userId });
        }
    }

    return Array.from(usersById.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveUserIdInput(rawInput: string): string | null {
    const input = rawInput.trim();
    if (!input) return null;

    if (!input.includes('@')) {
        return input;
    }

    const targetEmail = input.toLowerCase();
    const match = getKnownRoleUsers().find(user => user.email?.toLowerCase() === targetEmail);
    return match?.id || null;
}
