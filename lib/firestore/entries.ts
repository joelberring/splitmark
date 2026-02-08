import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { firestore, COLLECTIONS, isFirebaseConfigured } from '../firebase';
import { getEvent, saveEvent } from './events';
import type { Entry } from '@/types/entry';
import {
    enqueueOfflineAction,
    flushOfflineActions,
    registerOfflineActionHandler,
    startOfflineQueueAutoFlush,
} from '@/lib/offline/action-queue';

/**
 * Entries Service
 * Manages event participants in a subcollection: events/{eventId}/entries/{entryId}
 * Includes localStorage fallback when Firebase is unavailable.
 */

export interface EntryRegistrationInput {
    userId?: string;
    firstName: string;
    lastName: string;
    classId: string;
    className: string;
    clubName: string;
    siCard?: string;
    email?: string;
    phone?: string;
    birthYear?: number;
    gender?: 'M' | 'F';
    teamName?: string;
    registrationGroupId?: string;
    registeredByUserId?: string;
    isClubEntry?: boolean;
}

export interface EntryBatchRegistrationResult {
    created: Entry[];
    duplicates: Entry[];
    skipped: number;
}

const LOCAL_ENTRIES_EVENT = 'splitmark:entries-updated';
const OFFLINE_ACTION_SAVE_ENTRY = 'save_entry';

interface SaveEntryOfflinePayload {
    eventId: string;
    entry: Partial<Entry> & { id: string };
}

let hasRegisteredOfflineSaveEntryHandler = false;

async function persistEntryToFirestore(eventId: string, entry: Partial<Entry> & { id: string }): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        throw new Error('Firestore är inte tillgängligt');
    }

    const entryRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'entries', entry.id);
    await setDoc(entryRef, entry, { merge: true });
}

function ensureOfflineSaveEntryHandlerRegistered(): void {
    if (hasRegisteredOfflineSaveEntryHandler) return;

    registerOfflineActionHandler<SaveEntryOfflinePayload>(OFFLINE_ACTION_SAVE_ENTRY, async (payload) => {
        await persistEntryToFirestore(payload.eventId, payload.entry);
    });

    hasRegisteredOfflineSaveEntryHandler = true;
}

function getLocalEventsStore(): any[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem('events') || '[]');
    } catch {
        return [];
    }
}

function saveLocalEventsStore(events: any[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('events', JSON.stringify(events));
}

function getLocalEntries(eventId: string): Entry[] {
    const events = getLocalEventsStore();
    const event = events.find((e: any) => e.id === eventId);
    if (!event || !Array.isArray(event.entries)) return [];
    return event.entries as Entry[];
}

function upsertLocalEntry(eventId: string, entry: Partial<Entry> & { id: string }): void {
    const events = getLocalEventsStore();
    const idx = events.findIndex((e: any) => e.id === eventId);
    if (idx < 0) return;

    const currentEntries = Array.isArray(events[idx].entries) ? events[idx].entries : [];
    const entryIdx = currentEntries.findIndex((e: any) => e.id === entry.id);

    if (entryIdx >= 0) {
        currentEntries[entryIdx] = { ...currentEntries[entryIdx], ...entry };
    } else {
        currentEntries.push(entry);
    }

    events[idx].entries = currentEntries;
    saveLocalEventsStore(events);
}

function deleteLocalEntry(eventId: string, entryId: string): void {
    const events = getLocalEventsStore();
    const idx = events.findIndex((e: any) => e.id === eventId);
    if (idx < 0) return;

    const currentEntries = Array.isArray(events[idx].entries) ? events[idx].entries : [];
    events[idx].entries = currentEntries.filter((entry: any) => entry.id !== entryId);
    saveLocalEventsStore(events);
}

function emitLocalEntriesUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_ENTRIES_EVENT, { detail: { eventId } }));
}

async function updateClassEntryCounts(eventId: string, increments: Record<string, number>): Promise<void> {
    const classIds = Object.keys(increments).filter((classId) => increments[classId] > 0);
    if (classIds.length === 0) return;

    const event = await getEvent(eventId);
    if (!event || !Array.isArray(event.classes)) return;

    let hasUpdated = false;
    const classes = event.classes.map((eventClass: any) => {
        const increment = Number(increments[eventClass.id] || 0);
        if (increment <= 0) return eventClass;
        hasUpdated = true;
        return {
            ...eventClass,
            entryCount: (Number(eventClass.entryCount) || 0) + increment,
        };
    });

    if (hasUpdated) {
        await saveEvent({ id: eventId, classes });
    }
}

export async function getEntries(eventId: string): Promise<Entry[]> {
    if (!isFirebaseConfigured() || !firestore) {
        return getLocalEntries(eventId);
    }

    try {
        const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');
        const snapshot = await getDocs(entriesRef);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Entry[];
    } catch (error) {
        console.error('Error fetching entries:', error);
        return getLocalEntries(eventId);
    }
}

