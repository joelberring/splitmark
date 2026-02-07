import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../firebase';
import type { Entry } from '@/types/entry';

/**
 * Entries Service
 * Manages event participants in a subcollection: events/{eventId}/entries/{entryId}
 */

export async function getEntries(eventId: string): Promise<Entry[]> {
    if (!firestore) return [];

    try {
        const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');
        const snapshot = await getDocs(entriesRef);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Entry[];
    } catch (error) {
        console.error('Error fetching entries:', error);
        return [];
    }
}

export function subscribeToEntries(eventId: string, callback: (entries: Entry[]) => void) {
    if (!firestore) return () => { };

    const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');
    const q = query(entriesRef, orderBy('lastName', 'asc'), orderBy('firstName', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Entry[];
        callback(entries);
    });
}

export async function saveEntry(eventId: string, entry: Partial<Entry> & { id: string }) {
    if (!firestore) return;

    try {
        const entryRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'entries', entry.id);
        const data = {
            ...entry,
            updatedAt: new Date().toISOString()
        };
        await setDoc(entryRef, data, { merge: true });
    } catch (error) {
        console.error('Error saving entry:', error);
    }
}

export async function importEntries(eventId: string, entries: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>[]) {
    if (!firestore) return;

    const batch = writeBatch(firestore);
    const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');

    entries.forEach(entry => {
        const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const entryDoc = doc(entriesRef, id);
        batch.set(entryDoc, {
            ...entry,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    });

    await batch.commit();
}

export async function deleteEntry(eventId: string, entryId: string) {
    if (!firestore) return;

    try {
        const entryRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'entries', entryId);
        await deleteDoc(entryRef);
    } catch (error) {
        console.error('Error deleting entry:', error);
    }
}
