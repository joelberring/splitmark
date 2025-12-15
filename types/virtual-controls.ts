/**
 * Virtual Control Types
 * GPS-based virtual control punching for training events
 */

import type { GPSPoint } from './database';

// ============= Sensitivity Configuration =============

/**
 * Pre-defined sensitivity levels for virtual control radius
 * - exact: 10m (high GPS accuracy required)
 * - standard: 20m (good balance)
 * - relaxed: 35m (forgiving, for dense forest)
 * - custom: user-defined radius
 */
export type SensitivityLevel = 'exact' | 'standard' | 'relaxed' | 'custom';

export const SENSITIVITY_RADII: Record<Exclude<SensitivityLevel, 'custom'>, number> = {
    exact: 10,
    standard: 20,
    relaxed: 35,
};

export interface GPSModeSettings {
    enabled: boolean;
    sensitivity: SensitivityLevel;
    customRadius?: number; // meters, when sensitivity is 'custom'
}

// ============= Virtual Control =============

export interface VirtualControl {
    id: string;
    code: string;
    lat: number;
    lng: number;
    radius: number; // meters - punch detection radius
    order: number; // sequence in course (0 = start, -1 = finish)
    type: 'start' | 'control' | 'finish';
    description?: string;
}

// ============= Virtual Punch =============

export interface VirtualPunch {
    controlId: string;
    controlCode: string;
    timestamp: Date;
    location: {
        lat: number;
        lng: number;
    };
    accuracy: number; // GPS accuracy at punch time (meters)
    distanceFromControl: number; // meters from control center
}

// ============= Training Session =============

export type SessionStatus = 'ready' | 'running' | 'paused' | 'finished';
export type SessionResult = 'ok' | 'mp' | 'dnf';

export interface VirtualTrainingSession {
    id: string;
    eventId: string;
    courseId: string;
    userId: string;

    // Status
    status: SessionStatus;

    // Timing
    startTime?: Date;
    finishTime?: Date;

    // Punches
    punches: VirtualPunch[];
    expectedControls: string[]; // control codes in correct order

    // GPS track
    track: GPSPoint[];

    // Result
    result?: SessionResult;
    missingControls?: string[]; // control codes not punched

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

// ============= Spectator Mode Settings =============

export interface SpectatorModeSettings {
    /** Show full orienteering map to spectators */
    showOLMapToSpectators: boolean;

    /** Show course (controls and lines) to spectators */
    showCourseToSpectators: boolean;

    /** Reveal course after runner finishes */
    courseVisibleAfterFinish: boolean;

    /** Base map style when OL map is hidden */
    spectatorMapStyle: 'ol' | 'osm' | 'blank';
}

export const DEFAULT_SPECTATOR_SETTINGS: SpectatorModeSettings = {
    showOLMapToSpectators: false,
    showCourseToSpectators: false,
    courseVisibleAfterFinish: true,
    spectatorMapStyle: 'osm',
};

// ============= GPS Accuracy Thresholds =============

export const GPS_ACCURACY_THRESHOLDS = {
    excellent: 5, // meters
    good: 15,
    acceptable: 25,
    poor: 50, // Show warning above this
};

/**
 * Get GPS accuracy level description
 */
export function getGPSAccuracyLevel(
    accuracy: number
): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (accuracy <= GPS_ACCURACY_THRESHOLDS.excellent) return 'excellent';
    if (accuracy <= GPS_ACCURACY_THRESHOLDS.good) return 'good';
    if (accuracy <= GPS_ACCURACY_THRESHOLDS.acceptable) return 'acceptable';
    return 'poor';
}

// ============= Utility Functions =============

/**
 * Get the effective punch radius for a control
 */
export function getControlRadius(
    control: { gpsRadius?: number },
    courseSettings: GPSModeSettings
): number {
    // Per-control override takes priority
    if (control.gpsRadius !== undefined) {
        return control.gpsRadius;
    }

    // Use course-wide setting
    if (courseSettings.sensitivity === 'custom' && courseSettings.customRadius) {
        return courseSettings.customRadius;
    }

    return SENSITIVITY_RADII[courseSettings.sensitivity as Exclude<SensitivityLevel, 'custom'>] || SENSITIVITY_RADII.standard;
}

/**
 * Convert Course controls to VirtualControls
 */
export function courseToVirtualControls(
    controls: Array<{
        id: string;
        code: string;
        type: 'start' | 'control' | 'finish';
        order: number;
        lat?: number;
        lng?: number;
        description?: string;
        gpsRadius?: number;
    }>,
    courseSettings: GPSModeSettings
): VirtualControl[] {
    return controls
        .filter((c) => c.lat !== undefined && c.lng !== undefined)
        .map((c) => ({
            id: c.id,
            code: c.code,
            lat: c.lat!,
            lng: c.lng!,
            radius: getControlRadius(c, courseSettings),
            order: c.order,
            type: c.type,
            description: c.description,
        }));
}
