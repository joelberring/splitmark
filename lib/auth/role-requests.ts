import { getClubAdminUserIds } from './event-admins';
import type { UserWithRoles } from '@/types/roles';

export type RequestedRole = 'club_admin' | 'super_admin';
export type RoleRequestStatus = 'pending' | 'approved' | 'rejected' | 'blocked';
export type RoleRequestRoute = 'club_admin' | 'super_admin';

export interface RoleRequestRecord {
    id: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    requestedRole: RequestedRole;
    clubId?: string;
    route: RoleRequestRoute;
    status: RoleRequestStatus;
    requestCount: number;
    requestedAt: string;
    lastRequestAt: string;
    updatedAt: string;
    processedBy?: string;
    processedAt?: string;
    rejectionReason?: string;
}

interface RoleRequestFilters {
    status?: RoleRequestStatus;
    route?: RoleRequestRoute;
    requestedRole?: RequestedRole;
    clubId?: string;
}

export interface CreateRoleRequestResult {
    status: 'created' | 'already_pending' | 'rate_limited' | 'already_has_role' | 'invalid';
    request?: RoleRequestRecord;
    nextAllowedAt?: string;
}

const STORAGE_KEY = 'splitmark:role-requests:v1';
const STORAGE_EVENT = 'splitmark:role-requests-updated';
const REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

function safeIso(value: unknown, fallback = new Date().toISOString()): string {
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    return fallback;
}

function normalizeStatus(value: unknown): RoleRequestStatus {
    if (value === 'approved' || value === 'rejected' || value === 'blocked') return value;
    return 'pending';
}

function normalizeRequestedRole(value: unknown): RequestedRole {
    if (value === 'super_admin') return value;
    return 'club_admin';
}

function normalizeRoute(value: unknown): RoleRequestRoute {
    if (value === 'super_admin') return value;
    return 'club_admin';
}

function normalizeRecord(input: Partial<RoleRequestRecord> & { id: string; userId?: string }): RoleRequestRecord {
    const nowIso = new Date().toISOString();
    const userId = String(input.userId || input.id || '').trim();

    return {
        id: String(input.id || `${Date.now()}`),
        userId,
        userName: typeof input.userName === 'string' && input.userName.trim() ? input.userName.trim() : undefined,
        userEmail: typeof input.userEmail === 'string' && input.userEmail.trim() ? input.userEmail.trim() : undefined,
        requestedRole: normalizeRequestedRole(input.requestedRole),
        clubId: typeof input.clubId === 'string' && input.clubId.trim() ? input.clubId.trim() : undefined,
        route: normalizeRoute(input.route),
        status: normalizeStatus(input.status),
        requestCount: Math.max(1, Math.round(Number(input.requestCount || 1))),
        requestedAt: safeIso(input.requestedAt, nowIso),
        lastRequestAt: safeIso(input.lastRequestAt || input.requestedAt, nowIso),
        updatedAt: safeIso(input.updatedAt, nowIso),
        processedBy: typeof input.processedBy === 'string' && input.processedBy.trim() ? input.processedBy.trim() : undefined,
        processedAt: input.processedAt ? safeIso(input.processedAt, nowIso) : undefined,
        rejectionReason: typeof input.rejectionReason === 'string' && input.rejectionReason.trim()
            ? input.rejectionReason.trim()
            : undefined,
    };
}

function sortRecords(records: RoleRequestRecord[]): RoleRequestRecord[] {
    return [...records].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

function readAllRecords(): RoleRequestRecord[] {
    if (!isBrowser()) return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return sortRecords(
            parsed
                .filter((item) => item && typeof item === 'object' && item.id)
                .map((item) => normalizeRecord(item as RoleRequestRecord))
        );
    } catch {
        return [];
    }
}

function writeAllRecords(records: RoleRequestRecord[]): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortRecords(records)));
}

