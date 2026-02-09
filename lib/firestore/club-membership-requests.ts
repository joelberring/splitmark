import {
    collection,
    collectionGroup,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    where,
    type DocumentData,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '@/lib/firebase';
import type { ClubMembershipKind } from '@/types/roles';

export type ClubMembershipRequestStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface ClubMembershipRequestRecord {
    id: string; // same as userId for dedupe/rate-limit
    clubId: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    message?: string;
    membershipKind: ClubMembershipKind;
    status: ClubMembershipRequestStatus;
    requestCount: number;
    requestedAt: string;
    lastRequestAt: string;
    updatedAt: string;
    processedBy?: string;
    processedAt?: string;
    rejectionReason?: string;
}

export interface ClubMembershipBlockRecord {
    id: string; // same as blocked user id
    clubId: string;
    userId: string;
    reason?: string;
    blockedBy: string;
    blockedAt: string;
    updatedAt: string;
}

export interface CreateClubMembershipRequestResult {
    status: 'created' | 'already_pending' | 'rate_limited' | 'blocked';
    request?: ClubMembershipRequestRecord;
    block?: ClubMembershipBlockRecord;
    nextAllowedAt?: string;
}

const REQUEST_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const LOCAL_REQUESTS_EVENT = 'splitmark:club-membership-requests-updated';
const LOCAL_BLOCKS_EVENT = 'splitmark:club-membership-blocks-updated';

function requestsStorageKey(clubId: string): string {
    return `splitmark:club-membership-requests:${clubId}`;
}

function blocksStorageKey(clubId: string): string {
    return `splitmark:club-membership-blocks:${clubId}`;
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

function normalizeRequestStatus(value: unknown): ClubMembershipRequestStatus {
    if (value === 'approved' || value === 'rejected' || value === 'blocked') return value;
    return 'pending';
}

function normalizeMembershipKind(value: unknown): ClubMembershipKind {
    return value === 'training' ? 'training' : 'competition';
}

function normalizeRequest(
    clubId: string,
    input: Partial<ClubMembershipRequestRecord> & { id: string; userId?: string }
): ClubMembershipRequestRecord {
    const nowIso = new Date().toISOString();
    const userId = String(input.userId || input.id || '').trim();

    return {
        id: userId,
        clubId,
        userId,
        userName: typeof input.userName === 'string' && input.userName.trim()
            ? input.userName.trim()
            : undefined,
        userEmail: typeof input.userEmail === 'string' && input.userEmail.trim()
            ? input.userEmail.trim()
            : undefined,
        message: typeof input.message === 'string' && input.message.trim()
            ? input.message.trim()
            : undefined,
        membershipKind: normalizeMembershipKind((input as Partial<ClubMembershipRequestRecord>).membershipKind),
        status: normalizeRequestStatus(input.status),
        requestCount: Math.max(1, Math.round(Number(input.requestCount || 1))),
        requestedAt: safeIso(input.requestedAt, nowIso),
        lastRequestAt: safeIso(input.lastRequestAt || input.requestedAt, nowIso),
        updatedAt: safeIso(input.updatedAt, nowIso),
        processedBy: typeof input.processedBy === 'string' && input.processedBy.trim()
            ? input.processedBy.trim()
            : undefined,
        processedAt: input.processedAt ? safeIso(input.processedAt, nowIso) : undefined,
        rejectionReason: typeof input.rejectionReason === 'string' && input.rejectionReason.trim()
            ? input.rejectionReason.trim()
            : undefined,
    };
}

function normalizeBlock(
    clubId: string,
    input: Partial<ClubMembershipBlockRecord> & { id: string; userId?: string; blockedBy?: string }
): ClubMembershipBlockRecord {
    const nowIso = new Date().toISOString();
    const userId = String(input.userId || input.id || '').trim();

    return {
        id: userId,
        clubId,
        userId,
        reason: typeof input.reason === 'string' && input.reason.trim()
            ? input.reason.trim()
            : undefined,
        blockedBy: typeof input.blockedBy === 'string' && input.blockedBy.trim()
            ? input.blockedBy.trim()
            : 'unknown',
        blockedAt: safeIso(input.blockedAt, nowIso),
        updatedAt: safeIso(input.updatedAt, nowIso),
    };
}

function sortRequests(requests: ClubMembershipRequestRecord[]): ClubMembershipRequestRecord[] {
    return [...requests].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

function sortBlocks(blocks: ClubMembershipBlockRecord[]): ClubMembershipBlockRecord[] {
    return [...blocks].sort((left, right) => right.blockedAt.localeCompare(left.blockedAt));
}

function emitLocalRequestsUpdated(clubId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_REQUESTS_EVENT, { detail: { clubId } }));
}

function emitLocalBlocksUpdated(clubId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_BLOCKS_EVENT, { detail: { clubId } }));
}

