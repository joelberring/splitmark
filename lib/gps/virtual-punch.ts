/**
 * Virtual Punch Detection
 * GPS-based proximity detection for virtual control punching
 */

import type { GPSPoint } from '@/types/database';
import type {
    VirtualControl,
    VirtualPunch,
    GPSModeSettings,
} from '@/types/virtual-controls';
import {
    GPS_ACCURACY_THRESHOLDS,
    getGPSAccuracyLevel,
} from '@/types/virtual-controls';

// ============= Audio & Haptic Feedback =============

/**
 * Play punch confirmation sound
 */
export function playPunchSound(): void {
    try {
        // Create a short beep sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Success tone: rising pitch
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.warn('Could not play punch sound:', error);
    }
}

/**
 * Trigger haptic feedback (vibration)
 */
export function triggerHapticFeedback(pattern: 'punch' | 'error' | 'finish' = 'punch'): void {
    if (!navigator.vibrate) return;

    switch (pattern) {
        case 'punch':
            navigator.vibrate([100, 50, 100]); // Two short pulses
            break;
        case 'error':
            navigator.vibrate([200, 100, 200, 100, 200]); // Three long pulses
            break;
        case 'finish':
            navigator.vibrate([100, 50, 100, 50, 100, 50, 300]); // Celebration pattern
            break;
    }
}

// ============= Distance Calculation =============

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Calculate bearing from point 1 to point 2
 * @returns bearing in degrees (0-360)
 */
export function calculateBearing(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
}

// ============= Virtual Punch Detector =============

export interface PunchDetectorCallbacks {
    onPunch: (punch: VirtualPunch, control: VirtualControl) => void;
    onApproaching?: (control: VirtualControl, distance: number) => void;
    onAccuracyWarning?: (accuracy: number) => void;
}

export interface PunchDetectorState {
    punchedControls: Set<string>;
    punches: VirtualPunch[];
    nextControlIndex: number;
    isActive: boolean;
}

export class VirtualPunchDetector {
    private controls: VirtualControl[] = [];
    private callbacks: PunchDetectorCallbacks;
    private state: PunchDetectorState = {
        punchedControls: new Set(),
        punches: [],
        nextControlIndex: 0,
        isActive: false,
    };

    // How close before we trigger "approaching" callback (meters)
    private approachingThreshold = 50;

    // Debounce: don't re-trigger same control within this time (ms)
    private punchDebounceMs = 5000;
    private lastPunchTime: Map<string, number> = new Map();

    constructor(callbacks: PunchDetectorCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * Set the controls for this course
     */
    setControls(controls: VirtualControl[]): void {
        // Sort by order
        this.controls = [...controls].sort((a, b) => a.order - b.order);
        this.reset();
    }

    /**
     * Reset detection state (for restarting)
     */
    reset(): void {
        this.state = {
            punchedControls: new Set(),
            punches: [],
            nextControlIndex: 0,
            isActive: true,
        };
        this.lastPunchTime.clear();
    }

    /**
     * Stop detection
     */
    stop(): void {
        this.state.isActive = false;
    }

    /**
     * Resume detection
     */
    resume(): void {
        this.state.isActive = true;
    }

    /**
     * Get current state
     */
    getState(): Readonly<PunchDetectorState> {
        return { ...this.state, punchedControls: new Set(this.state.punchedControls) };
    }

    /**
     * Get the next expected control
     */
    getNextControl(): VirtualControl | null {
        if (this.state.nextControlIndex >= this.controls.length) {
            return null;
        }
        return this.controls[this.state.nextControlIndex];
    }

    /**
     * Get all punches
     */
    getPunches(): VirtualPunch[] {
        return [...this.state.punches];
    }

    /**
     * Check if course is complete
     */
    isComplete(): boolean {
        return this.state.nextControlIndex >= this.controls.length;
    }

    /**
     * Validate punch sequence
     */
    validatePunches(): { valid: boolean; missing: string[] } {
        const expectedCodes = this.controls
            .filter((c) => c.type === 'control' || c.type === 'finish')
            .map((c) => c.code);

        const punchedCodes = this.state.punches
            .filter((p) => {
                const ctrl = this.controls.find((c) => c.id === p.controlId);
                return ctrl && (ctrl.type === 'control' || ctrl.type === 'finish');
            })
            .map((p) => p.controlCode);

        const missing = expectedCodes.filter(
            (code, index) => punchedCodes[index] !== code
        );

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    /**
     * Process a GPS position update
     * This is the main entry point for punch detection
     */
    onPositionUpdate(point: GPSPoint): void {
        if (!this.state.isActive) return;

        // Check GPS accuracy
        if (point.accuracy && point.accuracy > GPS_ACCURACY_THRESHOLDS.poor) {
            this.callbacks.onAccuracyWarning?.(point.accuracy);
        }

        // Check proximity to all unpunched controls
        for (const control of this.controls) {
            if (this.state.punchedControls.has(control.id)) {
                continue; // Already punched
            }

            const distance = calculateDistance(
                point.lat,
                point.lng,
                control.lat,
                control.lng
            );

            // Check if within punch radius
            if (distance <= control.radius) {
                this.handlePunch(control, point, distance);
            }
            // Check if approaching (for UI feedback)
            else if (
                distance <= this.approachingThreshold &&
                control === this.getNextControl()
            ) {
                this.callbacks.onApproaching?.(control, distance);
            }
        }
    }

    /**
     * Handle a detected punch
     */
    private handlePunch(
        control: VirtualControl,
        point: GPSPoint,
        distance: number
    ): void {
        // Debounce check
        const lastTime = this.lastPunchTime.get(control.id);
        if (lastTime && Date.now() - lastTime < this.punchDebounceMs) {
            return;
        }

        // Create punch record
        const punch: VirtualPunch = {
            controlId: control.id,
            controlCode: control.code,
            timestamp: point.timestamp,
            location: {
                lat: point.lat,
                lng: point.lng,
            },
            accuracy: point.accuracy || 0,
            distanceFromControl: distance,
        };

        // Update state
        this.state.punchedControls.add(control.id);
        this.state.punches.push(punch);
        this.lastPunchTime.set(control.id, Date.now());

        // Update next control index
        if (control === this.getNextControl()) {
            this.state.nextControlIndex++;
        }

        // Trigger feedback
        if (control.type === 'finish') {
            triggerHapticFeedback('finish');
        } else {
            playPunchSound();
            triggerHapticFeedback('punch');
        }

        // Callback
        this.callbacks.onPunch(punch, control);
    }
}

// ============= Utility: Create detector from course =============

export function createPunchDetector(
    controls: VirtualControl[],
    callbacks: PunchDetectorCallbacks
): VirtualPunchDetector {
    const detector = new VirtualPunchDetector(callbacks);
    detector.setControls(controls);
    return detector;
}
