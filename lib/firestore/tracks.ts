import { firestore as db } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import type { GPSPoint, DBTrack } from '@/types/database';

/**
 * Douglas-Peucker algorithm for line simplification
 */
export function simplifyTrack(points: GPSPoint[], epsilon: number): GPSPoint[] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const last = points.length - 1;

    for (let i = 1; i < last; i++) {
        const d = perpendicularDistance(points[i], points[0], points[last]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > epsilon) {
        const res1 = simplifyTrack(points.slice(0, index + 1), epsilon);
        const res2 = simplifyTrack(points.slice(index), epsilon);
        return [...res1.slice(0, res1.length - 1), ...res2];
    } else {
        return [points[0], points[last]];
    }
}

function perpendicularDistance(p: GPSPoint, p1: GPSPoint, p2: GPSPoint): number {
    const x = p.lng;
    const y = p.lat;
    const x1 = p1.lng;
    const y1 = p1.lat;
    const x2 = p2.lng;
    const y2 = p2.lat;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Save track to Firestore
 */
export async function saveTrack(track: DBTrack, userId: string): Promise<void> {
    const trackRef = doc(collection(db, 'tracks'), track.localId);

    // Simplify points for storage if too many (keep accuracy ~2m)
    const points = track.points || [];
    const simplified = points.length > 500 ? simplifyTrack(points, 0.00002) : points;

    await setDoc(trackRef, {
        ...track,
        userId,
        points: simplified,
        updatedAt: Timestamp.now(),
        pointCount: simplified.length,
        originalCount: points.length,
    });
}

/**
 * Get track from Firestore
 */
export async function getTrack(trackId: string): Promise<DBTrack | null> {
    const docRef = doc(db, 'tracks', trackId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            ...data,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : data.startTime,
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : data.endTime,
        } as DBTrack;
    }
    return null;
}

/**
 * List tracks for a user or event
 */
export async function listTracks(options: { userId?: string, eventId?: string }): Promise<DBTrack[]> {
    let q = query(collection(db, 'tracks'), orderBy('startTime', 'desc'));

    if (options.userId) {
        q = query(q, where('userId', '==', options.userId));
    }
    if (options.eventId) {
        q = query(q, where('eventId', '==', options.eventId));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : data.startTime,
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : data.endTime,
        } as DBTrack;
    });
}