function getLocalRequests(clubId: string): ClubMembershipRequestRecord[] {
    if (typeof window === 'undefined') return [];

    const next: ClubMembershipRequestRecord[] = [];

    try {
        const raw = localStorage.getItem(requestsStorageKey(clubId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                parsed
                    .filter((item) => item && typeof item === 'object' && (item.id || item.userId))
                    .forEach((item) => {
                        next.push(normalizeRequest(clubId, item as ClubMembershipRequestRecord));
                    });
            }
        }
    } catch {
        // Ignore invalid local cache.
    }

    // Backward compatibility with old key `club-requests-${clubId}`
    try {
        const legacyRaw = localStorage.getItem(`club-requests-${clubId}`);
        if (legacyRaw) {
            const legacyParsed = JSON.parse(legacyRaw);
            if (Array.isArray(legacyParsed)) {
                legacyParsed
                    .filter((item) => item && typeof item === 'object' && item.userId)
                    .forEach((item) => {
                        const normalized = normalizeRequest(clubId, {
                            id: String(item.userId),
                            clubId,
                            userId: String(item.userId),
                            userName: typeof item.userName === 'string' ? item.userName : undefined,
                            userEmail: typeof item.userEmail === 'string' ? item.userEmail : undefined,
                            message: item.message,
                            status: item.status,
                            requestedAt: item.requestedAt,
                            lastRequestAt: item.requestedAt,
                            updatedAt: item.processedAt || item.requestedAt,
                            processedBy: item.processedBy,
                            processedAt: item.processedAt,
                        });
                        if (!next.some((existing) => existing.id === normalized.id)) {
                            next.push(normalized);
                        }
                    });
            }
        }
    } catch {
        // Ignore invalid legacy key.
    }

    return sortRequests(next);
}

