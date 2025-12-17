/**
 * Social Features - Kudos and Comments
 * Firestore-backed social interactions for activity feed
 */

import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    type DocumentData,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '../firebase';

// Collections
const KUDOS_COLLECTION = 'kudos';
const COMMENTS_COLLECTION = 'activity_comments';

// Interfaces
export interface Kudos {
    id: string;
    activityId: string;
    userId: string;
    userName?: string;
    timestamp: Date;
}

export interface ActivityComment {
    id: string;
    activityId: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: Date;
}

// ==================== KUDOS ====================

/**
 * Add kudos to an activity
 */
export async function addKudos(activityId: string, userId: string, userName?: string): Promise<string | null> {
    if (!isFirebaseConfigured() || !firestore) {
        console.log('Firestore not configured, kudos not saved');
        return null;
    }

    try {
        const docRef = await addDoc(collection(firestore, KUDOS_COLLECTION), {
            activityId,
            userId,
            userName: userName || 'Anonym',
            timestamp: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding kudos:', error);
        return null;
    }
}

/**
 * Remove kudos from an activity
 */
export async function removeKudos(activityId: string, userId: string): Promise<boolean> {
    if (!isFirebaseConfigured() || !firestore) {
        return false;
    }

    try {
        const q = query(
            collection(firestore, KUDOS_COLLECTION),
            where('activityId', '==', activityId),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(firestore, KUDOS_COLLECTION, docSnapshot.id));
        }
        return true;
    } catch (error) {
        console.error('Error removing kudos:', error);
        return false;
    }
}

/**
 * Get kudos count for an activity
 */
export async function getKudosCount(activityId: string): Promise<number> {
    if (!isFirebaseConfigured() || !firestore) {
        return 0;
    }

    try {
        const q = query(
            collection(firestore, KUDOS_COLLECTION),
            where('activityId', '==', activityId)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting kudos count:', error);
        return 0;
    }
}

/**
 * Check if user has given kudos to an activity
 */
export async function hasUserGivenKudos(activityId: string, userId: string): Promise<boolean> {
    if (!isFirebaseConfigured() || !firestore) {
        return false;
    }

    try {
        const q = query(
            collection(firestore, KUDOS_COLLECTION),
            where('activityId', '==', activityId),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking kudos:', error);
        return false;
    }
}

/**
 * Subscribe to kudos for multiple activities
 */
export function subscribeToKudos(
    activityIds: string[],
    callback: (kudosMap: Map<string, { count: number; userIds: string[] }>) => void
): () => void {
    if (!isFirebaseConfigured() || !firestore || activityIds.length === 0) {
        callback(new Map());
        return () => { };
    }

    // Firestore 'in' queries limited to 30 items
    const limitedIds = activityIds.slice(0, 30);

    const q = query(
        collection(firestore, KUDOS_COLLECTION),
        where('activityId', 'in', limitedIds)
    );

    return onSnapshot(q, (snapshot) => {
        const kudosMap = new Map<string, { count: number; userIds: string[] }>();

        // Initialize all activity IDs
        limitedIds.forEach(id => kudosMap.set(id, { count: 0, userIds: [] }));

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const activityId = data.activityId;
            const existing = kudosMap.get(activityId) || { count: 0, userIds: [] };
            existing.count++;
            existing.userIds.push(data.userId);
            kudosMap.set(activityId, existing);
        });

        callback(kudosMap);
    });
}

// ==================== COMMENTS ====================

/**
 * Add a comment to an activity
 */
export async function addComment(
    activityId: string,
    userId: string,
    userName: string,
    text: string
): Promise<string | null> {
    if (!isFirebaseConfigured() || !firestore) {
        console.log('Firestore not configured, comment not saved');
        return null;
    }

    try {
        const docRef = await addDoc(collection(firestore, COMMENTS_COLLECTION), {
            activityId,
            userId,
            userName,
            text,
            timestamp: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding comment:', error);
        return null;
    }
}

/**
 * Get comments for an activity
 */
export async function getComments(activityId: string): Promise<ActivityComment[]> {
    if (!isFirebaseConfigured() || !firestore) {
        return [];
    }

    try {
        const q = query(
            collection(firestore, COMMENTS_COLLECTION),
            where('activityId', '==', activityId),
            orderBy('timestamp', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as ActivityComment[];
    } catch (error) {
        console.error('Error getting comments:', error);
        return [];
    }
}

/**
 * Subscribe to comments for an activity
 */
export function subscribeToComments(
    activityId: string,
    callback: (comments: ActivityComment[]) => void
): () => void {
    if (!isFirebaseConfigured() || !firestore) {
        callback([]);
        return () => { };
    }

    const q = query(
        collection(firestore, COMMENTS_COLLECTION),
        where('activityId', '==', activityId),
        orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const comments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as ActivityComment[];

        callback(comments);
    });
}

/**
 * Get comment count for multiple activities
 */
export async function getCommentCounts(activityIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    activityIds.forEach(id => counts.set(id, 0));

    if (!isFirebaseConfigured() || !firestore || activityIds.length === 0) {
        return counts;
    }

    try {
        const limitedIds = activityIds.slice(0, 30);
        const q = query(
            collection(firestore, COMMENTS_COLLECTION),
            where('activityId', 'in', limitedIds)
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach(doc => {
            const activityId = doc.data().activityId;
            counts.set(activityId, (counts.get(activityId) || 0) + 1);
        });

        return counts;
    } catch (error) {
        console.error('Error getting comment counts:', error);
        return counts;
    }
}
