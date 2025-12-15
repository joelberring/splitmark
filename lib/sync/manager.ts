/**
 * Sync Manager
 * Handles offline-first synchronization with Firestore
 */

import { db } from '../db';
import { firestore } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import type { TransactionLog } from '@/types/database';

export type SyncStatus = 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncResult {
    success: boolean;
    syncedCount: number;
    failedCount: number;
    conflicts: number;
    errors: string[];
}

/**
 * Sync Manager for offline-first architecture
 */
export class SyncManager {
    private syncing: boolean = false;
    private listeners: ((status: SyncStatus) => void)[] = [];

    /**
     * Check if currently syncing
     */
    isSyncing(): boolean {
        return this.syncing;
    }

    /**
     * Subscribe to sync status changes
     */
    onStatusChange(callback: (status: SyncStatus) => void): () => void {
        this.listeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Sync all pending changes to Firestore
     */
    async syncAll(): Promise<SyncResult> {
        if (this.syncing) {
            throw new Error('Sync already in progress');
        }

        if (!navigator.onLine) {
            this.notifyListeners('offline');
            throw new Error('No internet connection');
        }

        this.syncing = true;
        this.notifyListeners('syncing');

        const result: SyncResult = {
            success: true,
            syncedCount: 0,
            failedCount: 0,
            conflicts: 0,
            errors: [],
        };

        try {
            // Get all pending transactions
            const transactions = await db.transactionLog
                .where('synced')
                .equals(0)
                .toArray();

            for (const transaction of transactions) {
                try {
                    await this.syncTransaction(transaction);
                    result.syncedCount++;
                } catch (error: any) {
                    result.failedCount++;
                    result.errors.push(`${transaction.operation} ${transaction.entity}: ${error.message}`);

                    if (error.message.includes('conflict')) {
                        result.conflicts++;
                    }
                }
            }

            // Sync tracks
            const allTracks = await db.tracks.toArray();
            const tracks = allTracks.filter(t => !t.synced);
            for (const track of tracks) {
                try {
                    await this.syncTrack(track);
                    result.syncedCount++;
                } catch (error: any) {
                    result.failedCount++;
                    result.errors.push(`Track ${track.name}: ${error.message}`);
                }
            }

            // Sync results
            const allResults = await db.results.toArray();
            const results = allResults.filter(r => !r.synced);
            for (const resultItem of results) {
                try {
                    await this.syncResult(resultItem);
                    result.syncedCount++;
                } catch (error: any) {
                    result.failedCount++;
                    result.errors.push(`Result: ${error.message}`);
                }
            }

            this.notifyListeners(result.failedCount === 0 ? 'synced' : 'error');
        } catch (error: any) {
            result.success = false;
            result.errors.push(error.message);
            this.notifyListeners('error');
        } finally {
            this.syncing = false;
        }

        return result;
    }

    /**
     * Pull changes from Firestore
     */
    async pullChanges(): Promise<void> {
        if (!navigator.onLine) {
            throw new Error('No internet connection');
        }

        try {
            // Pull events
            const eventsSnapshot = await getDocs(collection(firestore, 'events'));
            for (const docSnap of eventsSnapshot.docs) {
                const data = docSnap.data();
                await db.events.put({
                    localId: docSnap.id,
                    ...data,
                    synced: true,
                    downloaded: true,
                } as any);
            }

            // Pull results  
            const resultsSnapshot = await getDocs(collection(firestore, 'results'));
            for (const docSnap of resultsSnapshot.docs) {
                const data = docSnap.data();
                await db.results.put({
                    localId: docSnap.id,
                    ...data,
                    synced: true,
                } as any);
            }

            // Update sync status
            await db.syncStatus.put({
                id: 'last_pull',
                lastSync: new Date(),
                pendingTransactions: 0,
                syncInProgress: false,
            });
        } catch (error) {
            console.error('Pull failed:', error);
            throw error;
        }
    }

    /**
     * Sync a single transaction
     */
    private async syncTransaction(transaction: TransactionLog): Promise<void> {
        const collectionName = this.getFirestoreCollection(transaction.entity);
        if (!collectionName) {
            throw new Error(`Unknown entity: ${transaction.entity}`);
        }

        const docRef = doc(firestore, collectionName, transaction.entityId);

        switch (transaction.operation) {
            case 'CREATE':
            case 'UPDATE':
                // Check for conflicts
                const existing = await getDoc(docRef);
                if (existing.exists() && transaction.operation === 'CREATE') {
                    throw new Error('Conflict: Document already exists');
                }

                await setDoc(docRef, {
                    ...transaction.data,
                    updatedAt: serverTimestamp(),
                }, { merge: true });

                // Mark as synced
                await db.transactionLog.update(transaction.id!, { synced: true });
                break;

            case 'DELETE':
                // For now, we don't delete from Firestore (soft delete instead)
                await setDoc(docRef, {
                    deleted: true,
                    deletedAt: serverTimestamp(),
                }, { merge: true });

                await db.transactionLog.update(transaction.id!, { synced: true });
                break;

            default:
                throw new Error(`Unknown operation: ${transaction.operation}`);
        }
    }

    /**
     * Sync GPS track to Firestore
     */
    private async syncTrack(track: any): Promise<void> {
        const docRef = doc(firestore, 'tracks', track.localId);

        await setDoc(docRef, {
            name: track.name,
            eventId: track.eventId,
            startTime: track.startTime,
            endTime: track.endTime,
            distance: track.distance,
            duration: track.duration,
            points: track.points, // May want to compress this
            uploaded: track.uploaded,
            createdAt: serverTimestamp(),
        });

        // Mark as synced
        await db.tracks.update(track.localId, { synced: true });
    }

    /**
     * Sync result to Firestore
     */
    private async syncResult(result: any): Promise<void> {
        const docRef = doc(firestore, 'results', result.localId);

        await setDoc(docRef, {
            eventId: result.eventId,
            competitorId: result.competitorId,
            classId: result.classId,
            startTime: result.startTime,
            finishTime: result.finishTime,
            time: result.time,
            status: result.status,
            punches: result.punches,
            createdAt: serverTimestamp(),
        });

        // Mark as synced
        await db.results.update(result.localId, { synced: true });
    }

    /**
     * Get Firestore collection name for table
     */
    private getFirestoreCollection(table: string): string | null {
        const mapping: Record<string, string> = {
            events: 'events',
            entries: 'entries',
            results: 'results',
            courses: 'courses',
            tracks: 'tracks',
        };

        return mapping[table] || null;
    }

    /**
     * Notify all listeners of status change
     */
    private notifyListeners(status: SyncStatus): void {
        this.listeners.forEach((listener) => {
            try {
                listener(status);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    /**
     * Enable background sync
     */
    async enableBackgroundSync(): Promise<void> {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await (registration as any).sync.register('sync-data');
        }
    }

    /**
     * Check sync status
     */
    async getSyncStatus(): Promise<{
        pending: number;
        synced: number;
        lastSync?: Date;
    }> {
        const allTransactions = await db.transactionLog.toArray();
        const pending = allTransactions.filter(t => !t.synced).length;
        const synced = allTransactions.filter(t => t.synced).length;

        const lastSyncRecord = await db.syncStatus.get('last_sync');

        return {
            pending,
            synced,
            lastSync: lastSyncRecord?.lastSync,
        };
    }
}

// Export singleton instance
export const syncManager = new SyncManager();
