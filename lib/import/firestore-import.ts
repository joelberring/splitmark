import { firestore, COLLECTIONS } from '../firebase';
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { ParsedEvent } from './iof-xml-parser';

/**
 * Firestore Import Coordinator
 * Handles saving a fully parsed IOF-XML event into the subcollection architecture.
 */

export interface ParsedEventImportOptions {
    mapData?: {
        mapImageUrl?: string;
        bounds?: {
            north: number;
            south: number;
            west: number;
            east: number;
        };
        imageWidth?: number;
        imageHeight?: number;
        georeferenced?: boolean;
        manualCalibrationRequired?: boolean;
    };
}

function stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
        return value
            .map((item) => stripUndefinedDeep(item))
            .filter((item) => item !== undefined) as unknown as T;
    }

    if (value && typeof value === 'object') {
        const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
        if (constructorName && constructorName !== 'Object') {
            return value;
        }

        const cleaned: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            if (nestedValue === undefined) continue;
            const nestedCleaned = stripUndefinedDeep(nestedValue);
            if (nestedCleaned !== undefined) {
                cleaned[key] = nestedCleaned;
            }
        }
        return cleaned as T;
    }

    return value;
}

export async function importParsedEventToFirestore(
    parsedEvent: ParsedEvent,
    options?: ParsedEventImportOptions
): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const batch = writeBatch(firestore);
    const eventId = parsedEvent.id || `event-${Date.now()}`;
    const eventRef = doc(firestore, COLLECTIONS.EVENTS, eventId);

    // 1. Prepare Event Metadata
    const eventMetadata: Record<string, unknown> = {
        id: eventId,
        name: parsedEvent.name,
        date: parsedEvent.date,
        organizer: parsedEvent.organizer || '',
        status: 'completed',
        type: 'individual',
        classification: 'Local',
        classes: parsedEvent.classes.map(cls => ({
            id: cls.id,
            name: cls.name,
            entryCount: parsedEvent.results.filter(result => result.classId === cls.id).length,
            courseId: cls.courseId,
            courseName: cls.courseName,
            hasPool: cls.hasPool,
            forkKeys: cls.forkKeys || [],
        })),
        courses: parsedEvent.courses.map(course => ({
            id: course.id,
            name: course.name,
            length: course.length,
            climb: course.climb || 0,
            controls: course.controls.map(control => ({
                id: control.id,
                code: control.code,
                type: control.type,
                order: control.order,
                lat: control.lat,
                lng: control.lng,
                relX: (control as any).relX,
                relY: (control as any).relY,
            })),
            poolClassName: course.poolClassName,
            forkKey: course.forkKey,
        })),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'import',
    };

    if (options?.mapData?.mapImageUrl) {
        eventMetadata.map = {
            imageUrl: options.mapData.mapImageUrl,
            name: `${parsedEvent.name} map`,
            bounds: options.mapData.bounds,
            width: options.mapData.imageWidth,
            height: options.mapData.imageHeight,
            georeferenced: options.mapData.georeferenced ?? false,
            manualCalibrationRequired: options.mapData.manualCalibrationRequired ?? false,
        };
    }

    batch.set(eventRef, stripUndefinedDeep(eventMetadata), { merge: true });

    // 2. Import Classes
    const classesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'classes');
    parsedEvent.classes.forEach(cls => {
        const classDoc = doc(classesRef, cls.id);
        batch.set(classDoc, stripUndefinedDeep({
            ...cls,
            updatedAt: Timestamp.now()
        }), { merge: true });
    });

    // 3. Import Entries & results
    const entriesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'entries');
    const resultsRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'results');

    parsedEvent.results.forEach(result => {
        const entryId = `entry-${result.personId}`;
        const entryDoc = doc(entriesRef, entryId);
        const resultDoc = doc(resultsRef, entryId);

        // Map parsed result to Entry type
        const entryData = {
            id: entryId,
            eventId,
            firstName: result.firstName,
            lastName: result.lastName,
            clubName: result.club,
            clubId: result.clubId || '',
            classId: result.classId,
            className: result.className,
            siCard: result.siCard || '',
            status: mapStatus(result.status),
            startTime: result.startTime || '',
            finishTime: result.finishTime || '',
            resultStatus: result.status.toLowerCase(),
            updatedAt: Timestamp.now()
        };

        batch.set(entryDoc, stripUndefinedDeep(entryData), { merge: true });

        // Map parsed result to Result type
        if (result.status === 'OK' || result.status === 'MP' || result.status === 'DNF') {
            const resultData = {
                id: entryId,
                personId: result.personId,
                firstName: result.firstName,
                lastName: result.lastName,
                clubName: result.club,
                classId: result.classId,
                className: result.className,
                runningTime: result.time * 1000, // ms
                status: result.status,
                position: result.position,
                punches: result.splitTimes.map(s => ({
                    controlCode: s.controlCode,
                    time: new Date(s.time * 1000).toISOString() // This mapping might be tricky depending on base time
                })),
                updatedAt: Timestamp.now()
            };
            batch.set(resultDoc, stripUndefinedDeep(resultData), { merge: true });
        }
    });

    // 4. Commit everything
    await batch.commit();

    return eventId;
}

function mapStatus(iofStatus: string): string {
    switch (iofStatus) {
        case 'OK': return 'finished';
        case 'DNS': return 'dns';
        case 'DNF': return 'dnf';
        case 'DSQ': return 'dsq';
        default: return 'registered';
    }
}
