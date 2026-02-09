import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    setDoc,
    Timestamp,
    type DocumentData,
    where,
} from 'firebase/firestore';
import type { Query as FirestoreQuery } from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '@/lib/firebase';
import type {
    EventPlanningControl,
    EventPlanningCourse,
} from '@/lib/events/course-planning';

export type MapArchiveSourceFormat = 'image' | 'omap' | 'xmap' | 'ocad' | 'geotiff' | 'unknown';

export interface MapArchiveEntry {
    id: string;
    ownerUserId: string;
    ownerDisplayName?: string;
    clubId?: string;
    title: string;
    imageUrl: string;
    sourceFileName?: string;
    sourceFormat: MapArchiveSourceFormat;
    sourceVectorFile?: string;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    optimization?: {
        originalBytes?: number;
        processedBytes?: number;
        compressionRatio?: number;
        originalWidth?: number;
        originalHeight?: number;
        width?: number;
        height?: number;
        cropApplied?: boolean;
        cropRect?: { left: number; top: number; right: number; bottom: number };
        format?: string;
        quality?: number;
        preset?: 'balanced' | 'mobile' | 'highDetail' | 'custom';
        updatedAt?: string;
    };
    bounds?: unknown;
    calibration?: unknown;
    calibrationGCPs?: unknown[];
    ppenControls?: EventPlanningControl[];
    ppenCourses?: EventPlanningCourse[];
}

interface AccessOptions {
    userId: string;
    clubIds?: string[];
    includeClubShared?: boolean;
}

interface UpsertMapArchiveInput {
    id?: string;
    ownerUserId: string;
    ownerDisplayName?: string;
    clubId?: string;
    title: string;
    imageUrl: string;
    sourceFileName?: string;
    sourceFormat?: MapArchiveSourceFormat;
    sourceVectorFile?: string;
    optimization?: MapArchiveEntry['optimization'];
    bounds?: unknown;
    calibration?: unknown;
    calibrationGCPs?: unknown[];
    ppenControls?: EventPlanningControl[];
    ppenCourses?: EventPlanningCourse[];
}

const STORAGE_KEY = 'splitmark:map-archive:v1';
const STORAGE_EVENT = 'splitmark:map-archive-updated';

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

function normalizeSourceFormat(value: unknown): MapArchiveSourceFormat {
    if (value === 'image' || value === 'omap' || value === 'xmap' || value === 'ocad' || value === 'geotiff') {
        return value;
    }
    return 'unknown';
}

