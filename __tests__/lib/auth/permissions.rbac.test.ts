import { describe, expect, it } from '@jest/globals';
import { canCreateEventAtLevel, isEventAdmin } from '@/lib/auth/permissions';
import type { ClubMembership, EventRoleAssignment, UserWithRoles } from '@/types/roles';

function buildMembership(overrides?: Partial<ClubMembership>): ClubMembership {
    return {
        clubId: 'club-1',
        role: 'member',
        teams: [],
        trainedTeams: [],
        joinedAt: new Date('2025-01-01T00:00:00.000Z'),
        invitedBy: 'system',
        ...overrides,
    };
}

function buildEventRole(overrides?: Partial<EventRoleAssignment>): EventRoleAssignment {
    return {
        eventId: 'event-1',
        role: 'event_admin',
        assignedBy: 'system',
        assignedAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides,
    };
}

function buildUser(overrides?: Partial<UserWithRoles>): UserWithRoles {
    return {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User One',
        systemRole: 'user',
        clubs: {},
        eventRoles: {},
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        lastLoginAt: new Date('2025-01-01T00:00:00.000Z'),
        ...overrides,
    };
}

describe('permissions RBAC', () => {
    describe('canCreateEventAtLevel', () => {
        it('allows local and training for logged-in regular user', () => {
            const user = buildUser();
            expect(canCreateEventAtLevel(user, 'local')).toBe(true);
            expect(canCreateEventAtLevel(user, 'training')).toBe(true);
        });

        it('requires club admin for district and national levels', () => {
            const regularUser = buildUser();
            const clubAdminUser = buildUser({
                clubs: {
                    'club-1': buildMembership({ role: 'club_admin' }),
                },
            });

            expect(canCreateEventAtLevel(regularUser, 'district', 'club-1')).toBe(false);
            expect(canCreateEventAtLevel(regularUser, 'national', 'club-1')).toBe(false);
            expect(canCreateEventAtLevel(clubAdminUser, 'district', 'club-1')).toBe(true);
            expect(canCreateEventAtLevel(clubAdminUser, 'national', 'club-1')).toBe(true);
        });

        it('allows super admin at all levels', () => {
            const superAdmin = buildUser({ systemRole: 'super_admin' });

            expect(canCreateEventAtLevel(superAdmin, 'local')).toBe(true);
            expect(canCreateEventAtLevel(superAdmin, 'district')).toBe(true);
            expect(canCreateEventAtLevel(superAdmin, 'national')).toBe(true);
            expect(canCreateEventAtLevel(superAdmin, 'training')).toBe(true);
        });
    });

    describe('isEventAdmin', () => {
        it('accepts event creator as admin', () => {
            const user = buildUser({ id: 'creator-1' });
            expect(isEventAdmin(user, 'event-1', 'club-1', 'creator-1')).toBe(true);
        });

        it('accepts explicit event role', () => {
            const user = buildUser({
                eventRoles: {
                    'event-1': buildEventRole({ role: 'event_admin' }),
                },
            });
            expect(isEventAdmin(user, 'event-1', 'club-1', 'someone-else')).toBe(true);
        });

        it('accepts club admin for same club', () => {
            const user = buildUser({
                clubs: {
                    'club-1': buildMembership({ role: 'club_admin' }),
                },
            });
            expect(isEventAdmin(user, 'event-1', 'club-1', 'someone-else')).toBe(true);
        });

        it('rejects regular club member without ownership or event role', () => {
            const user = buildUser({
                clubs: {
                    'club-1': buildMembership({ role: 'member' }),
                },
            });
            expect(isEventAdmin(user, 'event-1', 'club-1', 'someone-else')).toBe(false);
        });
    });
});