function saveLocalRequests(clubId: string, requests: ClubMembershipRequestRecord[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(requestsStorageKey(clubId), JSON.stringify(sortRequests(requests)));
}

function upsertLocalRequest(clubId: string, request: ClubMembershipRequestRecord): void {
    const current = getLocalRequests(clubId);
    const index = current.findIndex((item) => item.id === request.id);
    if (index >= 0) {
        current[index] = {
            ...current[index],
            ...request,
        };
    } else {
        current.push(request);
    }
    saveLocalRequests(clubId, current);
}

function getLocalBlocks(clubId: string): ClubMembershipBlockRecord[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(blocksStorageKey(clubId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return sortBlocks(
            parsed
                .filter((item) => item && typeof item === 'object' && (item.id || item.userId))
                .map((item) => normalizeBlock(clubId, item as ClubMembershipBlockRecord))
        );
    } catch {
        return [];
    }
}

function saveLocalBlocks(clubId: string, blocks: ClubMembershipBlockRecord[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(blocksStorageKey(clubId), JSON.stringify(sortBlocks(blocks)));
}

function upsertLocalBlock(clubId: string, block: ClubMembershipBlockRecord): void {
    const current = getLocalBlocks(clubId);
    const index = current.findIndex((item) => item.id === block.id);
    if (index >= 0) {
        current[index] = {
            ...current[index],
            ...block,
        };
    } else {
        current.push(block);
    }
    saveLocalBlocks(clubId, current);
}

function removeLocalBlock(clubId: string, userId: string): void {
    const next = getLocalBlocks(clubId).filter((item) => item.id !== userId);
    saveLocalBlocks(clubId, next);
}

function parseRequestDoc(clubId: string, docId: string, data: DocumentData): ClubMembershipRequestRecord {
    return normalizeRequest(clubId, {
        id: docId,
        clubId,
        userId: data.userId || docId,
        userName: data.userName,
        userEmail: data.userEmail,
        message: data.message,
        membershipKind: data.membershipKind,
        status: data.status,
        requestCount: data.requestCount,
        requestedAt: data.requestedAt?.toDate?.() || data.requestedAt,
        lastRequestAt: data.lastRequestAt?.toDate?.() || data.lastRequestAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        processedBy: data.processedBy,
        processedAt: data.processedAt?.toDate?.() || data.processedAt,
        rejectionReason: data.rejectionReason,
    });
}

function parseBlockDoc(clubId: string, docId: string, data: DocumentData): ClubMembershipBlockRecord {
    return normalizeBlock(clubId, {
        id: docId,
        clubId,
        userId: data.userId || docId,
        reason: data.reason,
        blockedBy: data.blockedBy,
        blockedAt: data.blockedAt?.toDate?.() || data.blockedAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    });
}

async function persistRequest(clubId: string, request: ClubMembershipRequestRecord): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) return;

    const requestRef = doc(firestore, 'clubs', clubId, 'membership_requests', request.id);
    await setDoc(requestRef, {
        clubId,
        userId: request.userId,
        userName: request.userName || null,
        userEmail: request.userEmail || null,
        message: request.message || null,
        membershipKind: request.membershipKind,
        status: request.status,
        requestCount: request.requestCount,
        requestedAt: Timestamp.fromDate(new Date(request.requestedAt)),
        lastRequestAt: Timestamp.fromDate(new Date(request.lastRequestAt)),
        updatedAt: Timestamp.fromDate(new Date(request.updatedAt)),
        processedBy: request.processedBy || null,
        processedAt: request.processedAt ? Timestamp.fromDate(new Date(request.processedAt)) : null,
        rejectionReason: request.rejectionReason || null,
    }, { merge: true });
}

async function persistBlock(clubId: string, block: ClubMembershipBlockRecord): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) return;

    const blockRef = doc(firestore, 'clubs', clubId, 'membership_blocks', block.id);
    await setDoc(blockRef, {
        clubId,
        userId: block.userId,
        reason: block.reason || null,
        blockedBy: block.blockedBy,
        blockedAt: Timestamp.fromDate(new Date(block.blockedAt)),
        updatedAt: Timestamp.fromDate(new Date(block.updatedAt)),
    }, { merge: true });
}

export async function getClubMembershipRequest(
    clubId: string,
    userId: string
): Promise<ClubMembershipRequestRecord | null> {
    if (!clubId || !userId) return null;

    if (!isFirebaseConfigured() || !firestore) {
        return getLocalRequests(clubId).find((item) => item.userId === userId) || null;
    }

    try {
        const requestRef = doc(firestore, 'clubs', clubId, 'membership_requests', userId);
        const snapshot = await getDoc(requestRef);
        if (!snapshot.exists()) return null;
        const parsed = parseRequestDoc(clubId, snapshot.id, snapshot.data());
        upsertLocalRequest(clubId, parsed);
        return parsed;
    } catch (error) {
        console.error('Error fetching club membership request:', error);
        return getLocalRequests(clubId).find((item) => item.userId === userId) || null;
    }
}

