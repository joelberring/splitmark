/**
 * Firestore Events Service
 * Handles all event CRUD operations with Firebase Firestore
 * Falls back to localStorage when Firebase is not configured
 */

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    type QuerySnapshot,
    type DocumentData,
} from 'firebase/firestore';
import { firestore, COLLECTIONS, isFirebaseConfigured } from '../firebase';
import { initializeEventAdminsForNewEvent } from '../auth/event-admins';
import type {
    EventPlanningControl,
    EventPlanningCourse,
} from '@/lib/events/course-planning';

// Event types
export interface FirestoreEvent {
    id: string;
    name: string;
    date: string;
    time: string;
    location?: string;
    type: string;
    classification: string;
    status: 'draft' | 'upcoming' | 'live' | 'active' | 'completed';
    classes?: EventClass[];
    courses?: EventCourse[];
    ppenControls?: EventPlanningControl[];
    ppenCourses?: EventPlanningCourse[];
    map?: {
        imageUrl: string;
        name?: string;
        bounds?: any;
        scale?: number;
        visibility?: {
            mode?: 'always' | 'scheduled' | 'hidden';
            releaseAt?: string;
            hideAt?: string;
            fallbackBaseMap?: 'none' | 'osm';
        };
        optimization?: {
            originalBytes?: number;
            processedBytes?: number;
            compressionRatio?: number;
            originalWidth?: number;
            originalHeight?: number;
            width?: number;
            height?: number;
            cropApplied?: boolean;
            cropRect?: { left: number; top: number; right: number; bottom: number };
            format?: string;
            quality?: number;
            preset?: 'balanced' | 'mobile' | 'highDetail' | 'custom';
            updatedAt?: string;
        };
    };
    calibration?: any;
    calibrationAnchors?: any;
    worldFile?: any;
    organizer?: string;
    description?: string;
    googleMapsUrl?: string;
    attachments?: { id: string; name: string; url: string; type: string }[];
    images?: { id: string; url: string }[];
    visibility?: 'public' | 'club' | 'private';
    clubId?: string;
    entries?: EventEntry[];
    results?: any[];
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    eventAdminIds?: string[];
    externalId?: string;
    source?: 'manual' | 'eventor' | 'trail';
}

export interface EventClass {
    id: string;
    name: string;
    courseId?: string;
    courseName?: string;
    distance?: string;
    entryCount: number;
    hasPool?: boolean;
    forkKeys?: string[];
}

export interface EventEntry {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string; // Standardize to have both or one
    club: string;
    clubName?: string;
    classId: string;
    className?: string;
    siCard?: string;
    startTime?: string;
    status: 'registered' | 'confirmed' | 'started' | 'finished' | 'dns' | 'dnf' | 'dsq' | 'cancelled';
    resultStatus?: 'ok' | 'mp' | 'dnf' | 'dsq' | 'dns' | 'ot';
    time?: number;
    timeBehind?: number;
    position?: number;
    splitTimes?: { controlCode: string; time: number }[];
    forkKey?: string;
}

export interface EventCourse {
    id: string;
    name: string;
    length: number;
    climb?: number;
    controls: string[]; // IDs of controls
}

function normalizeEventStatus(status?: string): FirestoreEvent['status'] {
    const value = (status || '').trim().toLowerCase();

    if (['completed', 'finished', 'closed'].includes(value)) return 'completed';
    if (['live', 'ongoing', 'running'].includes(value)) return 'live';
    if (['active'].includes(value)) return 'active';
    if (['upcoming', 'scheduled', 'published', 'registration_open', 'open'].includes(value)) return 'upcoming';
    return 'draft';
}