function normalizeEntry(input: Partial<MapArchiveEntry> & { id: string; ownerUserId?: string }): MapArchiveEntry {
    const nowIso = new Date().toISOString();
    const ownerUserId = String(input.ownerUserId || '').trim();

    return {
        id: String(input.id || `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        ownerUserId,
        ownerDisplayName: typeof input.ownerDisplayName === 'string' && input.ownerDisplayName.trim()
            ? input.ownerDisplayName.trim()
            : undefined,
        clubId: typeof input.clubId === 'string' && input.clubId.trim() ? input.clubId.trim() : undefined,
        title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Karta',
        imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '',
        sourceFileName: typeof input.sourceFileName === 'string' && input.sourceFileName.trim()
            ? input.sourceFileName.trim()
            : undefined,
        sourceFormat: normalizeSourceFormat(input.sourceFormat),
        sourceVectorFile: typeof input.sourceVectorFile === 'string' && input.sourceVectorFile.trim()
            ? input.sourceVectorFile.trim()
            : undefined,
        usageCount: Math.max(0, Math.round(Number(input.usageCount || 0))),
        createdAt: safeIso(input.createdAt, nowIso),
        updatedAt: safeIso(input.updatedAt, nowIso),
        lastUsedAt: input.lastUsedAt ? safeIso(input.lastUsedAt, nowIso) : undefined,
        optimization: input.optimization,
        bounds: input.bounds,
        calibration: input.calibration,
        calibrationGCPs: Array.isArray(input.calibrationGCPs) ? input.calibrationGCPs : undefined,
        ppenControls: Array.isArray(input.ppenControls) ? input.ppenControls : undefined,
        ppenCourses: Array.isArray(input.ppenCourses) ? input.ppenCourses : undefined,
    };
}

function sortEntries(entries: MapArchiveEntry[]): MapArchiveEntry[] {
    return [...entries].sort((left, right) => {
        const updated = right.updatedAt.localeCompare(left.updatedAt);
        if (updated !== 0) return updated;
        return right.createdAt.localeCompare(left.createdAt);
    });
}

function canAccessEntry(entry: MapArchiveEntry, options: AccessOptions): boolean {
    if (entry.ownerUserId === options.userId) return true;
    if (!options.includeClubShared) return false;
    if (!entry.clubId) return false;
    return (options.clubIds || []).includes(entry.clubId);
}

function emitLocalUpdate(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

function readLocalEntries(): MapArchiveEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return sortEntries(
            parsed
                .filter((item) => item && typeof item === 'object' && item.id && item.ownerUserId)
                .map((item) => normalizeEntry(item as MapArchiveEntry))
                .filter((item) => !!item.ownerUserId && !!item.imageUrl)
        );
    } catch {
        return [];
    }
}

function writeLocalEntries(entries: MapArchiveEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortEntries(entries)));
}

function upsertLocalEntry(entry: MapArchiveEntry): void {
    const current = readLocalEntries();
    const index = current.findIndex((item) => item.id === entry.id);
    if (index >= 0) {
        current[index] = {
            ...current[index],
            ...entry,
        };
    } else {
        current.push(entry);
    }
    writeLocalEntries(current);
}

function removeLocalEntry(entryId: string): void {
    const next = readLocalEntries().filter((item) => item.id !== entryId);
    writeLocalEntries(next);
}

function parseDoc(docId: string, data: DocumentData): MapArchiveEntry {
    return normalizeEntry({
        id: docId,
        ownerUserId: data.ownerUserId,
        ownerDisplayName: data.ownerDisplayName,
        clubId: data.clubId,
        title: data.title,
        imageUrl: data.imageUrl,
        sourceFileName: data.sourceFileName,
        sourceFormat: data.sourceFormat,
        sourceVectorFile: data.sourceVectorFile,
        usageCount: data.usageCount,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        lastUsedAt: data.lastUsedAt?.toDate?.() || data.lastUsedAt,
        optimization: data.optimization,
        bounds: data.bounds,
        calibration: data.calibration,
        calibrationGCPs: data.calibrationGCPs,
        ppenControls: data.ppenControls,
        ppenCourses: data.ppenCourses,
    });
}

function filterByAccess(entries: MapArchiveEntry[], options: AccessOptions): MapArchiveEntry[] {
    return sortEntries(entries.filter((entry) => canAccessEntry(entry, options)));
}

export function subscribeToMapArchiveEntries(
    options: AccessOptions,
    callback: (entries: MapArchiveEntry[]) => void
): () => void {
    const publishLocal = () => callback(filterByAccess(readLocalEntries(), options));

    if (!isFirebaseConfigured() || !firestore) {
        publishLocal();

        if (typeof window === 'undefined') return () => { };

        const storageHandler = (event: StorageEvent) => {
            if (event.key && event.key !== STORAGE_KEY) return;
            publishLocal();
        };
        const localEventHandler = () => publishLocal();

        window.addEventListener('storage', storageHandler);
        window.addEventListener(STORAGE_EVENT, localEventHandler as EventListener);

        return () => {
            window.removeEventListener('storage', storageHandler);
            window.removeEventListener(STORAGE_EVENT, localEventHandler as EventListener);
        };
    }

    const archiveRef = collection(firestore, 'map_archive');
    const sources = new Map<string, Map<string, MapArchiveEntry>>();
    const unsubscribers: Array<() => void> = [];

    const recompute = () => {
        const mergedById = new Map<string, MapArchiveEntry>();

        for (const sourceMap of sources.values()) {
            for (const [id, entry] of sourceMap.entries()) {
                mergedById.set(id, entry);
            }
        }

        // Merge in locally cached entries as offline fallback (cloud wins).
        for (const localEntry of readLocalEntries()) {
            if (!mergedById.has(localEntry.id)) {
                mergedById.set(localEntry.id, localEntry);
            }
        }

        const nextAll = Array.from(mergedById.values());
        writeLocalEntries(nextAll);
        callback(filterByAccess(nextAll, options));
    };

    const listen = (key: string, q: FirestoreQuery<DocumentData>) => {
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const next = new Map<string, MapArchiveEntry>();
            snapshot.docs.forEach((docSnap) => {
                next.set(docSnap.id, parseDoc(docSnap.id, docSnap.data()));
            });
            sources.set(key, next);
            recompute();
        }, (error) => {
            console.error(`Error subscribing to map archive (${key}):`, error);
            sources.set(key, new Map());
            recompute();
        });

        unsubscribers.push(unsubscribe);
    };

    listen('owner', query(archiveRef, where('ownerUserId', '==', options.userId)));

    if (options.includeClubShared) {
        const clubIds = Array.from(new Set((options.clubIds || []).filter(Boolean)));
        clubIds.forEach((clubId) => {
            listen(`club:${clubId}`, query(archiveRef, where('clubId', '==', clubId)));
        });
    }

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
}

export async function upsertMapArchiveEntry(input: UpsertMapArchiveInput): Promise<MapArchiveEntry> {
    const ownerUserId = String(input.ownerUserId || '').trim();
    const imageUrl = String(input.imageUrl || '').trim();
    if (!ownerUserId || !imageUrl) {
        throw new Error('Kunde inte spara kartarkivspost: användare eller kart-URL saknas.');
    }

    const nowIso = new Date().toISOString();
    let existing: MapArchiveEntry | null = null;
    if (input.id) {
        existing = await getMapArchiveEntry(input.id);
    }

    const normalized = normalizeEntry({
        id: input.id || `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ownerUserId,
        ownerDisplayName: input.ownerDisplayName,
        clubId: input.clubId,
        title: input.title,
        imageUrl,
        sourceFileName: input.sourceFileName,
        sourceFormat: input.sourceFormat || 'image',
        sourceVectorFile: input.sourceVectorFile,
        usageCount: existing?.usageCount || 0,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        lastUsedAt: existing?.lastUsedAt,
        optimization: input.optimization,
        bounds: input.bounds,
        calibration: input.calibration,
        calibrationGCPs: input.calibrationGCPs,
        ppenControls: input.ppenControls,
        ppenCourses: input.ppenCourses,
    });

    upsertLocalEntry(normalized);
    emitLocalUpdate();

    if (isFirebaseConfigured() && firestore) {
        const entryRef = doc(firestore, 'map_archive', normalized.id);
        await setDoc(entryRef, {
            ownerUserId: normalized.ownerUserId,
            ownerDisplayName: normalized.ownerDisplayName || null,
            clubId: normalized.clubId || null,
            title: normalized.title,
            imageUrl: normalized.imageUrl,
            sourceFileName: normalized.sourceFileName || null,
            sourceFormat: normalized.sourceFormat,
            sourceVectorFile: normalized.sourceVectorFile || null,
            usageCount: normalized.usageCount,
            createdAt: Timestamp.fromDate(new Date(normalized.createdAt)),
            updatedAt: Timestamp.fromDate(new Date(normalized.updatedAt)),
            lastUsedAt: normalized.lastUsedAt
                ? Timestamp.fromDate(new Date(normalized.lastUsedAt))
                : null,
            optimization: normalized.optimization || null,
            bounds: normalized.bounds || null,
            calibration: normalized.calibration || null,
            calibrationGCPs: normalized.calibrationGCPs || null,
            ppenControls: normalized.ppenControls || null,
            ppenCourses: normalized.ppenCourses || null,
        }, { merge: true });
    }

    return normalized;
}