export async function getClubMembershipBlock(
    clubId: string,
    userId: string
): Promise<ClubMembershipBlockRecord | null> {
    if (!clubId || !userId) return null;

    if (!isFirebaseConfigured() || !firestore) {
        return getLocalBlocks(clubId).find((item) => item.userId === userId) || null;
    }

    try {
        const blockRef = doc(firestore, 'clubs', clubId, 'membership_blocks', userId);
        const snapshot = await getDoc(blockRef);
        if (!snapshot.exists()) return null;
        const parsed = parseBlockDoc(clubId, snapshot.id, snapshot.data());
        upsertLocalBlock(clubId, parsed);
        return parsed;
    } catch (error) {
        console.error('Error fetching club membership block:', error);
        return getLocalBlocks(clubId).find((item) => item.userId === userId) || null;
    }
}

export async function getUserClubMembershipRequests(
    userId: string,
    options?: { status?: ClubMembershipRequestStatus }
): Promise<ClubMembershipRequestRecord[]> {
    const resolvedUserId = String(userId || '').trim();
    if (!resolvedUserId) return [];

    const filterStatus = (requests: ClubMembershipRequestRecord[]) => (
        options?.status ? requests.filter((item) => item.status === options.status) : requests
    );

    const scanLocalCache = (): ClubMembershipRequestRecord[] => {
        if (typeof window === 'undefined') return [];

        const prefix = `${requestsStorageKey('')}`;
        const next: ClubMembershipRequestRecord[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith(prefix)) continue;
            const clubId = key.slice(prefix.length);
            if (!clubId) continue;
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) continue;
                parsed
                    .filter((item) => item && typeof item === 'object' && (item.userId || item.id))
                    .map((item) => normalizeRequest(clubId, item as ClubMembershipRequestRecord))
                    .filter((item) => item.userId === resolvedUserId)
                    .forEach((item) => next.push(item));
            } catch {
                continue;
            }
        }

        return next;
    };

    if (!isFirebaseConfigured() || !firestore) {
        return filterStatus(scanLocalCache());
    }

    try {
        const snapshot = await getDocs(query(
            collectionGroup(firestore, 'membership_requests'),
            where('userId', '==', resolvedUserId)
        ));

        const requests: ClubMembershipRequestRecord[] = [];

        snapshot.docs.forEach((requestDoc) => {
            const data = requestDoc.data();
            const clubId = String(data.clubId || requestDoc.ref.parent.parent?.id || '').trim();
            if (!clubId) return;
            const parsed = parseRequestDoc(clubId, requestDoc.id, data);
            upsertLocalRequest(clubId, parsed);
            requests.push(parsed);
        });

        return filterStatus(requests);
    } catch (error) {
        console.error('Error fetching user club membership requests:', error);
        return filterStatus(scanLocalCache());
    }
}

export async function createOrRenewClubMembershipRequest(params: {
    clubId: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    message?: string;
    membershipKind?: ClubMembershipKind;
}): Promise<CreateClubMembershipRequestResult> {
    const clubId = String(params.clubId || '').trim();
    const userId = String(params.userId || '').trim();
    if (!clubId || !userId) {
        throw new Error('Ogiltig klubb eller användare.');
    }

    const block = await getClubMembershipBlock(clubId, userId);
    if (block) {
        return { status: 'blocked', block };
    }

    const nowIso = new Date().toISOString();
    const existing = await getClubMembershipRequest(clubId, userId);

    if (existing && existing.status === 'pending') {
        return {
            status: 'already_pending',
            request: existing,
        };
    }

    if (existing) {
        const lastRequestAtMs = new Date(existing.lastRequestAt || existing.requestedAt).getTime();
        if (Number.isFinite(lastRequestAtMs) && (Date.now() - lastRequestAtMs) < REQUEST_COOLDOWN_MS) {
            return {
                status: 'rate_limited',
                request: existing,
                nextAllowedAt: new Date(lastRequestAtMs + REQUEST_COOLDOWN_MS).toISOString(),
            };
        }
    }

    const nextRequest = normalizeRequest(clubId, {
        id: userId,
        clubId,
        userId,
        userName: params.userName,
        userEmail: params.userEmail,
        message: params.message,
        membershipKind: normalizeMembershipKind(params.membershipKind),
        status: 'pending',
        requestCount: Math.max(1, Number(existing?.requestCount || 0) + 1),
        requestedAt: nowIso,
        lastRequestAt: nowIso,
        updatedAt: nowIso,
        processedBy: undefined,
        processedAt: undefined,
        rejectionReason: undefined,
    });

    upsertLocalRequest(clubId, nextRequest);
    emitLocalRequestsUpdated(clubId);

    try {
        await persistRequest(clubId, nextRequest);
    } catch (error) {
        console.error('Error saving club membership request:', error);
    }

    return {
        status: 'created',
        request: nextRequest,
    };
}

