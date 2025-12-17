import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    type DocumentData
} from 'firebase/firestore';
import { firestore, COLLECTIONS } from '../firebase';

export interface SpeakerMessage {
    id: string;
    eventId: string;
    message: string;
    type: 'info' | 'highlight' | 'warning';
    timestamp: Date;
    author: string;
}

export const SPEAKER_COLLECTION = 'speaker_messages';

export async function addSpeakerMessage(eventId: string, message: string, type: 'info' | 'highlight' | 'warning' = 'info', author: string = 'Speaker') {
    if (!firestore) return;

    await addDoc(collection(firestore, SPEAKER_COLLECTION), {
        eventId,
        message,
        type,
        timestamp: Timestamp.now(),
        author
    });
}

export function subscribeToSpeakerMessages(eventId: string, callback: (messages: SpeakerMessage[]) => void) {
    if (!firestore) return () => { };

    const q = query(
        collection(firestore, SPEAKER_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
        })) as SpeakerMessage[];

        callback(messages);
    });
}