export function subscribeToEntries(eventId: string, callback: (entries: Entry[]) => void) {
    if (!isFirebaseConfigured() || !firestore) {
        callback(getLocalEntries(eventId));

        const customUpdateHandler = (event: Event) => {
            const typedEvent = event as CustomEvent<{ eventId: string }>;
            if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
            callback(getLocalEntries(eventId));
        };
        const storageHandler = () => callback(getLocalEntries(eventId));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_ENTRIES_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_ENTRIES_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');
    const q = query(entriesRef, orderBy('lastName', 'asc'), orderBy('firstName', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Entry[];
        callback(entries);
    }, (error) => {
        console.error('Error subscribing to entries:', error);
        callback(getLocalEntries(eventId));
    });
}

export async function saveEntry(eventId: string, entry: Partial<Entry> & { id: string }) {
    ensureOfflineSaveEntryHandlerRegistered();
    startOfflineQueueAutoFlush();

    const data = {
        ...entry,
        updatedAt: new Date().toISOString()
    };

    upsertLocalEntry(eventId, data);
    emitLocalEntriesUpdated(eventId);

    if (!isFirebaseConfigured() || !firestore) return;

    try {
        await persistEntryToFirestore(eventId, data);
    } catch (error) {
        console.error('Error saving entry:', error);
        enqueueOfflineAction({
            type: OFFLINE_ACTION_SAVE_ENTRY,
            payload: {
                eventId,
                entry: data,
            },
            context: {
                eventId,
                label: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.id,
            },
        });
        void flushOfflineActions({ eventId });
    }
}

function isDuplicateRegistration(existingEntry: Entry, input: EntryRegistrationInput): boolean {
    if (existingEntry.status === 'cancelled') return false;

    if (input.userId) {
        return (existingEntry as any).userId === input.userId;
    }

    const existingFirst = (existingEntry.firstName || '').trim().toLowerCase();
    const existingLast = (existingEntry.lastName || '').trim().toLowerCase();
    const existingClub = (existingEntry.clubName || '').trim().toLowerCase();

    const inputFirst = input.firstName.trim().toLowerCase();
    const inputLast = input.lastName.trim().toLowerCase();
    const inputClub = input.clubName.trim().toLowerCase();

    return existingEntry.classId === input.classId
        && existingFirst === inputFirst
        && existingLast === inputLast
        && existingClub === inputClub;
}

function buildRegistrationEntry(eventId: string, input: EntryRegistrationInput): Entry {
    const now = new Date().toISOString();
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        id: entryId,
        eventId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        birthYear: input.birthYear,
        gender: input.gender,
        clubName: input.clubName.trim() || 'Okänd klubb',
        classId: input.classId,
        className: input.className,
        siCard: input.siCard?.trim() || undefined,
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        status: 'registered',
        entryType: 'normal',
        createdAt: now,
        updatedAt: now,
        userId: input.userId,
        teamName: input.teamName?.trim() || undefined,
        registrationGroupId: input.registrationGroupId,
        registeredByUserId: input.registeredByUserId,
        isClubEntry: !!input.isClubEntry,
    };
}

export async function registerEntriesBatch(
    eventId: string,
    inputs: EntryRegistrationInput[]
): Promise<EntryBatchRegistrationResult> {
    if (inputs.length === 0) {
        return { created: [], duplicates: [], skipped: 0 };
    }

    const existing = await getEntries(eventId);
    const mutableExisting = [...existing];
    const created: Entry[] = [];
    const duplicates: Entry[] = [];
    const classIncrements: Record<string, number> = {};
    let skipped = 0;

    for (const input of inputs) {
        if (!input.firstName.trim() || !input.lastName.trim() || !input.classId || !input.className) {
            skipped += 1;
            continue;
        }

        const duplicate = mutableExisting.find((entry) => isDuplicateRegistration(entry, input));
        if (duplicate) {
            duplicates.push(duplicate);
            continue;
        }

        const entry = buildRegistrationEntry(eventId, input);
        await saveEntry(eventId, entry);
        created.push(entry);
        mutableExisting.push(entry);
        classIncrements[input.classId] = (classIncrements[input.classId] || 0) + 1;
    }

    await updateClassEntryCounts(eventId, classIncrements);

    return { created, duplicates, skipped };
}

export async function registerEntry(eventId: string, input: EntryRegistrationInput): Promise<Entry> {
    const { created, duplicates } = await registerEntriesBatch(eventId, [input]);

    if (created.length > 0) return created[0];
    if (duplicates.length > 0) return duplicates[0];

    throw new Error('Kunde inte skapa anmälan.');
}

export async function importEntries(eventId: string, entries: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>[]) {
    if (!isFirebaseConfigured() || !firestore) {
        for (const entry of entries) {
            const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            await saveEntry(eventId, {
                ...entry,
                id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        return;
    }

    const batch = writeBatch(firestore);
    const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');

    entries.forEach(entry => {
        const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const entryDoc = doc(entriesRef, id);
        batch.set(entryDoc, {
            ...entry,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    });

    await batch.commit();
    emitLocalEntriesUpdated(eventId);
}

export async function deleteEntry(eventId: string, entryId: string) {
    if (!isFirebaseConfigured() || !firestore) {
        deleteLocalEntry(eventId, entryId);
        emitLocalEntriesUpdated(eventId);
        return;
    }

    try {
        const entryRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'entries', entryId);
        await deleteDoc(entryRef);
    } catch (error) {
        console.error('Error deleting entry:', error);
    } finally {
        deleteLocalEntry(eventId, entryId);
        emitLocalEntriesUpdated(eventId);
    }
}