export async function processClubMembershipRequest(params: {
    clubId: string;
    userId: string;
    status: Extract<ClubMembershipRequestStatus, 'approved' | 'rejected' | 'blocked'>;
    processedBy: string;
    rejectionReason?: string;
}): Promise<ClubMembershipRequestRecord> {
    const clubId = String(params.clubId || '').trim();
    const userId = String(params.userId || '').trim();
    if (!clubId || !userId) {
        throw new Error('Ogiltig klubb eller användare.');
    }

    const existing = await getClubMembershipRequest(clubId, userId);
    const nowIso = new Date().toISOString();

    const processed = normalizeRequest(clubId, {
        id: userId,
        clubId,
        userId,
        userName: existing?.userName,
        userEmail: existing?.userEmail,
        message: existing?.message,
        membershipKind: existing?.membershipKind,
        status: params.status,
        requestCount: existing?.requestCount || 1,
        requestedAt: existing?.requestedAt || nowIso,
        lastRequestAt: existing?.lastRequestAt || existing?.requestedAt || nowIso,
        updatedAt: nowIso,
        processedBy: params.processedBy,
        processedAt: nowIso,
        rejectionReason: params.rejectionReason,
    });

    upsertLocalRequest(clubId, processed);
    emitLocalRequestsUpdated(clubId);

    try {
        await persistRequest(clubId, processed);
    } catch (error) {
        console.error('Error processing club membership request:', error);
    }

    if (params.status === 'blocked') {
        const block = normalizeBlock(clubId, {
            id: userId,
            clubId,
            userId,
            blockedBy: params.processedBy,
            reason: params.rejectionReason,
            blockedAt: nowIso,
            updatedAt: nowIso,
        });
        upsertLocalBlock(clubId, block);
        emitLocalBlocksUpdated(clubId);
        try {
            await persistBlock(clubId, block);
        } catch (error) {
            console.error('Error creating membership block:', error);
        }
    }

    return processed;
}

export async function unblockClubMembershipRequester(params: {
    clubId: string;
    userId: string;
}): Promise<void> {
    const clubId = String(params.clubId || '').trim();
    const userId = String(params.userId || '').trim();
    if (!clubId || !userId) return;

    removeLocalBlock(clubId, userId);
    emitLocalBlocksUpdated(clubId);

    if (!isFirebaseConfigured() || !firestore) {
        return;
    }

    try {
        const blockRef = doc(firestore, 'clubs', clubId, 'membership_blocks', userId);
        await deleteDoc(blockRef);
    } catch (error) {
        console.error('Error unblocking membership requester:', error);
    }
}