export async function getMapArchiveEntry(entryId: string): Promise<MapArchiveEntry | null> {
    const normalizedId = String(entryId || '').trim();
    if (!normalizedId) return null;

    const local = readLocalEntries().find((item) => item.id === normalizedId) || null;
    if (!isFirebaseConfigured() || !firestore) {
        return local;
    }

    try {
        const entryRef = doc(firestore, 'map_archive', normalizedId);
        const snapshot = await getDoc(entryRef);
        if (!snapshot.exists()) return local;
        const parsed = parseDoc(snapshot.id, snapshot.data());
        upsertLocalEntry(parsed);
        return parsed;
    } catch (error) {
        console.error('Error reading map archive entry:', error);
        return local;
    }
}

export async function markMapArchiveEntryUsed(entry: MapArchiveEntry): Promise<MapArchiveEntry> {
    const updated = normalizeEntry({
        ...entry,
        usageCount: (entry.usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    upsertLocalEntry(updated);
    emitLocalUpdate();

    if (isFirebaseConfigured() && firestore) {
        const entryRef = doc(firestore, 'map_archive', updated.id);
        await setDoc(entryRef, {
            usageCount: updated.usageCount,
            lastUsedAt: Timestamp.fromDate(new Date(updated.lastUsedAt || updated.updatedAt)),
            updatedAt: Timestamp.fromDate(new Date(updated.updatedAt)),
        }, { merge: true });
    }

    return updated;
}

export async function deleteMapArchiveEntry(entryId: string): Promise<void> {
    const normalizedId = String(entryId || '').trim();
    if (!normalizedId) return;

    removeLocalEntry(normalizedId);
    emitLocalUpdate();

    if (isFirebaseConfigured() && firestore) {
        await deleteDoc(doc(firestore, 'map_archive', normalizedId));
    }
}
