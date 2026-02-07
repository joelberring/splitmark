import { firestore as db } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    updateDoc,
    deleteDoc,
    Timestamp,
    serverTimestamp,
    limit
} from 'firebase/firestore';
import type { ClubActivity, ActivityRegistration, LokStodReport } from '@/types/club-activities';

const ACTIVITIES_COLLECTION = 'club_activities';
const REGISTRATIONS_COLLECTION = 'activity_registrations';

/**
 * CRUD for Club Activities
 */
export async function createActivity(activity: Omit<ClubActivity, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), {
        ...activity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function getActivities(clubId: string, upcomingOnly = true): Promise<ClubActivity[]> {
    let q = query(
        collection(db, ACTIVITIES_COLLECTION),
        where('clubId', '==', clubId),
        orderBy('date', 'asc')
    );

    if (upcomingOnly) {
        q = query(q, where('date', '>=', new Date()));
    }

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClubActivity));
}

/**
 * Registration Logic
 */
export async function registerForActivity(
    clubId: string,
    activityId: string,
    userId: string,
    userName: string
): Promise<void> {
    const registrationId = `${activityId}_${userId}`;
    const regRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);

    await setDoc(regRef, {
        activityId,
        clubId,
        userId,
        userName,
        status: 'registered',
        registeredAt: serverTimestamp(),
    });
}

export async function getRegistrations(activityId: string): Promise<ActivityRegistration[]> {
    const q = query(
        collection(db, REGISTRATIONS_COLLECTION),
        where('activityId', '==', activityId),
        orderBy('userName', 'asc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityRegistration));
}

/**
 * LOK-stöd and Attendance
 */
export async function markAttendance(
    registrationId: string,
    status: 'attended' | 'no-show',
    adminId: string
): Promise<void> {
    const regRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
    await updateDoc(regRef, {
        status,
        markedAt: serverTimestamp(),
        markedBy: adminId
    });
}

/**
 * Generate LOK-stöd Summary (Mock/Logic)
 */
export async function generateLokReport(clubId: string, period: string): Promise<LokStodReport> {
    // In a real implementation, we would query registrations across the period
    // and filter by user age (7-20 years for Swedish LOK-stöd)
    return {
        clubId,
        period,
        totalActivities: 0,
        totalParticipations: 0,
        eligibleParticipations: 0,
        youthParticipations: 0,
        generatedAt: new Date(),
    };
}

/**
 * Training Feed: Get recent public tracks from club members
 */
export async function getClubTrainingFeed(clubId: string): Promise<any[]> {
    // Linked to the 'tracks' collection implemented previously
    const q = query(
        collection(db, 'tracks'),
        where('clubId', '==', clubId),
        where('visibility', 'in', ['public', 'club']), // visibility not yet in DBTrack, assume public for now
        orderBy('startTime', 'desc'),
        limit(20)
    );

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
