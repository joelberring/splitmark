/**
 * GPS Tracking Service
 * Background GPS tracking with offline storage
 */

import type { GPSPoint } from '@/types/database';
import type { VirtualControl, VirtualPunch } from '@/types/virtual-controls';
import { db } from '../db';
import { VirtualPunchDetector, type PunchDetectorCallbacks } from './virtual-punch';

export interface TrackingOptions {
    enableHighAccuracy?: boolean;
    maximumAge?: number;
    timeout?: number;
    distanceFilter?: number; // Minimum distance in meters
}

export class GPSTracker {
    private watchId: number | null = null;
    private recording: boolean = false;
    private currentTrackId: string | null = null;
    private points: GPSPoint[] = [];
    private lastPoint: GPSPoint | null = null;
    private options: TrackingOptions;

    // Virtual punch detection
    private punchDetector: VirtualPunchDetector | null = null;
    private positionCallbacks: Array<(point: GPSPoint) => void> = [];

    constructor(options: TrackingOptions = {}) {
        this.options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
            distanceFilter: 5, // Default 5 meters
            ...options,
        };
    }

    /**
     * Start recording GPS track
     */
    async startTracking(trackName?: string, eventId?: string): Promise<string> {
        if (this.recording) {
            throw new Error('Already recording');
        }

        if (!navigator.geolocation) {
            throw new Error('Geolocation not supported');
        }

        // Create new track in database
        const trackId = crypto.randomUUID();
        await db.tracks.add({
            localId: trackId,
            eventId,
            name: trackName || `Track ${new Date().toISOString()}`,
            startTime: new Date(),
            points: [],
            uploaded: false,
            synced: false,
        });

        this.currentTrackId = trackId;
        this.points = [];
        this.recording = true;

        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.onPosition(position),
            (error) => this.onError(error),
            {
                enableHighAccuracy: this.options.enableHighAccuracy,
                maximumAge: this.options.maximumAge,
                timeout: this.options.timeout,
            }
        );

        return trackId;
    }

    /**
     * Stop recording GPS track
     */
    async stopTracking(): Promise<void> {
        if (!this.recording || !this.currentTrackId) {
            return;
        }

        // Stop watching position
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Update track in database
        await db.tracks.update(this.currentTrackId, {
            endTime: new Date(),
            points: this.points,
            distance: this.calculateTotalDistance(),
            duration: this.calculateDuration(),
        });

        this.recording = false;
        this.currentTrackId = null;
        this.points = [];
        this.lastPoint = null;
    }

    /**
     * Get current recording status
     */
    isRecording(): boolean {
        return this.recording;
    }

    /**
     * Get current track ID
     */
    getCurrentTrackId(): string | null {
        return this.currentTrackId;
    }

    /**
     * Get current track points
     */
    getCurrentPoints(): GPSPoint[] {
        return [...this.points];
    }

    /**
     * Get current position (single shot)
     */
    async getCurrentPosition(): Promise<GPSPoint> {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve(this.positionToGPSPoint(position));
                },
                (error) => {
                    reject(new Error(`GPS error: ${error.message}`));
                },
                {
                    enableHighAccuracy: this.options.enableHighAccuracy,
                    maximumAge: this.options.maximumAge,
                    timeout: this.options.timeout,
                }
            );
        });
    }

    /**
     * Watch position changes (callback-based)
     */
    watchPosition(
        callback: (point: GPSPoint) => void,
        errorCallback?: (error: Error) => void
    ): () => void {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                callback(this.positionToGPSPoint(position));
            },
            (error) => {
                if (errorCallback) {
                    errorCallback(new Error(`GPS error: ${error.message}`));
                }
            },
            {
                enableHighAccuracy: this.options.enableHighAccuracy,
                maximumAge: this.options.maximumAge,
                timeout: this.options.timeout,
            }
        );

        // Return cleanup function
        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }

    /**
     * Enable virtual punch detection
     * @param controls - Virtual controls to detect
     * @param callbacks - Callbacks for punch events
     */
    enableVirtualPunching(
        controls: VirtualControl[],
        callbacks: PunchDetectorCallbacks
    ): VirtualPunchDetector {
        this.punchDetector = new VirtualPunchDetector(callbacks);
        this.punchDetector.setControls(controls);
        return this.punchDetector;
    }

    /**
     * Disable virtual punch detection
     */
    disableVirtualPunching(): void {
        if (this.punchDetector) {
            this.punchDetector.stop();
            this.punchDetector = null;
        }
    }

    /**
     * Get the current punch detector (if enabled)
     */
    getPunchDetector(): VirtualPunchDetector | null {
        return this.punchDetector;
    }

    /**
     * Register a callback for position updates
     * @returns Cleanup function to unregister
     */
    onPositionUpdate(callback: (point: GPSPoint) => void): () => void {
        this.positionCallbacks.push(callback);
        return () => {
            const index = this.positionCallbacks.indexOf(callback);
            if (index >= 0) {
                this.positionCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Handle position update
     */
    private onPosition(position: GeolocationPosition): void {
        const point = this.positionToGPSPoint(position);

        // Check for virtual punches (always, regardless of distance filter)
        if (this.punchDetector) {
            this.punchDetector.onPositionUpdate(point);
        }

        // Notify any registered callbacks
        for (const callback of this.positionCallbacks) {
            callback(point);
        }

        // Apply distance filter for track recording
        if (this.lastPoint && this.options.distanceFilter) {
            const distance = this.calculateDistance(this.lastPoint, point);
            if (distance < this.options.distanceFilter) {
                return; // Skip this point for recording
            }
        }

        this.points.push(point);
        this.lastPoint = point;

        // Periodically save to database (every 10 points)
        if (this.points.length % 10 === 0 && this.currentTrackId) {
            this.saveProgress();
        }
    }

    /**
     * Handle position error
     */
    private onError(error: GeolocationPositionError): void {
        console.error('GPS error:', error.message);
    }

    /**
     * Convert GeolocationPosition to GPSPoint
     */
    private positionToGPSPoint(position: GeolocationPosition): GPSPoint {
        return {
            timestamp: new Date(position.timestamp),
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
        };
    }

    /**
     * Calculate distance between two points (Haversine)
     */
    private calculateDistance(p1: GPSPoint, p2: GPSPoint): number {
        const R = 6371000;
        const φ1 = (p1.lat * Math.PI) / 180;
        const φ2 = (p2.lat * Math.PI) / 180;
        const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
        const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Calculate total distance of track
     */
    private calculateTotalDistance(): number {
        let total = 0;
        for (let i = 1; i < this.points.length; i++) {
            total += this.calculateDistance(this.points[i - 1], this.points[i]);
        }
        return total;
    }

    /**
     * Calculate track duration
     */
    private calculateDuration(): number {
        if (this.points.length < 2) return 0;

        const start = this.points[0].timestamp.getTime();
        const end = this.points[this.points.length - 1].timestamp.getTime();

        return (end - start) / 1000; // seconds
    }

    /**
     * Save progress to database
     */
    private async saveProgress(): Promise<void> {
        if (!this.currentTrackId) return;

        try {
            await db.tracks.update(this.currentTrackId, {
                points: this.points,
                distance: this.calculateTotalDistance(),
                duration: this.calculateDuration(),
            });
        } catch (error) {
            console.error('Failed to save track progress:', error);
        }
    }
}

// Export singleton instance
export const gpsTracker = new GPSTracker();

/**
 * Export track to GPX format
 */
export function exportToGPX(points: GPSPoint[], metadata?: {
    name?: string;
    description?: string;
}): string {
    const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OrienteerPro"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns="http://www.topografix.com/GPX/1/1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`;

    const metadataXML = metadata?.name || metadata?.description
        ? `  <metadata>
    ${metadata.name ? `<name>${metadata.name}</name>` : ''}
    ${metadata.description ? `<desc>${metadata.description}</desc>` : ''}
  </metadata>`
        : '';

    const trackPoints = points
        .map(
            (p) => `      <trkpt lat="${p.lat}" lon="${p.lng}">
        ${p.alt ? `<ele>${p.alt}</ele>` : ''}
        <time>${p.timestamp.toISOString()}</time>
      </trkpt>`
        )
        .join('\n');

    return `${header}
${metadataXML}
  <trk>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}
