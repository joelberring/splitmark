/**
 * Race Day Types
 * Types for participant race-day experience
 */

// Participant status during race day
export type ParticipantRaceStatus =
    | 'registered'    // Anmäld men ej incheckat
    | 'checked_in'    // Incheckat
    | 'started'       // Startat (running)
    | 'finished'      // I mål
    | 'dns'           // Did not start
    | 'dnf';          // Did not finish

// Check-in methods
export type CheckInMethod = 'manual' | 'si_punch' | 'auto';

// Start methods
export type StartMethod = 'startlist' | 'si_punch' | 'manual';

// Map release types
export type MapReleaseType =
    | 'time_based'          // X minuter efter sista start
    | 'all_started'         // När alla i klassen startat
    | 'percentage_finished' // När X% gått i mål
    | 'manual'              // Tävlingsledare släpper
    | 'immediate';          // Direkt (träning)

// Race participant state
export interface RaceParticipant {
    eventId: string;
    entryId: string;
    userId?: string;

    // Personal info
    firstName: string;
    lastName: string;
    clubName: string;
    className: string;

    // Identifiers
    siCard?: string;
    bibNumber?: string;

    // Check-in
    isCheckedIn: boolean;
    checkedInAt?: string;
    checkedInMethod?: CheckInMethod;

    // Start times
    plannedStartTime?: string;
    actualStartTime?: string;
    startMethod?: StartMethod;

    // Finish
    finishTime?: string;
    runningTime?: number; // ms

    // Status
    status: ParticipantRaceStatus;
    resultStatus?: 'ok' | 'mp' | 'dnf' | 'dsq';
}

// Event participant settings (admin configurable)
export interface EventParticipantSettings {
    // Check-in
    requireCheckin: boolean;
    checkinDeadlineMinutes: number; // minutes before start
    autoMarkDns: boolean;

    // Start
    primaryStartMethod: StartMethod;
    allowManualStart: boolean;
    manualStartWindowMinutes: number; // +/- from planned time

    // Map release
    mapReleaseType: MapReleaseType;
    mapReleaseMinutes?: number;
    mapReleasePercentage?: number;
    isMapReleased: boolean;
    mapReleasedAt?: string;

    // GPS
    allowGpsUpload: boolean;
    showGpsBeforeMapRelease: boolean;

    // Display
    showClubMates: boolean;
    showStartLocation: boolean;
}

// Default settings
export const DEFAULT_PARTICIPANT_SETTINGS: EventParticipantSettings = {
    requireCheckin: false,
    checkinDeadlineMinutes: 30,
    autoMarkDns: false,

    primaryStartMethod: 'startlist',
    allowManualStart: false,
    manualStartWindowMinutes: 5,

    mapReleaseType: 'all_started',
    mapReleasePercentage: 80,
    isMapReleased: false,

    allowGpsUpload: true,
    showGpsBeforeMapRelease: false,

    showClubMates: true,
    showStartLocation: true,
};

// Club mate info (subset for display)
export interface ClubMate {
    entryId: string;
    firstName: string;
    lastName: string;
    className: string;
    plannedStartTime?: string;
    status: ParticipantRaceStatus;
    isCheckedIn: boolean;
}

// Start location info
export interface StartLocation {
    name: string;
    description?: string;
    distanceFromParking?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

// GPS track data
export interface GPSTrack {
    id: string;
    entryId: string;
    eventId: string;
    uploadedAt: string;
    points: GPSPoint[];
    source: 'gpx' | 'manual' | 'live';
}

export interface GPSPoint {
    lat: number;
    lng: number;
    timestamp: string;
    altitude?: number;
}