export async function getClubMembershipRequests(
    clubId: string,
    options?: { status?: ClubMembershipRequestStatus }
): Promise<ClubMembershipRequestRecord[]> {
    if (!clubId) return [];

    if (!isFirebaseConfigured() || !firestore) {
        const local = getLocalRequests(clubId);
        return options?.status
            ? local.filter((item) => item.status === options.status)
            : local;
    }

    try {
        const snapshot = await getDocs(query(
            collection(firestore, 'clubs', clubId, 'membership_requests'),
            orderBy('requestedAt', 'desc')
        ));
        const requests = snapshot.docs.map((requestDoc) => parseRequestDoc(clubId, requestDoc.id, requestDoc.data()));
        saveLocalRequests(clubId, requests);
        return options?.status
            ? requests.filter((item) => item.status === options.status)
            : requests;
    } catch (error) {
        console.error('Error fetching membership requests:', error);
        const local = getLocalRequests(clubId);
        return options?.status
            ? local.filter((item) => item.status === options.status)
            : local;
    }
}

export async function getClubMembershipBlocks(clubId: string): Promise<ClubMembershipBlockRecord[]> {
    if (!clubId) return [];

    if (!isFirebaseConfigured() || !firestore) {
        return getLocalBlocks(clubId);
    }

    try {
        const snapshot = await getDocs(query(
            collection(firestore, 'clubs', clubId, 'membership_blocks'),
            orderBy('blockedAt', 'desc')
        ));
        const blocks = snapshot.docs.map((blockDoc) => parseBlockDoc(clubId, blockDoc.id, blockDoc.data()));
        saveLocalBlocks(clubId, blocks);
        return blocks;
    } catch (error) {
        console.error('Error fetching membership blocks:', error);
        return getLocalBlocks(clubId);
    }
}

export function subscribeToClubMembershipRequests(
    clubId: string,
    callback: (requests: ClubMembershipRequestRecord[]) => void,
    options?: { status?: ClubMembershipRequestStatus }
) {
    const applyFilter = (requests: ClubMembershipRequestRecord[]) => {
        if (!options?.status) return requests;
        return requests.filter((item) => item.status === options.status);
    };

    if (!isFirebaseConfigured() || !firestore) {
        callback(applyFilter(getLocalRequests(clubId)));

        const customUpdateHandler = (event: Event) => {
            const typed = event as CustomEvent<{ clubId: string }>;
            if (!typed.detail || typed.detail.clubId !== clubId) return;
            callback(applyFilter(getLocalRequests(clubId)));
        };
        const storageHandler = () => callback(applyFilter(getLocalRequests(clubId)));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_REQUESTS_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_REQUESTS_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const q = query(
        collection(firestore, 'clubs', clubId, 'membership_requests'),
        orderBy('requestedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map((requestDoc) => parseRequestDoc(clubId, requestDoc.id, requestDoc.data()));
        saveLocalRequests(clubId, requests);
        callback(applyFilter(requests));
    }, (error) => {
        console.error('Error subscribing membership requests:', error);
        callback(applyFilter(getLocalRequests(clubId)));
    });
}

export function subscribeToClubMembershipBlocks(
    clubId: string,
    callback: (blocks: ClubMembershipBlockRecord[]) => void
) {
    if (!isFirebaseConfigured() || !firestore) {
        callback(getLocalBlocks(clubId));

        const customUpdateHandler = (event: Event) => {
            const typed = event as CustomEvent<{ clubId: string }>;
            if (!typed.detail || typed.detail.clubId !== clubId) return;
            callback(getLocalBlocks(clubId));
        };
        const storageHandler = () => callback(getLocalBlocks(clubId));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_BLOCKS_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_BLOCKS_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const q = query(
        collection(firestore, 'clubs', clubId, 'membership_blocks'),
        orderBy('blockedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const blocks = snapshot.docs.map((blockDoc) => parseBlockDoc(clubId, blockDoc.id, blockDoc.data()));
        saveLocalBlocks(clubId, blocks);
        callback(blocks);
    }, (error) => {
        console.error('Error subscribing membership blocks:', error);
        callback(getLocalBlocks(clubId));
    });
}
