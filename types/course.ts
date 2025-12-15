/**
 * Course Types for Competition Courses
 */

import type { GPSModeSettings, SpectatorModeSettings } from './virtual-controls';

export interface Course {
    id: string;
    eventId: string;
    name: string;

    // Distance and climb
    length: number; // meters
    climb: number; // meters

    // Controls
    controls: Control[];

    // Classes using this course
    classIds: string[];

    // Forking variants (for relay)
    variants?: CourseVariant[];

    // GPS virtual punching mode
    gpsMode?: GPSModeSettings;

    // Spectator visibility settings
    spectatorMode?: SpectatorModeSettings;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

export interface Control {
    id: string;
    code: string; // "31", "32", "100", etc.
    type: ControlType;
    order: number; // position in course

    // Optional coordinates
    lat?: number;
    lng?: number;

    // Optional description
    description?: string;

    // GPS mode: per-control radius override (meters)
    gpsRadius?: number;
}

export type ControlType =
    | 'start'
    | 'control'
    | 'finish';

export interface CourseVariant {
    id: string;
    name: string; // "A", "B", "C" or "Sträcka 1", "Sträcka 2"
    controls: Control[];
}

// For IOF XML import
export interface IOFCourseData {
    name: string;
    length?: number;
    climb?: number;
    controls: IOFControl[];
}

export interface IOFControl {
    type: 'Start' | 'Control' | 'Finish';
    id?: string;
    code?: string;
    position?: {
        lat: number;
        lng: number;
    };
}

// For result validation
export interface CourseCheck {
    courseId: string;
    expectedControls: string[]; // control codes in order
    allowedMissing?: string[]; // butterfly controls etc.
}

export interface PunchValidation {
    isValid: boolean;
    status: 'ok' | 'mp' | 'wrong_order';
    missingPunches?: string[];
    extraPunches?: string[];
    wrongOrder?: { expected: string; got: string }[];
}
