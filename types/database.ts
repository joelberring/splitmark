/**
 * Database types for local storage (IndexedDB via Dexie)
 */

import type { Event, Entry, ClassResult, PersonResult, Course } from './iof';
import type { ImportedMap } from './maps';

// ============= Core Entities =============

export interface DBEvent extends Event {
    localId: string;
    synced: boolean;
    lastSync?: Date;
    downloaded: boolean; // Map and course data downloaded
}

export interface DBEntry extends Entry {
    localId: string;
    eventId: string;
    synced: boolean;
}

export interface DBResult {
    localId: string;
    eventId: string;
    personId?: string;
    result: PersonResult;
    synced: boolean;
    modifiedAt: Date;
}

export interface DBCourse extends Course {
    localId: string;
    eventId: string;
    synced: boolean;
}

// ============= Map Storage =============

export interface DBMap {
    localId: string;
    eventId?: string;
    name: string;
    source: string; // OCAD, OMAP, MBTiles, etc.
    data: ArrayBuffer | Blob;
    metadata: ImportedMap;
    createdAt: Date;
}

// ============= GPS Tracks =============

export interface DBTrack {
    localId: string;
    eventId?: string;
    userId?: string;
    name: string;
    startTime: Date;
    endTime?: Date;
    points: GPSPoint[];
    distance?: number; // meters
    duration?: number; // seconds
    uploaded: boolean;
    synced: boolean;
}

export interface GPSPoint {
    timestamp: Date;
    lat: number;
    lng: number;
    alt?: number;
    accuracy?: number; // meters
    speed?: number; // m/s
    heading?: number; // degrees
}

// ============= SportIdent Data =============

export interface DBSICard {
    localId: string;
    eventId: string;
    cardNumber: string;
    readTime: Date;
    startTime?: Date;
    finishTime?: Date;
    punches: SIPunch[];
    processed: boolean;
    synced: boolean;
}

export interface SIPunch {
    controlCode: string;
    timestamp: Date;
    milliseconds?: number; // For SI-Card 10/11/SIAC
}

// ============= Transaction Log (Offline Sync) =============

export interface TransactionLog {
    id: string;
    timestamp: Date;
    type: TransactionType;
    entity: string; // Event, Entry, Result, etc.
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    data: any;
    synced: boolean;
    syncedAt?: Date;
    error?: string;
}

export type TransactionType =
    | 'EVENT'
    | 'ENTRY'
    | 'RESULT'
    | 'COURSE'
    | 'SICARD'
    | 'TRACK'
    | 'MAP';

// ============= User Settings =============

export interface UserSettings {
    id: string;
    userId?: string;
    eventorApiKey?: string;
    defaultOrganisation?: string;
    privacyZones?: PrivacyZone[];
    autoUploadTracks: boolean;
    stravaConnected: boolean;
    stravaAccessToken?: string;
}

export interface PrivacyZone {
    id: string;
    name: string;
    center: {
        lat: number;
        lng: number;
    };
    radius: number; // meters
}

// ============= Sync Status =============

export interface SyncStatus {
    id: string;
    lastSync: Date;
    pendingTransactions: number;
    syncInProgress: boolean;
    lastError?: string;
}
