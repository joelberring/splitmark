import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../firebase';
import type { EntryWithResult } from '@/types/entry';

/**
 * Results Service
 * Manages race results in a subcollection: events/{eventId}/results/{entryId}
 */

export async function getResultsByClass(eventId: string, classId: string): Promise<EntryWithResult[]> {
    if (!firestore) return [];

    try {
        const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');
        const q = query(
            resultsRef,
            where('classId', '==', classId),
            where('status', '==', 'finished'),
            orderBy('runningTime', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as EntryWithResult[];
    } catch (error) {
        console.error('Error fetching results:', error);
        return [];
    }
}

export function subscribeToResults(eventId: string, callback: (results: EntryWithResult[]) => void) {
    if (!firestore) return () => { };

    const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');
    const q = query(resultsRef, orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as EntryWithResult[];
        callback(results);
    });
}

export async function publishResult(eventId: string, result: EntryWithResult) {
    if (!firestore) return;

    try {
        const resultRef = doc(firestore, COLLECTIONS.EVENTS, eventId, 'results', result.id);
        const data = {
            ...result,
            updatedAt: new Date().toISOString()
        };
        await setDoc(resultRef, data, { merge: true });
    } catch (error) {
        console.error('Error publishing result:', error);
    }
}

export async function batchPublishResults(eventId: string, results: EntryWithResult[]) {
    if (!firestore) return;

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
}
