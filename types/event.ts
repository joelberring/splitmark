export interface StoredEvent {
    id: string;
    name: string;
    date: string; // ISO date string
    time?: string;
    location: string;
    organizer?: string;
    description?: string;
    googleMapsUrl?: string;
    status?: 'upcoming' | 'live' | 'completed';
    classes?: EventClass[];
    entries?: EventEntry[];
    map?: any; // Flexible to support object with imageUrl, bounds, etc.
    courses?: any[]; // Keep flexible for now
    attachments?: any[];
    images?: any[];
    classification?: string;
    ppenControls?: any[];
    calibration?: any;
    calibrationAnchors?: any;
}

export interface EventClass {
    id: string;
    name: string;
    distance?: string;
    entryCount: number;
    hasPool?: boolean;
    forkKeys?: string[];
}

export interface EventEntry {
    id: string;
    firstName: string;
    lastName: string;
    club: string;
    clubName?: string;
    classId: string;
    className?: string;
    siCard?: string;
    startTime?: string;
    status?: 'OK' | 'DNS' | 'DNF' | 'MP' | 'DSQ' | 'finished';
    time?: number; // seconds
    position?: number;
    splitTimes?: SplitTime[];
    forkKey?: string;
}

export interface SplitTime {
    controlCode: number | string;
    time: number; // seconds from start
    status?: string;
}
