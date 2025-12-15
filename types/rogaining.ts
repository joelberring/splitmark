/**
 * Rogaining Types for Score Orienteering
 */

import type { Control } from './course';

export interface RogainingControl extends Control {
    points: number;  // Points for visiting this control
}

export interface RogainingCourse {
    id: string;
    eventId: string;
    name: string;
    controls: RogainingControl[];
    timeLimit: number; // Time limit in minutes
    penaltyPerMinute: number; // Points deducted per minute over time
    maxPenalty?: number; // Maximum penalty (optional cap)
}

export interface RogainingResult {
    entryId: string;
    eventId: string;

    // Punches collected
    punches: RogainingPunch[];

    // Calculated values
    controlsVisited: number;
    rawPoints: number; // Sum of control points
    runningTime: number; // ms
    overTime: number; // ms over time limit (0 if under)
    penalty: number; // Points deducted for overtime
    finalScore: number; // rawPoints - penalty

    // Validation
    status: 'ok' | 'ot' | 'dnf' | 'dsq'; // ok, over time, did not finish, disqualified
}

export interface RogainingPunch {
    controlCode: string;
    points: number;
    timestamp: Date;
}

/**
 * Calculate rogaining result from punches
 */
export function calculateRogainingResult(
    entryId: string,
    eventId: string,
    course: RogainingCourse,
    punches: { controlCode: string; timestamp: Date }[],
    startTime: Date,
    finishTime: Date
): RogainingResult {
    const controlMap = new Map(course.controls.map(c => [c.code, c.points]));

    // Calculate running time
    const runningTime = finishTime.getTime() - startTime.getTime();
    const timeLimitMs = course.timeLimit * 60 * 1000;
    const overTime = Math.max(0, runningTime - timeLimitMs);

    // Calculate raw points (no duplicates)
    const visitedControls = new Set<string>();
    const rogainingPunches: RogainingPunch[] = [];
    let rawPoints = 0;

    for (const punch of punches) {
        const points = controlMap.get(punch.controlCode);
        if (points && !visitedControls.has(punch.controlCode)) {
            visitedControls.add(punch.controlCode);
            rawPoints += points;
            rogainingPunches.push({
                controlCode: punch.controlCode,
                points,
                timestamp: punch.timestamp,
            });
        }
    }

    // Calculate penalty
    const overTimeMinutes = Math.ceil(overTime / 60000);
    let penalty = overTimeMinutes * course.penaltyPerMinute;
    if (course.maxPenalty !== undefined) {
        penalty = Math.min(penalty, course.maxPenalty);
    }

    // Final score (cannot go below 0)
    const finalScore = Math.max(0, rawPoints - penalty);

    // Determine status
    let status: RogainingResult['status'] = 'ok';
    if (overTime > 0) {
        status = 'ot';
    }

    return {
        entryId,
        eventId,
        punches: rogainingPunches,
        controlsVisited: visitedControls.size,
        rawPoints,
        runningTime,
        overTime,
        penalty,
        finalScore,
        status,
    };
}

/**
 * Create rogaining controls with default point values
 */
export function createRogainingControls(
    codes: string[],
    defaultPoints: number = 10
): RogainingControl[] {
    return codes.map((code, index) => ({
        id: `control-${code}`,
        code,
        type: 'control' as const,
        order: index + 1,
        points: defaultPoints,
    }));
}

/**
 * Calculate rogaining standings (sorted by score)
 */
export function calculateRogainingStandings(
    results: RogainingResult[]
): (RogainingResult & { position: number })[] {
    // Sort by finalScore descending, then by runningTime ascending for ties
    const sorted = [...results].sort((a, b) => {
        if (b.finalScore !== a.finalScore) {
            return b.finalScore - a.finalScore;
        }
        return a.runningTime - b.runningTime;
    });

    return sorted.map((result, index) => ({
        ...result,
        position: index + 1,
    }));
}
