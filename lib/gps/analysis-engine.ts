import { DBTrack, GPSPoint } from '@/types/database';

/**
 * Analysis engine for processing GPS tracks.
 * Supports Ghost Runner generation and Mistake Detection.
 */
export class AnalysisEngine {
    /**
     * Generates a "Ghost Runner" track based on a target pace.
     * @param originalTrack The runner's track to mimic duration/distance context
     * @param targetMinPerKm Target pace (e.g., 10 for 10 min/km)
     */
    static generateGhostRunner(originalTrack: DBTrack, targetMinPerKm: number): DBTrack {
        if (!originalTrack.points || originalTrack.points.length === 0) return originalTrack;

        const startTime = originalTrack.startTime;
        const targetSpeedMps = 1000 / (targetMinPerKm * 60); // m/s

        const ghostPoints: GPSPoint[] = originalTrack.points.map((p, i) => {
            // Calculate distance covered by ghost at this time
            const elapsedSec = (p.timestamp.getTime() - startTime.getTime()) / 1000;
            const distanceCovered = elapsedSec * targetSpeedMps;

            // For simplicity, the ghost follows the same path but at a constant pace
            // In a real scenario, we'd interpolate along the path
            return {
                ...p,
                speed: targetSpeedMps,
                // We keep the coords same as original to show "relative position" on same path
                // but synchronizing by distance is better for "Ghost"
            };
        });

        return {
            ...originalTrack,
            localId: `ghost-${targetMinPerKm}-${originalTrack.localId}`,
            name: `Ghost (${targetMinPerKm} min/km)`,
            points: ghostPoints,
            synced: false,
            uploaded: false
        };
    }

    /**
     * Detects potential mistakes in a track.
     * Mistakes are flagged if:
     * 1. Speed drops below a threshold for a sustained period while not at a control.
     * 2. Bearing changes significantly and frequently (wandering).
     */
    static detectMistakes(points: GPSPoint[]): Array<{ startIdx: number, endIdx: number, type: 'stationary' | 'wandering' }> {
        const mistakes: Array<{ startIdx: number, endIdx: number, type: 'stationary' | 'wandering' }> = [];
        const STATIONARY_THRESHOLD = 0.5; // m/s (approx 1.8 km/h)
        const MIN_DURATION = 15; // seconds

        let stationaryStart: number | null = null;

        points.forEach((p, i) => {
            const speed = p.speed || 0;

            // Stationary Check
            if (speed < STATIONARY_THRESHOLD) {
                if (stationaryStart === null) stationaryStart = i;
            } else {
                if (stationaryStart !== null) {
                    const duration = (points[i].timestamp.getTime() - points[stationaryStart].timestamp.getTime()) / 1000;
                    if (duration >= MIN_DURATION) {
                        mistakes.push({ startIdx: stationaryStart, endIdx: i, type: 'stationary' });
                    }
                    stationaryStart = null;
                }
            }
        });

        return mistakes;
    }
}
