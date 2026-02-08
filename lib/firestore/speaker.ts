import {
    collection,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
    setDoc,
    Timestamp,
    type DocumentData,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '../firebase';
import {
    enqueueOfflineAction,
    flushOfflineActions,
    registerOfflineActionHandler,
    startOfflineQueueAutoFlush,
} from '@/lib/offline/action-queue';

export interface SpeakerMessage {
    id: string;
    eventId: string;
    message: string;
    type: 'info' | 'highlight' | 'warning';
    timestamp: Date;
    author: string;
    pending?: boolean;
}

interface SpeakerMessagePayload {
    id: string;
    eventId: string;
    message: string;
    type: 'info' | 'highlight' | 'warning';
    author: string;
    timestampIso: string;
}

interface SaveSpeakerMessageOfflinePayload {
    message: SpeakerMessagePayload;
}

export const SPEAKER_COLLECTION = 'speaker_messages';

const LOCAL_SPEAKER_EVENT = 'splitmark:speaker-updated';
const OFFLINE_ACTION_SAVE_SPEAKER_MESSAGE = 'save_speaker_message';

let hasRegisteredOfflineSpeakerHandler = false;

function localStorageKey(eventId: string): string {
    return `splitmark:speaker:${eventId}`;
}

function safeDate(value: unknown): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function normalizeSpeakerMessage(
    eventId: string,
    input: Partial<SpeakerMessage> & { id: string; message: string }
): SpeakerMessage {
    return {
        id: String(input.id),
        eventId,
        message: String(input.message),
        type: input.type === 'highlight' || input.type === 'warning' ? input.type : 'info',
        timestamp: safeDate(input.timestamp),
        author: typeof input.author === 'string' && input.author.trim() ? input.author.trim() : 'Speaker',
        pending: !!input.pending,
    };
}

function sortMessages(messages: SpeakerMessage[]): SpeakerMessage[] {
    return [...messages].sort((left, right) => {
        const delta = right.timestamp.getTime() - left.timestamp.getTime();
        if (delta !== 0) return delta;
        return right.id.localeCompare(left.id);
    });
}

function getLocalSpeakerMessages(eventId: string): SpeakerMessage[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(localStorageKey(eventId));
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        const normalized = parsed
            .filter((item) => item && typeof item === 'object' && item.id && item.message)
            .map((item) => normalizeSpeakerMessage(eventId, item as SpeakerMessage));

        return sortMessages(normalized);
    } catch {
        return [];
    }
}

function saveLocalSpeakerMessages(eventId: string, messages: SpeakerMessage[]): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
        localStorageKey(eventId),
        JSON.stringify(
            sortMessages(messages).map((message) => ({
                ...message,
                timestamp: message.timestamp.toISOString(),
            }))
        )
    );
}

function upsertLocalSpeakerMessage(eventId: string, message: SpeakerMessage): void {
    const current = getLocalSpeakerMessages(eventId);
    const index = current.findIndex((item) => item.id === message.id);

    if (index >= 0) {
        current[index] = {
            ...current[index],
            ...message,
        };
    } else {
        current.push(message);
    }

    saveLocalSpeakerMessages(eventId, current);
}

function markLocalSpeakerMessagePending(eventId: string, messageId: string, pending: boolean): void {
    const current = getLocalSpeakerMessages(eventId);
    const index = current.findIndex((item) => item.id === messageId);
    if (index < 0) return;

    current[index] = {
        ...current[index],
        pending,
    };

    saveLocalSpeakerMessages(eventId, current);
    emitLocalSpeakerUpdated(eventId);
}

function emitLocalSpeakerUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_SPEAKER_EVENT, { detail: { eventId } }));
}

function mergeSpeakerMessages(remote: SpeakerMessage[], local: SpeakerMessage[]): SpeakerMessage[] {
    const byId = new Map<string, SpeakerMessage>();

    for (const message of remote) {
        byId.set(message.id, message);
    }

    for (const message of local) {
        const existing = byId.get(message.id);
        if (!existing) {
            byId.set(message.id, message);
            continue;
        }

        byId.set(message.id, {
            ...existing,
            pending: message.pending,
        });
    }

    return sortMessages(Array.from(byId.values()));
}

function toPayload(message: SpeakerMessage): SpeakerMessagePayload {
    return {
        id: message.id,
        eventId: message.eventId,
        message: message.message,
        type: message.type,
        author: message.author,
        timestampIso: message.timestamp.toISOString(),
    };
}

