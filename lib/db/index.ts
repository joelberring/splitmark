/**
 * IndexedDB Database Setup using Dexie.js
 * Offline-first storage for orienteering data
 */

import Dexie, { type EntityTable } from 'dexie';
import type {
    DBEvent,
    DBEntry,
    DBResult,
    DBCourse,
    DBMap,
    DBTrack,
    DBSICard,
    TransactionLog,
    UserSettings,
    SyncStatus,
} from '@/types/database';

export class OrienteeringDB extends Dexie {
    events!: EntityTable<DBEvent, 'localId'>;
    entries!: EntityTable<DBEntry, 'localId'>;
    results!: EntityTable<DBResult, 'localId'>;
    courses!: EntityTable<DBCourse, 'localId'>;
    maps!: EntityTable<DBMap, 'localId'>;
    tracks!: EntityTable<DBTrack, 'localId'>;
    siCards!: EntityTable<DBSICard, 'localId'>;
    transactionLog!: EntityTable<TransactionLog, 'id'>;
    settings!: EntityTable<UserSettings, 'id'>;
    syncStatus!: EntityTable<SyncStatus, 'id'>;

    constructor() {
        super('OrienteeringDB');

        this.version(1).stores({
            events: 'localId, id, startTime.date, synced, downloaded',
            entries: 'localId, eventId, [eventId+person.id], synced',
            results: 'localId, eventId, personId, synced, modifiedAt',
            courses: 'localId, id, eventId, synced',
            maps: 'localId, eventId, name, createdAt',
            tracks: 'localId, eventId, userId, startTime, uploaded, synced',
            siCards: 'localId, eventId, cardNumber, readTime, processed, synced',
            transactionLog: 'id, timestamp, synced, type, entity',
            settings: 'id, userId',
            syncStatus: 'id',
        });
    }
}

// Export singleton instance
export const db = new OrienteeringDB();

// ============= Helper Functions =============

/**
 * Initialize database with default settings
 */
export async function initializeDB(): Promise<void> {
    try {
        // Check if settings exist
        const settings = await db.settings.get('default');
        if (!settings) {
            await db.settings.add({
                id: 'default',
                autoUploadTracks: false,
                stravaConnected: false,
                privacyZones: [],
            });
        }

        // Initialize sync status
        const syncStatus = await db.syncStatus.get('default');
        if (!syncStatus) {
            await db.syncStatus.add({
                id: 'default',
                lastSync: new Date(0),
                pendingTransactions: 0,
                syncInProgress: false,
            });
        }

        console.log('IndexedDB initialized successfully');
    } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        throw error;
    }
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
    await db.transaction('rw', Object.values(db.tables), async () => {
        for (const table of Object.values(db.tables)) {
            await table.clear();
        }
    });
    await initializeDB();
}

/**
 * Get database statistics
 */
export async function getDBStats() {
    const [
        eventsCount,
        entriesCount,
        resultsCount,
        mapsCount,
        tracksCount,
        pendingTransactions,
    ] = await Promise.all([
        db.events.count(),
        db.entries.count(),
        db.results.count(),
        db.maps.count(),
        db.tracks.count(),
        db.transactionLog.where('synced').equals(0).count(),
    ]);

    return {
        events: eventsCount,
        entries: entriesCount,
        results: resultsCount,
        maps: mapsCount,
        tracks: tracksCount,
        pendingTransactions,
    };
}
