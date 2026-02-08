import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    limit as queryLimit,
    type DocumentData,
    type QueryConstraint,
} from 'firebase/firestore';
import { firestore, COLLECTIONS, isFirebaseConfigured } from '../firebase';

export type TrainingSessionResult = 'ok' | 'mp' | 'dnf';

export interface TrainingSessionRecord {
    id: string;
    eventId: string;
    courseId: string;
    courseName: string;
    userId?: string;
    userName?: string;
    finishedAt: string;
    elapsedSeconds: number;
    punchedCount: number;
    expectedCount: number;
    result: TrainingSessionResult;
    missingControls: string[];
    createdAt: string;
    updatedAt: string;
}

export interface TrainingSessionQueryOptions {
    courseId?: string;
    limit?: number;
}

const LOCAL_TRAINING_EVENT = 'splitmark:training-sessions-updated';

function localStorageKey(eventId: string): string {
    return `splitmark:training-sessions:${eventId}`;
}

function safeIso(value: unknown, fallbackIso: string): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }

    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    return fallbackIso;
}

function toTrainingResult(value: unknown): TrainingSessionResult {
    if (value === 'ok' || value === 'mp') return value;
    return 'dnf';
}

function normalizeTrainingSession(
    eventId: string,
    session: Partial<TrainingSessionRecord> & { id: string; courseId: string; courseName: string }
): TrainingSessionRecord {
    const now = new Date().toISOString();

    return {
        id: String(session.id),
        eventId,
        courseId: String(session.courseId),
        courseName: String(session.courseName),
        userId: typeof session.userId === 'string' && session.userId.trim() ? session.userId : undefined,
        userName: typeof session.userName === 'string' && session.userName.trim() ? session.userName : undefined,
        finishedAt: safeIso(session.finishedAt, now),
        elapsedSeconds: Math.max(0, Math.round(Number(session.elapsedSeconds || 0))),
        punchedCount: Math.max(0, Math.round(Number(session.punchedCount || 0))),
        expectedCount: Math.max(0, Math.round(Number(session.expectedCount || 0))),
        result: toTrainingResult(session.result),
        missingControls: Array.isArray(session.missingControls)
            ? session.missingControls.map((value) => String(value))
            : [],
        createdAt: safeIso(session.createdAt, now),
        updatedAt: safeIso(session.updatedAt, now),
    };
}

function parseFirestoreSession(docId: string, eventId: string, data: DocumentData): TrainingSessionRecord {
    const finishedAtRaw = data.finishedAt?.toDate?.() || data.finishedAt;
    const createdAtRaw = data.createdAt?.toDate?.() || data.createdAt;
    const updatedAtRaw = data.updatedAt?.toDate?.() || data.updatedAt;

    return normalizeTrainingSession(eventId, {
        id: docId,
        eventId,
        courseId: String(data.courseId || ''),
        courseName: String(data.courseName || 'Okänd bana'),
        userId: typeof data.userId === 'string' ? data.userId : undefined,
        userName: typeof data.userName === 'string' ? data.userName : undefined,
        finishedAt: finishedAtRaw,
        elapsedSeconds: Number(data.elapsedSeconds || 0),
        punchedCount: Number(data.punchedCount || 0),
        expectedCount: Number(data.expectedCount || 0),
        result: data.result,
        missingControls: Array.isArray(data.missingControls) ? data.missingControls : [],
        createdAt: createdAtRaw,
        updatedAt: updatedAtRaw,
    });
}

function sortByFinishDesc(sessions: TrainingSessionRecord[]): TrainingSessionRecord[] {
    return [...sessions].sort((left, right) => {
        if (left.finishedAt === right.finishedAt) {
            return left.id.localeCompare(right.id);
        }
        return right.finishedAt.localeCompare(left.finishedAt);
    });
}

function applyFilters(
    sessions: TrainingSessionRecord[],
    options: TrainingSessionQueryOptions = {}
): TrainingSessionRecord[] {
    let filtered = sessions;

    if (options.courseId) {
        filtered = filtered.filter((session) => session.courseId === options.courseId);
    }

    if (typeof options.limit === 'number' && options.limit > 0) {
        filtered = filtered.slice(0, options.limit);
    }

    return filtered;
}

