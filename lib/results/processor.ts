/**
 * Results Processing
 * Calculate and validate orienteering results
 */

import type { SIPunch } from '@/types/database';

// ============= Internal Types for Processing =============

export type ProcessingStatus = 'OK' | 'MissingPunch' | 'DidNotFinish' | 'DidNotStart' | 'Disqualified';

export interface ProcessedResult {
    personId: string;
    personName?: string;
    classId: string;
    className?: string;
    startTime?: string;
    finishTime?: string;
    time?: number; // seconds
    status: ProcessingStatus;
    splitTimes: ProcessedSplitTime[];
    missingControls?: string[];
    extraControls?: string[];
    position?: number;
    validated: boolean;
}

export interface ProcessedSplitTime {
    controlCode: string;
    time: number; // seconds from start
    status?: 'OK' | 'Missing' | 'Additional';
}

export interface SplitAnalysis {
    controlCode: string;
    splitTime: number; // seconds
    legTime?: number; // time from previous control
    position?: number; // rank on this leg
    timeLoss?: number; // compared to best time
}

// Simplified course interface for processing
export interface ProcessingCourse {
    id: string;
    name: string;
    classId?: string;
    className?: string;
    controls: { code: string; type?: 'start' | 'control' | 'finish' }[];
}

/**
 * Results Processor
 */
export class ResultsProcessor {
    /**
     * Process SI card punches into result
     */
    processCard(
        cardNumber: string,
        punches: SIPunch[],
        course: ProcessingCourse,
        startTime: Date,
        finishTime: Date
    ): ProcessedResult {
        const splitTimes: ProcessedSplitTime[] = [];
        const missingControls: string[] = [];
        const extraControls: string[] = [];

        // Expected controls from course (filter out start/finish for punch comparison)
        const expectedControls = course.controls
            .filter(c => c.type !== 'start' && c.type !== 'finish')
            .map(c => c.code);
        const punchedControls = punches.map(p => p.controlCode);

        // Find missing controls
        for (const expected of expectedControls) {
            if (!punchedControls.includes(expected)) {
                missingControls.push(expected);
            }
        }

        // Find extra controls
        for (const punched of punchedControls) {
            if (!expectedControls.includes(punched)) {
                extraControls.push(punched);
            }
        }

        // Create split times
        for (const punch of punches) {
            const punchTime = punch.timestamp.getTime();

            splitTimes.push({
                controlCode: punch.controlCode,
                time: Math.floor((punchTime - startTime.getTime()) / 1000),
            });
        }

        // Determine status
        let status: ProcessingStatus = 'OK';
        if (missingControls.length > 0) {
            status = 'MissingPunch';
        }

        // Calculate total time
        const totalTime = Math.floor((finishTime.getTime() - startTime.getTime()) / 1000);

        return {
            personId: cardNumber,
            classId: course.classId || '',
            className: course.className,
            startTime: startTime.toISOString(),
            finishTime: finishTime.toISOString(),
            time: totalTime,
            status,
            splitTimes,
            missingControls,
            extraControls,
            validated: missingControls.length === 0,
        };
    }

    /**
     * Analyze split times for a result
     */
    analyzeSplits(
        result: ProcessedResult,
        course: ProcessingCourse,
        allResults: ProcessedResult[]
    ): SplitAnalysis[] {
        const analysis: SplitAnalysis[] = [];

        if (!result.splitTimes || !course.controls) {
            return analysis;
        }

        let previousTime = 0;
        for (let i = 0; i < result.splitTimes.length; i++) {
            const split = result.splitTimes[i];
            const control = course.controls.find(c => c.code === split.controlCode);

            if (!control) continue;

            const legTime = split.time - previousTime;

            // Find best time for this leg
            const legTimes = allResults
                .filter(r => r.splitTimes && r.splitTimes[i])
                .map(r => {
                    const prevTime = i > 0 ? r.splitTimes![i - 1].time : 0;
                    return r.splitTimes![i].time - prevTime;
                })
                .filter(t => t > 0);

            const bestLegTime = legTimes.length > 0 ? Math.min(...legTimes) : legTime;
            const timeLoss = legTime - bestLegTime;

            // Calculate position on this leg
            const position = legTimes.filter(t => t < legTime).length + 1;

            analysis.push({
                controlCode: split.controlCode,
                splitTime: split.time,
                legTime,
                position,
                timeLoss,
            });

            previousTime = split.time;
        }

        return analysis;
    }

    /**
     * Generate results list for a class
     */
    generateResultsList(
        results: ProcessedResult[],
        sortBy: 'time' | 'name' = 'time'
    ): ProcessedResult[] {
        const sorted = [...results];

        if (sortBy === 'time') {
            sorted.sort((a, b) => {
                // OK results first, sorted by time
                if (a.status === 'OK' && b.status !== 'OK') return -1;
                if (a.status !== 'OK' && b.status === 'OK') return 1;

                if (a.status === 'OK' && b.status === 'OK') {
                    return (a.time || 0) - (b.time || 0);
                }

                // Non-OK results at the end
                return a.status < b.status ? -1 : 1;
            });
        } else {
            sorted.sort((a, b) => {
                const nameA = a.personName || '';
                const nameB = b.personName || '';
                return nameA.localeCompare(nameB);
            });
        }

        // Add positions
        let position = 1;
        for (const result of sorted) {
            if (result.status === 'OK') {
                result.position = position++;
            }
        }

        return sorted;
    }

    /**
     * Calculate time behind leader
     */
    calculateTimeBehind(result: ProcessedResult, winnerTime: number): number {
        if (result.status !== 'OK' || !result.time) {
            return 0;
        }

        return result.time - winnerTime;
    }

    /**
     * Format time as MM:SS
     */
    formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format time difference (e.g., +2:30)
     */
    formatTimeDiff(seconds: number): string {
        const sign = seconds >= 0 ? '+' : '-';
        const abs = Math.abs(seconds);
        const mins = Math.floor(abs / 60);
        const secs = abs % 60;
        return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Export singleton
export const resultsProcessor = new ResultsProcessor();
