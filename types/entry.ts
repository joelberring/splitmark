/**
 * Entry Types for Competition Participants
 */

export interface Entry {
    id: string;
    eventId: string;

    // Personal info
    firstName: string;
    lastName: string;
    birthYear?: number;
    gender?: 'M' | 'F';

    // Club
    clubId?: string;
    clubName: string;

    // Competition
    classId: string;
    className: string;
    siCard?: string;

    // Contact
    email?: string;
    phone?: string;

    // Status
    status: EntryStatus;
    startTime?: string; // ISO timestamp
    finishTime?: string;
    resultStatus?: ResultStatus;

    // Metadata
    entryType: 'normal' | 'late' | 'cancel';
    fee?: number;
    feePaid?: boolean;
    comment?: string;

    createdAt: string;
    updatedAt: string;
}

export type EntryStatus =
    | 'registered'   // Anmäld
    | 'confirmed'    // Bekräftad
    | 'started'      // Startad
    | 'finished'     // I mål
    | 'dns'          // Did Not Start
    | 'dnf'          // Did Not Finish
    | 'dsq'          // Diskvalificerad
    | 'cancelled';   // Återbud

export type ResultStatus =
    | 'ok'           // Godkänd
    | 'mp'           // Missing Punch
    | 'dnf'          // Did Not Finish
    | 'dsq'          // Diskvalificerad
    | 'dns'          // Did Not Start
    | 'ot';          // Over Time (rogaining)

export interface EntryWithResult extends Entry {
    // Timing
    runningTime?: number; // milliseconds
    position?: number;
    timeBehind?: number; // milliseconds behind winner

    // Splits
    punches?: Punch[];
    splits?: Split[];
}

export interface Punch {
    controlCode: string;
    time: string; // ISO timestamp
    rawTime?: number; // SI time
}

export interface Split {
    controlCode: string;
    splitTime: number; // milliseconds from start
    legTime: number; // milliseconds for this leg
    position: number; // position at this control
}

// For import/export
export interface EntryImportRow {
    firstName: string;
    lastName: string;
    club: string;
    class: string;
    siCard?: string;
    email?: string;
    phone?: string;
    birthYear?: string;
}

export interface EntryExportData {
    entries: Entry[];
    exportedAt: string;
    eventId: string;
    format: 'csv' | 'iof-xml';
}