function getLocalSessions(eventId: string): TrainingSessionRecord[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(localStorageKey(eventId));
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        const normalized = parsed
            .filter((item) => item && typeof item === 'object')
            .map((item) => normalizeTrainingSession(eventId, item as TrainingSessionRecord));

        return sortByFinishDesc(normalized);
    } catch {
        return [];
    }
}

function saveLocalSessions(eventId: string, sessions: TrainingSessionRecord[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(localStorageKey(eventId), JSON.stringify(sortByFinishDesc(sessions)));
}

function upsertLocalSession(eventId: string, session: TrainingSessionRecord): void {
    const current = getLocalSessions(eventId);
    const existingIndex = current.findIndex((item) => item.id === session.id);

    if (existingIndex >= 0) {
        current[existingIndex] = {
            ...current[existingIndex],
            ...session,
        };
    } else {
        current.push(session);
    }

    saveLocalSessions(eventId, current);
}

function emitLocalSessionsUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_TRAINING_EVENT, { detail: { eventId } }));
}

export async function saveTrainingSession(
    eventId: string,
    session: Partial<TrainingSessionRecord> & { id: string; courseId: string; courseName: string }
): Promise<TrainingSessionRecord> {
    const normalized = normalizeTrainingSession(eventId, {
        ...session,
        eventId,
        updatedAt: new Date().toISOString(),
    });

    if (!isFirebaseConfigured() || !firestore) {
        upsertLocalSession(eventId, normalized);
        emitLocalSessionsUpdated(eventId);
        return normalized;
    }

    try {
        const sessionRef = doc(
            collection(firestore, COLLECTIONS.EVENTS, eventId, 'trainingSessions'),
            normalized.id
        );

        await setDoc(sessionRef, normalized, { merge: true });
    } catch (error) {
        console.error('Error saving training session:', error);
    } finally {
        upsertLocalSession(eventId, normalized);
        emitLocalSessionsUpdated(eventId);
    }

    return normalized;
}

export async function getTrainingSessions(
    eventId: string,
    options: TrainingSessionQueryOptions = {}
): Promise<TrainingSessionRecord[]> {
    if (!isFirebaseConfigured() || !firestore) {
        return applyFilters(getLocalSessions(eventId), options);
    }

    try {
        const sessionsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'trainingSessions');
        const constraints: QueryConstraint[] = [orderBy('finishedAt', 'desc')];
        if (typeof options.limit === 'number' && options.limit > 0) {
            constraints.push(queryLimit(options.limit));
        }

        const snapshot = await getDocs(query(sessionsRef, ...constraints));
        const sessions = snapshot.docs.map((sessionDoc) =>
            parseFirestoreSession(sessionDoc.id, eventId, sessionDoc.data())
        );
        return applyFilters(sortByFinishDesc(sessions), options);
    } catch (error) {
        console.error('Error fetching training sessions:', error);
        return applyFilters(getLocalSessions(eventId), options);
    }
}

export function subscribeToTrainingSessions(
    eventId: string,
    callback: (sessions: TrainingSessionRecord[]) => void,
    options: TrainingSessionQueryOptions = {}
) {
    if (!isFirebaseConfigured() || !firestore) {
        callback(applyFilters(getLocalSessions(eventId), options));

        const customUpdateHandler = (event: Event) => {
            const typedEvent = event as CustomEvent<{ eventId: string }>;
            if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
            callback(applyFilters(getLocalSessions(eventId), options));
        };
        const storageHandler = () => callback(applyFilters(getLocalSessions(eventId), options));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_TRAINING_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_TRAINING_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const sessionsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'trainingSessions');
    const constraints: QueryConstraint[] = [orderBy('finishedAt', 'desc')];
    if (typeof options.limit === 'number' && options.limit > 0) {
        constraints.push(queryLimit(options.limit));
    }

    const q = query(sessionsRef, ...constraints);

    return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map((sessionDoc) =>
            parseFirestoreSession(sessionDoc.id, eventId, sessionDoc.data())
        );
        callback(applyFilters(sortByFinishDesc(sessions), options));
    }, (error) => {
        console.error('Error subscribing to training sessions:', error);
        callback(applyFilters(getLocalSessions(eventId), options));
    });
}