function fromPayload(payload: SpeakerMessagePayload): SpeakerMessage {
    return {
        id: payload.id,
        eventId: payload.eventId,
        message: payload.message,
        type: payload.type,
        author: payload.author,
        timestamp: safeDate(payload.timestampIso),
        pending: false,
    };
}

function parseFirestoreMessage(docId: string, data: DocumentData): SpeakerMessage {
    return normalizeSpeakerMessage(String(data.eventId || ''), {
        id: docId,
        eventId: String(data.eventId || ''),
        message: String(data.message || ''),
        type: data.type,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        author: typeof data.author === 'string' ? data.author : 'Speaker',
        pending: false,
    });
}

async function persistSpeakerMessage(message: SpeakerMessage): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        throw new Error('Firestore är inte tillgängligt');
    }

    const ref = doc(collection(firestore, SPEAKER_COLLECTION), message.id);
    await setDoc(ref, {
        eventId: message.eventId,
        message: message.message,
        type: message.type,
        timestamp: Timestamp.fromDate(message.timestamp),
        author: message.author,
        updatedAt: Timestamp.now(),
    }, { merge: true });
}

function ensureOfflineSpeakerHandlerRegistered(): void {
    if (hasRegisteredOfflineSpeakerHandler) return;

    registerOfflineActionHandler<SaveSpeakerMessageOfflinePayload>(
        OFFLINE_ACTION_SAVE_SPEAKER_MESSAGE,
        async (payload) => {
            const message = fromPayload(payload.message);
            await persistSpeakerMessage(message);
            markLocalSpeakerMessagePending(message.eventId, message.id, false);
        }
    );

    hasRegisteredOfflineSpeakerHandler = true;
}

export async function addSpeakerMessage(
    eventId: string,
    message: string,
    type: 'info' | 'highlight' | 'warning' = 'info',
    author: string = 'Speaker'
) {
    const trimmed = message.trim();
    if (!trimmed) return;

    ensureOfflineSpeakerHandlerRegistered();
    startOfflineQueueAutoFlush();

    const nextMessage: SpeakerMessage = {
        id: `speaker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventId,
        message: trimmed,
        type,
        timestamp: new Date(),
        author,
        pending: false,
    };

    upsertLocalSpeakerMessage(eventId, nextMessage);
    emitLocalSpeakerUpdated(eventId);

    if (!isFirebaseConfigured() || !firestore) {
        return;
    }

    try {
        await persistSpeakerMessage(nextMessage);
        markLocalSpeakerMessagePending(eventId, nextMessage.id, false);
    } catch (error) {
        console.error('Error saving speaker message:', error);
        markLocalSpeakerMessagePending(eventId, nextMessage.id, true);

        enqueueOfflineAction({
            type: OFFLINE_ACTION_SAVE_SPEAKER_MESSAGE,
            payload: {
                message: toPayload(nextMessage),
            },
            context: {
                eventId,
                label: nextMessage.message.slice(0, 80),
            },
        });

        void flushOfflineActions({ eventId });
    }
}

export function subscribeToSpeakerMessages(eventId: string, callback: (messages: SpeakerMessage[]) => void) {
    ensureOfflineSpeakerHandlerRegistered();
    startOfflineQueueAutoFlush();

    const emitLocal = () => callback(getLocalSpeakerMessages(eventId));
    emitLocal();

    const customUpdateHandler = (event: Event) => {
        const typedEvent = event as CustomEvent<{ eventId: string }>;
        if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
        emitLocal();
    };

    const storageHandler = () => emitLocal();

    if (typeof window !== 'undefined') {
        window.addEventListener(LOCAL_SPEAKER_EVENT, customUpdateHandler as EventListener);
        window.addEventListener('storage', storageHandler);
    }

    if (!isFirebaseConfigured() || !firestore) {
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_SPEAKER_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const q = query(
        collection(firestore, SPEAKER_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('timestamp', 'desc')
    );

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const remoteMessages = snapshot.docs.map((snapshotDoc) =>
            parseFirestoreMessage(snapshotDoc.id, snapshotDoc.data())
        );

        for (const message of remoteMessages) {
            upsertLocalSpeakerMessage(eventId, {
                ...message,
                pending: false,
            });
        }

        const merged = mergeSpeakerMessages(remoteMessages, getLocalSpeakerMessages(eventId));
        callback(merged);
    }, (error) => {
        console.error('Error subscribing to speaker messages:', error);
        emitLocal();
    });

    return () => {
        unsubscribeSnapshot();
        if (typeof window !== 'undefined') {
            window.removeEventListener(LOCAL_SPEAKER_EVENT, customUpdateHandler as EventListener);
            window.removeEventListener('storage', storageHandler);
        }
    };
}
