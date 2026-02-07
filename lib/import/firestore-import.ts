import { firestore, COLLECTIONS } from '../firebase';
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { ParsedEvent } from './iof-xml-parser';

/**
 * Firestore Import Coordinator
 * Handles saving a fully parsed IOF-XML event into the subcollection architecture.
 */

export async function importParsedEventToFirestore(parsedEvent: ParsedEvent): Promise<string> {
    if (!firestore) throw new Error('Firestore not initialized');

    const batch = writeBatch(firestore);
    const eventId = parsedEvent.id || `event-${Date.now()}`;
    const eventRef = doc(firestore, COLLECTIONS.EVENTS, eventId);

    // 1. Prepare Event Metadata
    const eventMetadata = {
        id: eventId,
        name: parsedEvent.name,
        date: parsedEvent.date,
        organizer: parsedEvent.organizer || '',
        status: 'active',
        type: 'individual',
        classification: 'Local',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'import',
    };

    batch.set(eventRef, eventMetadata, { merge: true });

    // 2. Import Classes
    const classesRef = collection(firestore, COLLECTIONS.EVENTS, eventId, 'classes');
    parsedEvent.classes.forEach(cls => {
        const classDoc = doc(classesRef, cls.id);
        batch.set(classDoc, {
            ...cls,
            updatedAt: Timestamp.now()
        }, { merge: true });
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

        batch.set(entryDoc, entryData, { merge: true });

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
            batch.set(resultDoc, resultData, { merge: true });
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
