import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    type DocumentData,
} from 'firebase/firestore';
import { firestore, COLLECTIONS, isFirebaseConfigured } from '../firebase';
import {
    enqueueOfflineAction,
    flushOfflineActions,
    registerOfflineActionHandler,
    startOfflineQueueAutoFlush,
} from '@/lib/offline/action-queue';

export type RadioControlMode = 'radio_control' | 'remote_finish';
export type RadioControlState = 'idle' | 'live' | 'offline' | 'error';
export type RadioPassageSource = 'si' | 'manual';

export interface RadioControlDeviceStatus {
    id: string;
    eventId: string;
    deviceId: string;
    stationCode?: string;
    stationName?: string;
    masterId?: string;
    mode: RadioControlMode;
    state: RadioControlState;
    batteryLevel?: number;
    charging?: boolean;
    heartbeatIntervalSec?: number;
    lastSeenAt: string;
    updatedAt: string;
    appVersion?: string;
    lastError?: string;
}

export interface RadioControlPassage {
    id: string;
    eventId: string;
    deviceId: string;
    stationCode?: string;
    stationName?: string;
    masterId?: string;
    cardNumber: string;
    source: RadioPassageSource;
    readAt: string;
    hasCompleteRead?: boolean;
    punchCount?: number;
    startTime?: string;
    finishTime?: string;
    entryId?: string;
    entryName?: string;
    createdAt: string;
    updatedAt: string;
}

interface SaveRadioStatusOfflinePayload {
    eventId: string;
    status: RadioControlDeviceStatus;
}

interface SaveRadioPassageOfflinePayload {
    eventId: string;
    passage: RadioControlPassage;
}

const LOCAL_RADIO_STATUS_EVENT = 'splitmark:radio-controls-updated';
const LOCAL_RADIO_PASSAGES_EVENT = 'splitmark:radio-passages-updated';
const OFFLINE_ACTION_SAVE_RADIO_STATUS = 'save_radio_status';
const OFFLINE_ACTION_SAVE_RADIO_PASSAGE = 'save_radio_passage';

let hasRegisteredOfflineHandlers = false;

function statusStorageKey(eventId: string): string {
    return `splitmark:radio-controls:${eventId}`;
}

