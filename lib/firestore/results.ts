import {
    collection,
    doc,
    getDocs,
    setDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { firestore, COLLECTIONS, isFirebaseConfigured } from '../firebase';
import type { EntryWithResult } from '@/types/entry';

const LOCAL_RESULTS_EVENT = 'splitmark:results-updated';

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

function deriveResultsFromEntries(entries: any[]): EntryWithResult[] {
    return entries
        .filter((entry: any) => entry.status === 'finished' || entry.resultStatus)
        .map((entry: any, index: number) => ({
            ...entry,
            id: entry.id,
            position: entry.position || index + 1,
        })) as EntryWithResult[];
}

function getLocalResults(eventId: string): EntryWithResult[] {
    const events = getLocalEventsStore();
    const event = events.find((item: any) => item.id === eventId);
    if (!event) return [];

    if (Array.isArray(event.results) && event.results.length > 0) {
        return event.results as EntryWithResult[];
    }

    if (Array.isArray(event.entries)) {
        return deriveResultsFromEntries(event.entries);
    }

    return [];
}

function upsertLocalResult(eventId: string, result: EntryWithResult): void {
    const events = getLocalEventsStore();
    const eventIndex = events.findIndex((item: any) => item.id === eventId);
    if (eventIndex < 0) return;

    const existing = Array.isArray(events[eventIndex].results) ? events[eventIndex].results : [];
    const resultIndex = existing.findIndex((item: any) => item.id === result.id);

    if (resultIndex >= 0) {
        existing[resultIndex] = { ...existing[resultIndex], ...result };
    } else {
        existing.push(result);
    }

    events[eventIndex].results = existing;
    saveLocalEventsStore(events);
}

function emitLocalResultsUpdated(eventId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LOCAL_RESULTS_EVENT, { detail: { eventId } }));
}

export async function getResultsByClass(eventId: string, classId: string): Promise<EntryWithResult[]> {
    if (!isFirebaseConfigured() || !firestore) {
        return getLocalResults(eventId).filter(result => result.classId === classId);
    }

    try {
        const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');
        const q = query(
            resultsRef,
            where('classId', '==', classId),
            orderBy('runningTime', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as EntryWithResult[];
    } catch (error) {
        console.error('Error fetching results:', error);
        return getLocalResults(eventId).filter(result => result.classId === classId);
    }
}

export function subscribeToResults(eventId: string, callback: (results: EntryWithResult[]) => void) {
    if (!isFirebaseConfigured() || !firestore) {
        callback(getLocalResults(eventId));

        const customUpdateHandler = (event: Event) => {
            const typedEvent = event as CustomEvent<{ eventId: string }>;
            if (!typedEvent.detail || typedEvent.detail.eventId !== eventId) return;
            callback(getLocalResults(eventId));
        };
        const storageHandler = () => callback(getLocalResults(eventId));

        if (typeof window !== 'undefined') {
            window.addEventListener(LOCAL_RESULTS_EVENT, customUpdateHandler as EventListener);
            window.addEventListener('storage', storageHandler);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener(LOCAL_RESULTS_EVENT, customUpdateHandler as EventListener);
                window.removeEventListener('storage', storageHandler);
            }
        };
    }

    const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');
    const q = query(resultsRef, orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as EntryWithResult[];
        callback(results);
    }, (error) => {
        console.error('Error subscribing to results:', error);
        callback(getLocalResults(eventId));
    });
}

export async function publishResult(eventId: string, result: EntryWithResult) {
    const data = {
        ...result,
        updatedAt: new Date().toISOString()
    };

    if (!isFirebaseConfigured() || !firestore) {
        upsertLocalResult(eventId, data);
        emitLocalResultsUpdated(eventId);
        return;
    }

    try {
        const resultRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'results', result.id);
        await setDoc(resultRef, data, { merge: true });
    } catch (error) {
        console.error('Error publishing result:', error);
    } finally {
        upsertLocalResult(eventId, data);
        emitLocalResultsUpdated(eventId);
    }
}

export async function batchPublishResults(eventId: string, results: EntryWithResult[]) {
    if (!isFirebaseConfigured() || !firestore) {
        results.forEach(result => upsertLocalResult(eventId, result));
        emitLocalResultsUpdated(eventId);
        return;
    }

    const batch = writeBatch(firestore);
    const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');

    results.forEach(result => {
        const resultDoc = doc(resultsRef, result.id);
        batch.set(resultDoc, {
            ...result,
            updatedAt: new Date().toISOString()
        });
    });

    await batch.commit();
    results.forEach(result => upsertLocalResult(eventId, result));
    emitLocalResultsUpdated(eventId);
}