function emitUpdate(): void {
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

function applyFilters(records: RoleRequestRecord[], filters?: RoleRequestFilters): RoleRequestRecord[] {
    return records.filter((record) => {
        if (filters?.status && record.status !== filters.status) return false;
        if (filters?.route && record.route !== filters.route) return false;
        if (filters?.requestedRole && record.requestedRole !== filters.requestedRole) return false;
        if (filters?.clubId && record.clubId !== filters.clubId) return false;
        return true;
    });
}

function userHasClubAdminRole(userId: string, clubId: string): boolean {
    if (!isBrowser()) return false;
    try {
        const raw = localStorage.getItem(`user-roles-${userId}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed?.clubs?.[clubId]?.role === 'club_admin';
    } catch {
        return false;
    }
}

function userHasSuperAdminRole(userId: string): boolean {
    if (!isBrowser()) return false;
    try {
        const raw = localStorage.getItem(`user-roles-${userId}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed?.systemRole === 'super_admin';
    } catch {
        return false;
    }
}

export function listRoleRequests(filters?: RoleRequestFilters): RoleRequestRecord[] {
    return applyFilters(readAllRecords(), filters);
}

export function getRoleRequestById(requestId: string): RoleRequestRecord | null {
    return readAllRecords().find((record) => record.id === requestId) || null;
}

export function resolveRoleRequestRoute(params: {
    requestedRole: RequestedRole;
    clubId?: string;
    requesterUserId?: string;
}): RoleRequestRoute {
    if (params.requestedRole === 'super_admin') {
        return 'super_admin';
    }

    const clubId = params.clubId?.trim();
    if (!clubId) {
        return 'super_admin';
    }

    const clubAdminIds = getClubAdminUserIds(clubId)
        .filter((userId) => userId !== params.requesterUserId);

    return clubAdminIds.length > 0 ? 'club_admin' : 'super_admin';
}

export function createRoleRequest(params: {
    userId: string;
    userName?: string;
    userEmail?: string;
    requestedRole: RequestedRole;
    clubId?: string;
}): CreateRoleRequestResult {
    const userId = String(params.userId || '').trim();
    const requestedRole = params.requestedRole;
    const clubId = params.clubId?.trim();

    if (!userId) {
        return { status: 'invalid' };
    }

    if (requestedRole === 'club_admin') {
        if (!clubId) {
            return { status: 'invalid' };
        }
        if (userHasClubAdminRole(userId, clubId)) {
            return { status: 'already_has_role' };
        }
    }

    if (requestedRole === 'super_admin' && userHasSuperAdminRole(userId)) {
        return { status: 'already_has_role' };
    }

    const nowIso = new Date().toISOString();
    const route = resolveRoleRequestRoute({
        requestedRole,
        clubId,
        requesterUserId: userId,
    });

    const records = readAllRecords();
    const sameScopeRecords = records.filter((record) =>
        record.userId === userId
        && record.requestedRole === requestedRole
        && (requestedRole !== 'club_admin' || record.clubId === clubId)
    );

    const pending = sameScopeRecords.find((record) => record.status === 'pending');
    if (pending) {
        return { status: 'already_pending', request: pending };
    }

    const latest = sameScopeRecords[0];
    if (latest) {
        const lastMs = new Date(latest.lastRequestAt || latest.requestedAt).getTime();
        if (Number.isFinite(lastMs) && (Date.now() - lastMs) < REQUEST_COOLDOWN_MS) {
            return {
                status: 'rate_limited',
                request: latest,
                nextAllowedAt: new Date(lastMs + REQUEST_COOLDOWN_MS).toISOString(),
            };
        }
    }

    const next = normalizeRecord({
        id: `role-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        userName: params.userName,
        userEmail: params.userEmail,
        requestedRole,
        clubId,
        route,
        status: 'pending',
        requestCount: Math.max(1, Number(latest?.requestCount || 0) + 1),
        requestedAt: nowIso,
        lastRequestAt: nowIso,
        updatedAt: nowIso,
    });

    writeAllRecords([next, ...records]);
    emitUpdate();

    return { status: 'created', request: next };
}

export function processRoleRequest(params: {
    requestId: string;
    status: Exclude<RoleRequestStatus, 'pending'>;
    processedBy: string;
    rejectionReason?: string;
}): RoleRequestRecord | null {
    const requestId = params.requestId.trim();
    if (!requestId) return null;

    const records = readAllRecords();
    const index = records.findIndex((record) => record.id === requestId);
    if (index < 0) return null;

    const existing = records[index];
    const nowIso = new Date().toISOString();
    const updated = normalizeRecord({
        ...existing,
        status: params.status,
        updatedAt: nowIso,
        processedBy: params.processedBy,
        processedAt: nowIso,
        rejectionReason: params.rejectionReason,
    });

    const next = [...records];
    next[index] = updated;
    writeAllRecords(next);
    emitUpdate();
    return updated;
}

export function subscribeRoleRequests(
    callback: (records: RoleRequestRecord[]) => void,
    filters?: RoleRequestFilters
): () => void {
    if (!isBrowser()) {
        callback([]);
        return () => { };
    }

    const publish = () => callback(listRoleRequests(filters));
    publish();

    const storageHandler = (event: StorageEvent) => {
        if (event.key && event.key !== STORAGE_KEY) return;
        publish();
    };
    const localEventHandler = () => publish();

    window.addEventListener('storage', storageHandler);
    window.addEventListener(STORAGE_EVENT, localEventHandler as EventListener);

    return () => {
        window.removeEventListener('storage', storageHandler);
        window.removeEventListener(STORAGE_EVENT, localEventHandler as EventListener);
    };
}

export function canUserApproveRoleRequest(user: UserWithRoles | null, request: RoleRequestRecord): boolean {
    if (!user) return false;
    if (user.systemRole === 'super_admin') return true;

    if (request.requestedRole === 'super_admin') {
        return false;
    }

    if (request.route !== 'club_admin') {
        return false;
    }

    if (!request.clubId) {
        return false;
    }

    return user.clubs?.[request.clubId]?.role === 'club_admin';
}