function passagesStorageKey(eventId: string): string {
    return `splitmark:radio-passages:${eventId}`;
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

function normalizeBatteryLevel(value: unknown): number | undefined {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    const clamped = Math.max(0, Math.min(100, Math.round(parsed)));
    return clamped;
}

function normalizeState(value: unknown): RadioControlState {
    if (value === 'live' || value === 'offline' || value === 'error') return value;
    return 'idle';
}

function normalizeMode(value: unknown): RadioControlMode {
    if (value === 'remote_finish') return value;
    return 'radio_control';
}

function sortStatuses(statuses: RadioControlDeviceStatus[]): RadioControlDeviceStatus[] {
    return [...statuses].sort((left, right) => {
        if (left.lastSeenAt === right.lastSeenAt) return left.deviceId.localeCompare(right.deviceId);
        return right.lastSeenAt.localeCompare(left.lastSeenAt);
    });
}

function sortPassages(passages: RadioControlPassage[]): RadioControlPassage[] {
    return [...passages].sort((left, right) => {
        if (left.readAt === right.readAt) return left.id.localeCompare(right.id);
        return right.readAt.localeCompare(left.readAt);
    });
}

function normalizeStatus(
    eventId: string,
    input: Partial<RadioControlDeviceStatus> & { deviceId: string }
): RadioControlDeviceStatus {
    const now = new Date().toISOString();
    const deviceId = String(input.deviceId || '').trim();

    return {
        id: deviceId,
        eventId,
        deviceId,
        stationCode: typeof input.stationCode === 'string' && input.stationCode.trim()
            ? input.stationCode.trim()
            : undefined,
        stationName: typeof input.stationName === 'string' && input.stationName.trim()
            ? input.stationName.trim()
            : undefined,
        masterId: typeof input.masterId === 'string' && input.masterId.trim()
            ? input.masterId.trim()
            : undefined,
        mode: normalizeMode(input.mode),
        state: normalizeState(input.state),
        batteryLevel: normalizeBatteryLevel(input.batteryLevel),
        charging: typeof input.charging === 'boolean' ? input.charging : undefined,
        heartbeatIntervalSec: Number.isFinite(Number(input.heartbeatIntervalSec))
            ? Math.max(5, Math.round(Number(input.heartbeatIntervalSec)))
            : undefined,
        lastSeenAt: safeIso(input.lastSeenAt, now),
        updatedAt: safeIso(input.updatedAt, now),
        appVersion: typeof input.appVersion === 'string' && input.appVersion.trim()
            ? input.appVersion.trim()
            : undefined,
        lastError: typeof input.lastError === 'string' && input.lastError.trim()
            ? input.lastError.trim()
            : undefined,
    };
}

function normalizePassage(
    eventId: string,
    input: Partial<RadioControlPassage> & {
        deviceId: string;
        cardNumber: string;
        source: RadioPassageSource;
    }
): RadioControlPassage {
    const now = new Date().toISOString();
    const id = typeof input.id === 'string' && input.id.trim()
        ? input.id.trim()
        : `radio-pass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        id,
        eventId,
        deviceId: String(input.deviceId || '').trim(),
        stationCode: typeof input.stationCode === 'string' && input.stationCode.trim()
            ? input.stationCode.trim()
            : undefined,
        stationName: typeof input.stationName === 'string' && input.stationName.trim()
            ? input.stationName.trim()
            : undefined,
        masterId: typeof input.masterId === 'string' && input.masterId.trim()
            ? input.masterId.trim()
            : undefined,
        cardNumber: String(input.cardNumber || '').trim(),
        source: input.source === 'manual' ? 'manual' : 'si',
        readAt: safeIso(input.readAt, now),
        hasCompleteRead: !!input.hasCompleteRead,
        punchCount: Number.isFinite(Number(input.punchCount))
            ? Math.max(0, Math.round(Number(input.punchCount)))
            : undefined,
        startTime: input.startTime ? safeIso(input.startTime, now) : undefined,
        finishTime: input.finishTime ? safeIso(input.finishTime, now) : undefined,
        entryId: typeof input.entryId === 'string' && input.entryId.trim()
            ? input.entryId.trim()
            : undefined,
        entryName: typeof input.entryName === 'string' && input.entryName.trim()
            ? input.entryName.trim()
            : undefined,
        createdAt: safeIso(input.createdAt, now),
        updatedAt: safeIso(input.updatedAt, now),
    };
}

function getLocalStatuses(eventId: string): RadioControlDeviceStatus[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(statusStorageKey(eventId));
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return sortStatuses(
            parsed
                .filter((item) => item && typeof item === 'object')
                .map((item) => normalizeStatus(eventId, item as RadioControlDeviceStatus))
        );
    } catch {
        return [];
    }
}

function saveLocalStatuses(eventId: string, statuses: RadioControlDeviceStatus[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(statusStorageKey(eventId), JSON.stringify(sortStatuses(statuses)));
}

function upsertLocalStatus(eventId: string, status: RadioControlDeviceStatus): void {
    const current = getLocalStatuses(eventId);
    const index = current.findIndex((item) => item.deviceId === status.deviceId);

    if (index >= 0) {
        current[index] = {
            ...current[index],
            ...status,
        };
    } else {
        current.push(status);
    }

    saveLocalStatuses(eventId, current);
}

function getLocalPassages(eventId: string): RadioControlPassage[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(passagesStorageKey(eventId));
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return sortPassages(
            parsed
                .filter((item) => item && typeof item === 'object')
                .map((item) => normalizePassage(eventId, item as RadioControlPassage))
        );
    } catch {
        return [];
    }
}

function saveLocalPassages(eventId: string, passages: RadioControlPassage[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(passagesStorageKey(eventId), JSON.stringify(sortPassages(passages).slice(0, 600)));
}

function addLocalPassage(eventId: string, passage: RadioControlPassage): void {
    const current = getLocalPassages(eventId);
    current.unshift(passage);
    saveLocalPassages(eventId, current);
}

function emitLocalStatusesUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_RADIO_STATUS_EVENT, { detail: { eventId } }));
}

function emitLocalPassagesUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_RADIO_PASSAGES_EVENT, { detail: { eventId } }));
}

function parseFirestoreStatus(eventId: string, docId: string, data: DocumentData): RadioControlDeviceStatus {
    return normalizeStatus(eventId, {
        id: docId,
        eventId,
        deviceId: data.deviceId || docId,
        stationCode: data.stationCode,
        stationName: data.stationName,
        masterId: data.masterId,
        mode: data.mode,
        state: data.state,
        batteryLevel: data.batteryLevel,
        charging: data.charging,
        heartbeatIntervalSec: data.heartbeatIntervalSec,
        lastSeenAt: data.lastSeenAt?.toDate?.() || data.lastSeenAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        appVersion: data.appVersion,
        lastError: data.lastError,
    });
}

function parseFirestorePassage(eventId: string, docId: string, data: DocumentData): RadioControlPassage {
    return normalizePassage(eventId, {
        id: docId,
        eventId,
        deviceId: data.deviceId,
        stationCode: data.stationCode,
        stationName: data.stationName,
        masterId: data.masterId,
        cardNumber: data.cardNumber,
        source: data.source === 'manual' ? 'manual' : 'si',
        readAt: data.readAt?.toDate?.() || data.readAt,
        hasCompleteRead: data.hasCompleteRead,
        punchCount: data.punchCount,
        startTime: data.startTime?.toDate?.() || data.startTime,
        finishTime: data.finishTime?.toDate?.() || data.finishTime,
        entryId: data.entryId,
        entryName: data.entryName,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    });
}

async function persistRadioStatus(eventId: string, status: RadioControlDeviceStatus): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        throw new Error('Firestore är inte tillgängligt');
    }

    const ref = doc(firestore, COLLECTIONS.EVENTS, eventId, 'radioControls', status.deviceId);
    await setDoc(ref, {
        eventId,
        deviceId: status.deviceId,
        stationCode: status.stationCode || null,
        stationName: status.stationName || null,
        masterId: status.masterId || null,
        mode: status.mode,
        state: status.state,
        batteryLevel: status.batteryLevel ?? null,
        charging: typeof status.charging === 'boolean' ? status.charging : null,
        heartbeatIntervalSec: status.heartbeatIntervalSec ?? null,
        lastSeenAt: Timestamp.fromDate(new Date(status.lastSeenAt)),
        updatedAt: Timestamp.fromDate(new Date(status.updatedAt)),
        appVersion: status.appVersion || null,
        lastError: status.lastError || null,
    }, { merge: true });
}

async function persistRadioPassage(eventId: string, passage: RadioControlPassage): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        throw new Error('Firestore är inte tillgängligt');
    }

    const ref = doc(firestore, COLLECTIONS.EVENTS, eventId, 'radioPassages', passage.id);
    await setDoc(ref, {
        eventId,
        deviceId: passage.deviceId,
        stationCode: passage.stationCode || null,
        stationName: passage.stationName || null,
        masterId: passage.masterId || null,
        cardNumber: passage.cardNumber,
        source: passage.source,
        readAt: Timestamp.fromDate(new Date(passage.readAt)),
        hasCompleteRead: !!passage.hasCompleteRead,
        punchCount: passage.punchCount ?? null,
        startTime: passage.startTime ? Timestamp.fromDate(new Date(passage.startTime)) : null,
        finishTime: passage.finishTime ? Timestamp.fromDate(new Date(passage.finishTime)) : null,
        entryId: passage.entryId || null,
        entryName: passage.entryName || null,
        createdAt: Timestamp.fromDate(new Date(passage.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(passage.updatedAt)),
    }, { merge: true });
}

function ensureOfflineHandlersRegistered(): void {
    if (hasRegisteredOfflineHandlers) return;

    registerOfflineActionHandler<SaveRadioStatusOfflinePayload>(
        OFFLINE_ACTION_SAVE_RADIO_STATUS,
        async (payload) => {
            await persistRadioStatus(payload.eventId, payload.status);
        }
    );

    registerOfflineActionHandler<SaveRadioPassageOfflinePayload>(
        OFFLINE_ACTION_SAVE_RADIO_PASSAGE,
        async (payload) => {
            await persistRadioPassage(payload.eventId, payload.passage);
        }
    );

    hasRegisteredOfflineHandlers = true;
}

export function isRadioControlLive(status: RadioControlDeviceStatus, nowMs = Date.now()): boolean {
    if (status.state !== 'live') return false;

    const seenMs = new Date(status.lastSeenAt).getTime();
    if (Number.isNaN(seenMs)) return false;

    const intervalSec = Math.max(10, Number(status.heartbeatIntervalSec || 45));
    const liveThresholdMs = Math.max(120_000, intervalSec * 3 * 1000);
    return nowMs - seenMs <= liveThresholdMs;
}

export async function saveRadioControlDeviceStatus(
    eventId: string,
    status: Partial<RadioControlDeviceStatus> & { deviceId: string }
): Promise<RadioControlDeviceStatus> {
    ensureOfflineHandlersRegistered();
    startOfflineQueueAutoFlush();

    const normalized = normalizeStatus(eventId, {
        ...status,
        mode: status.mode || 'radio_control',
        updatedAt: new Date().toISOString(),
        lastSeenAt: status.lastSeenAt || new Date().toISOString(),
    });

    upsertLocalStatus(eventId, normalized);
    emitLocalStatusesUpdated(eventId);

    if (!isFirebaseConfigured() || !firestore) {
        return normalized;
    }

    try {
        await persistRadioStatus(eventId, normalized);
    } catch (error) {
        console.error('Error saving radio control status:', error);
        enqueueOfflineAction({
            type: OFFLINE_ACTION_SAVE_RADIO_STATUS,
            payload: {
                eventId,
                status: normalized,
            },
            context: {
                eventId,
                label: normalized.stationName || normalized.stationCode || normalized.deviceId,
            },
        });
        void flushOfflineActions({ eventId });
    }

    return normalized;
}

export async function saveRadioControlPassage(
    eventId: string,
    passage: Partial<RadioControlPassage> & {
        deviceId: string;
        cardNumber: string;
        source: RadioPassageSource;
    }
): Promise<RadioControlPassage> {
    ensureOfflineHandlersRegistered();
    startOfflineQueueAutoFlush();

    const normalized = normalizePassage(eventId, {
        ...passage,
        createdAt: passage.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        readAt: passage.readAt || new Date().toISOString(),
    });

    addLocalPassage(eventId, normalized);
    emitLocalPassagesUpdated(eventId);

    if (!isFirebaseConfigured() || !firestore) {
        return normalized;
    }

    try {
        await persistRadioPassage(eventId, normalized);
    } catch (error) {
        console.error('Error saving radio passage:', error);
        enqueueOfflineAction({
            type: OFFLINE_ACTION_SAVE_RADIO_PASSAGE,
            payload: {
                eventId,
                passage: normalized,
            },
            context: {
                eventId,
                label: `${normalized.stationCode || 'Radio'} · ${normalized.cardNumber}`,
            },
        });
        void flushOfflineActions({ eventId });
    }

    return normalized;
}

export async function getRadioControlDevices(eventId: string): Promise<RadioControlDeviceStatus[]> {
    if (!isFirebaseConfigured() || !firestore) {
        return getLocalStatuses(eventId);
    }

    try {
        const snapshot = await getDocs(query(
            collection(firestore, COLLECTIONS.EVENTS, eventId, 'radioControls'),
            orderBy('updatedAt', 'desc')
        ));
        const statuses = snapshot.docs.map((statusDoc) =>
            parseFirestoreStatus(eventId, statusDoc.id, statusDoc.data())
        );
        saveLocalStatuses(eventId, statuses);
        return sortStatuses(statuses);
    } catch (error) {
        console.error('Error fetching radio controls:', error);
        return getLocalStatuses(eventId);
    }
}

export function subscribeToRadioControlDevices(
    eventId: string,
    callback: (statuses: RadioControlDeviceStatus[]) => void
) {
    if (!isFirebaseConfigured() || !firestore) {
        callback(getLocalStatuses(eventId));

        const customUpdateHandler = (event: Event) => {
            const typedEvent = event as CustomEvent<{ eventId: string }>;
            if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
            callback(getLocalStatuses(eventId));
        };
        const storageHandler = () => callback(getLocalStatuses(eventId));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_RADIO_STATUS_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_RADIO_STATUS_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const q = query(
        collection(firestore, COLLECTIONS.EVENTS, eventId, 'radioControls'),
        orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const statuses = snapshot.docs.map((statusDoc) =>
            parseFirestoreStatus(eventId, statusDoc.id, statusDoc.data())
        );
        saveLocalStatuses(eventId, statuses);
        callback(sortStatuses(statuses));
    }, (error) => {
        console.error('Error subscribing to radio controls:', error);
        callback(getLocalStatuses(eventId));
    });
}

export function subscribeToRadioControlPassages(
    eventId: string,
    callback: (passages: RadioControlPassage[]) => void,
    options?: { limit?: number }
) {
    const maxItems = Math.max(1, Math.round(Number(options?.limit || 100)));

    if (!isFirebaseConfigured() || !firestore) {
        callback(getLocalPassages(eventId).slice(0, maxItems));

        const customUpdateHandler = (event: Event) => {
            const typedEvent = event as CustomEvent<{ eventId: string }>;
            if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
            callback(getLocalPassages(eventId).slice(0, maxItems));
        };
        const storageHandler = () => callback(getLocalPassages(eventId).slice(0, maxItems));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_RADIO_PASSAGES_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_RADIO_PASSAGES_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const q = query(
        collection(firestore, COLLECTIONS.EVENTS, eventId, 'radioPassages'),
        orderBy('readAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const passages = snapshot.docs.map((passageDoc) =>
            parseFirestorePassage(eventId, passageDoc.id, passageDoc.data())
        );
        saveLocalPassages(eventId, passages);
        callback(sortPassages(passages).slice(0, maxItems));
    }, (error) => {
        console.error('Error subscribing to radio passages:', error);
        callback(getLocalPassages(eventId).slice(0, maxItems));
    });
}