function toFirestoreEvent(id: string, data: DocumentData): FirestoreEvent {
    return {
        id,
        ...data,
        status: normalizeEventStatus(data.status),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as FirestoreEvent;
}

function isPublishedEvent(event: FirestoreEvent): boolean {
    const status = normalizeEventStatus(event.status);
    if (status === 'draft') return false;
    if (event.visibility === 'private') return false;
    return true;
}

// ============= Firestore Operations =============

/**
 * Get all events from Firestore
 */
export async function getEvents(): Promise<FirestoreEvent[]> {
    // Check if Firebase is configured
    if (!isFirebaseConfigured() || !firestore) {
        console.log('Splitmark: Using Local Mode (Firebase not configured)');
        return getEventsFromLocalStorage();
    }
    console.log('Splitmark: Fetching events from Cloud/Firestore...');

    try {
        const eventsRef = collection(firestore, COLLECTIONS.EVENTS);
        const q = query(eventsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => toFirestoreEvent(doc.id, doc.data()));
    } catch (error) {
        console.error('Error fetching events from Firestore:', error);
        // Fallback to localStorage
        return getEventsFromLocalStorage();
    }
}

/**
 * Get a single event by ID
 */
export async function getEvent(eventId: string): Promise<FirestoreEvent | null> {
    if (!isFirebaseConfigured() || !firestore) {
        return getEventFromLocalStorage(eventId);
    }

    try {
        const eventRef = doc(firestore, COLLECTIONS.EVENTS, eventId);
        const snapshot = await getDoc(eventRef);

        if (!snapshot.exists()) {
            return null;
        }

        return toFirestoreEvent(snapshot.id, snapshot.data());
    } catch (error) {
        console.error('Error fetching event:', error);
        return getEventFromLocalStorage(eventId);
    }
}

/**
 * Save/update an event to Firestore
 */
export async function saveEvent(event: Partial<FirestoreEvent> & { id: string }): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        process.env.NODE_ENV !== 'production' && console.log('Using Local Mode for saveEvent');
        saveEventToLocalStorage(event);
        return;
    }
    process.env.NODE_ENV !== 'production' && console.log('Using Cloud Mode for saveEvent');

    try {
        const eventRef = doc(firestore, COLLECTIONS.EVENTS, event.id);

        const eventData = {
            ...event,
            updatedAt: Timestamp.now(),
        };

        // Remove undefined values and large nested arrays that are now in subcollections
        const keysToRemove = ['entries', 'results'];
        Object.keys(eventData).forEach(key => {
            if ((eventData as any)[key] === undefined || keysToRemove.includes(key)) {
                delete (eventData as any)[key];
            }
        });

        await setDoc(eventRef, eventData, { merge: true });

        // Also save to localStorage as backup
        saveEventToLocalStorage(event);
    } catch (error) {
        console.error('Error saving event to Firestore:', error);
        // Fallback to localStorage
        saveEventToLocalStorage(event);
    }
}

/**
 * Create a new event
 */
export async function createEvent(event: Omit<FirestoreEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `event-${Date.now()}`;
    const eventAdminIds = event.eventAdminIds && event.eventAdminIds.length > 0
        ? event.eventAdminIds
        : initializeEventAdminsForNewEvent({
            eventId: id,
            createdBy: event.createdBy,
            clubId: event.clubId,
        });

    const newEvent: FirestoreEvent = {
        ...event,
        eventAdminIds,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveEvent(newEvent);
    return id;
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
    if (!isFirebaseConfigured() || !firestore) {
        deleteEventFromLocalStorage(eventId);
        return;
    }

    try {
        const eventRef = doc(firestore, COLLECTIONS.EVENTS, eventId);
        await deleteDoc(eventRef);
        deleteEventFromLocalStorage(eventId);
    } catch (error) {
        console.error('Error deleting event:', error);
        deleteEventFromLocalStorage(eventId);
    }
}

/**
 * Subscribe to real-time event updates
 */
export function subscribeToEvents(
    callback: (events: FirestoreEvent[]) => void
): () => void {
    if (!isFirebaseConfigured() || !firestore) {
        // For localStorage, just call once
        callback(getEventsFromLocalStorage());
        return () => { };
    }

    const eventsRef = collection(firestore, COLLECTIONS.EVENTS);
    const q = query(eventsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const events = snapshot.docs.map(doc => toFirestoreEvent(doc.id, doc.data()));

        callback(events);
    }, (error) => {
        console.error('Error subscribing to events:', error);
        // Fallback to localStorage
        callback(getEventsFromLocalStorage());
    });

    return unsubscribe;
}

/**
 * Get published events (publicly visible non-draft events)
 */
export async function getPublishedEvents(): Promise<FirestoreEvent[]> {
    const events = await getEvents();
    return events.filter(isPublishedEvent);
}

// ============= localStorage Fallback =============

function getEventsFromLocalStorage(): FirestoreEvent[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('events');
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored) as FirestoreEvent[];
        return parsed.map(event => ({
            ...event,
            status: normalizeEventStatus(event.status),
            createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
            updatedAt: event.updatedAt ? new Date(event.updatedAt) : new Date(),
        }));
    } catch {
        return [];
    }
}

function getEventFromLocalStorage(eventId: string): FirestoreEvent | null {
    const events = getEventsFromLocalStorage();
    return events.find(e => e.id === eventId) || null;
}

function saveEventToLocalStorage(event: Partial<FirestoreEvent> & { id: string }): void {
    if (typeof window === 'undefined') return;
    const events = getEventsFromLocalStorage();
    const index = events.findIndex(e => e.id === event.id);

    if (index >= 0) {
        events[index] = { ...events[index], ...event } as FirestoreEvent;
    } else {
        events.push(event as FirestoreEvent);
    }

    localStorage.setItem('events', JSON.stringify(events));
}

function deleteEventFromLocalStorage(eventId: string): void {
    if (typeof window === 'undefined') return;
    const events = getEventsFromLocalStorage();
    const filtered = events.filter(e => e.id !== eventId);
    localStorage.setItem('events', JSON.stringify(filtered));
}
