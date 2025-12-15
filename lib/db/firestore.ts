/**
 * Firestore Collections and CRUD Operations
 * Cloud persistence layer for multi-device sync
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    writeBatch,
    type Firestore,
    type DocumentReference,
    type QueryConstraint,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import type { Club, Team, UserWithRoles, ClubMembershipRequest, EventRoleAssignment } from '@/types/roles';
import type { Comment, ChatMessage, ChatRoom, TrainingSignup, EventRegistration } from '@/types/social';

// Collection names
const COLLECTIONS = {
    users: 'users',
    clubs: 'clubs',
    teams: 'teams',
    events: 'events',
    membershipRequests: 'membershipRequests',
    comments: 'comments',
    chatRooms: 'chatRooms',
    chatMessages: 'chatMessages',
    trainings: 'trainings',
    trainingSignups: 'trainingSignups',
    eventRegistrations: 'eventRegistrations',
    tracks: 'tracks',
} as const;

// ============= Users =============

export async function getUser(userId: string): Promise<UserWithRoles | null> {
    if (!firestore) return null;

    const docRef = doc(firestore, COLLECTIONS.users, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as UserWithRoles;
    }
    return null;
}

export async function createOrUpdateUser(user: Partial<UserWithRoles> & { id: string }): Promise<void> {
    if (!firestore) return;

    const docRef = doc(firestore, COLLECTIONS.users, user.id);
    await setDoc(docRef, {
        ...user,
        lastLoginAt: Timestamp.now(),
    }, { merge: true });
}

export async function updateUserClubRole(
    userId: string,
    clubId: string,
    role: 'club_admin' | 'trainer' | 'member',
    invitedBy: string
): Promise<void> {
    if (!firestore) return;

    const userRef = doc(firestore, COLLECTIONS.users, userId);
    await updateDoc(userRef, {
        [`clubs.${clubId}`]: {
            role,
            teams: [],
            trainedTeams: [],
            joinedAt: Timestamp.now(),
            invitedBy,
        },
    });
}

// ============= Clubs =============

export async function getClub(clubId: string): Promise<Club | null> {
    if (!firestore) return null;

    const docRef = doc(firestore, COLLECTIONS.clubs, clubId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Club;
    }
    return null;
}

export async function getAllClubs(): Promise<Club[]> {
    if (!firestore) return [];

    const querySnapshot = await getDocs(collection(firestore, COLLECTIONS.clubs));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Club);
}

export async function createClub(club: Omit<Club, 'id'>): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.clubs));
    await setDoc(docRef, {
        ...club,
        createdAt: Timestamp.now(),
        memberCount: 0,
    });
    return docRef.id;
}

export async function updateClubSettings(
    clubId: string,
    settings: Partial<Club['settings']>
): Promise<void> {
    if (!firestore) return;

    const docRef = doc(firestore, COLLECTIONS.clubs, clubId);
    await updateDoc(docRef, {
        settings,
    });
}

// ============= Teams =============

export async function getTeamsByClub(clubId: string): Promise<Team[]> {
    if (!firestore) return [];

    const q = query(
        collection(firestore, COLLECTIONS.teams),
        where('clubId', '==', clubId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Team);
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.teams));
    await setDoc(docRef, {
        ...team,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function addMemberToTeam(teamId: string, userId: string): Promise<void> {
    if (!firestore) return;

    const docRef = doc(firestore, COLLECTIONS.teams, teamId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const members = docSnap.data().members || [];
        if (!members.includes(userId)) {
            await updateDoc(docRef, {
                members: [...members, userId],
            });
        }
    }
}

// ============= Membership Requests =============

export async function createMembershipRequest(
    request: Omit<ClubMembershipRequest, 'id'>
): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.membershipRequests));
    await setDoc(docRef, {
        ...request,
        requestedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getPendingMembershipRequests(clubId: string): Promise<ClubMembershipRequest[]> {
    if (!firestore) return [];

    const q = query(
        collection(firestore, COLLECTIONS.membershipRequests),
        where('clubId', '==', clubId),
        where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ClubMembershipRequest);
}

export async function processMembershipRequest(
    requestId: string,
    status: 'approved' | 'rejected' | 'blocked',
    processedBy: string,
    rejectionReason?: string
): Promise<void> {
    if (!firestore) return;

    const docRef = doc(firestore, COLLECTIONS.membershipRequests, requestId);
    await updateDoc(docRef, {
        status,
        processedBy,
        processedAt: Timestamp.now(),
        rejectionReason,
    });
}

// ============= Comments =============

export async function getComments(
    resourceType: string,
    resourceId: string
): Promise<Comment[]> {
    if (!firestore) return [];

    const q = query(
        collection(firestore, COLLECTIONS.comments),
        where('resourceType', '==', resourceType),
        where('resourceId', '==', resourceId),
        orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Comment);
}

export async function addComment(comment: Omit<Comment, 'id'>): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.comments));
    await setDoc(docRef, {
        ...comment,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

// ============= Chat =============

export async function getChatRoom(roomId: string): Promise<ChatRoom | null> {
    if (!firestore) return null;

    const docRef = doc(firestore, COLLECTIONS.chatRooms, roomId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ChatRoom;
    }
    return null;
}

export async function createChatRoom(room: Omit<ChatRoom, 'id'>): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.chatRooms));
    await setDoc(docRef, {
        ...room,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function sendChatMessage(message: Omit<ChatMessage, 'id'>): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.chatMessages));
    await setDoc(docRef, {
        ...message,
        timestamp: Timestamp.now(),
    });

    // Update room's last message
    const roomRef = doc(firestore, COLLECTIONS.chatRooms, message.roomId);
    await updateDoc(roomRef, {
        lastMessage: {
            ...message,
            timestamp: Timestamp.now(),
        },
    });

    return docRef.id;
}

export function subscribeToChatMessages(
    roomId: string,
    callback: (messages: ChatMessage[]) => void
): () => void {
    if (!firestore) return () => { };

    const q = query(
        collection(firestore, COLLECTIONS.chatMessages),
        where('roomId', '==', roomId),
        orderBy('timestamp', 'asc'),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }) as ChatMessage);
        callback(messages);
    });
}

// ============= Training Signups =============

export async function createTrainingSignup(
    signup: Omit<TrainingSignup, 'id'>
): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.trainingSignups));
    await setDoc(docRef, {
        ...signup,
        signupTime: Timestamp.now(),
    });
    return docRef.id;
}

export async function getTrainingSignups(trainingId: string): Promise<TrainingSignup[]> {
    if (!firestore) return [];

    const q = query(
        collection(firestore, COLLECTIONS.trainingSignups),
        where('trainingId', '==', trainingId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as TrainingSignup);
}

// ============= Event Registrations =============

export async function createEventRegistration(
    registration: Omit<EventRegistration, 'id'>
): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const docRef = doc(collection(firestore, COLLECTIONS.eventRegistrations));
    await setDoc(docRef, {
        ...registration,
        registeredAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    if (!firestore) return [];

    const q = query(
        collection(firestore, COLLECTIONS.eventRegistrations),
        where('eventId', '==', eventId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as EventRegistration);
}

// ============= Batch Operations =============

export async function batchUpdateUsers(
    updates: Array<{ id: string; data: Partial<UserWithRoles> }>
): Promise<void> {
    if (!firestore) return;

    const batch = writeBatch(firestore);

    for (const update of updates) {
        const docRef = doc(firestore, COLLECTIONS.users, update.id);
        batch.update(docRef, update.data);
    }

    await batch.commit();
}
