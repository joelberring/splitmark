/**
 * Lottning (Draw) Algorithms
 * 
 * Implements various draw methods for orienteering competitions:
 * - MeOS style (club separation)
 * - Random
 * - SOFT (older Swedish standard)
 * - Klungor (group start for relay training)
 * - Gemensam start (mass start)
 * - Seedad (seeded based on ranking)
 */

import type { Entry } from '@/types/entry';

export interface LottningOptions {
    firstStart: Date;
    interval: number; // seconds between starts
    vacancies: number; // vacanser per class
    clubSeparation: boolean;
    minClubSeparation: number; // minimum starts between same club
}

export interface StartAssignment {
    entryId: string;
    startTime: Date;
    bibNumber?: number;
    order: number;
}

export interface StartList {
    classId: string;
    className: string;
    assignments: StartAssignment[];
    vacancies: StartAssignment[];
}

/**
 * MeOS-style lottning with club separation
 */
export function lottaMeOS(
    entries: Entry[],
    options: LottningOptions
): StartAssignment[] {
    if (entries.length === 0) return [];

    const shuffled = shuffleArray([...entries]);
    const result: StartAssignment[] = [];
    const clubLastIndex: Record<string, number> = {};

    let currentTime = new Date(options.firstStart);

    // Try to place each entry with club separation
    for (let i = 0; i < shuffled.length; i++) {
        const entry = shuffled[i];
        const club = entry.clubName || 'unknown';

        // Check if we need to space this entry from same club
        if (options.clubSeparation && clubLastIndex[club] !== undefined) {
            const lastIndex = clubLastIndex[club];
            const separation = i - lastIndex;

            if (separation < options.minClubSeparation) {
                // Try to swap with someone else
                const swapTarget = findSwapTarget(
                    shuffled,
                    i,
                    club,
                    clubLastIndex,
                    options.minClubSeparation
                );

                if (swapTarget !== -1 && swapTarget > i) {
                    [shuffled[i], shuffled[swapTarget]] = [shuffled[swapTarget], shuffled[i]];
                }
            }
        }

        result.push({
            entryId: shuffled[i].id,
            startTime: new Date(currentTime),
            order: i + 1,
        });

        clubLastIndex[shuffled[i].clubName || 'unknown'] = i;
        currentTime = new Date(currentTime.getTime() + options.interval * 1000);
    }

    return result;
}

/**
 * Random permutation (no club separation)
 */
export function lottaRandom(
    entries: Entry[],
    options: LottningOptions
): StartAssignment[] {
    const shuffled = shuffleArray([...entries]);
    let currentTime = new Date(options.firstStart);

    return shuffled.map((entry, i) => {
        const assignment: StartAssignment = {
            entryId: entry.id,
            startTime: new Date(currentTime),
            order: i + 1,
        };
        currentTime = new Date(currentTime.getTime() + options.interval * 1000);
        return assignment;
    });
}

/**
 * SOFT lottning (older Swedish method)
 * Similar to MeOS but with specific rules
 */
export function lottaSOFT(
    entries: Entry[],
    options: LottningOptions
): StartAssignment[] {
    // Group by club first
    const byClub: Record<string, Entry[]> = {};
    entries.forEach(entry => {
        const club = entry.clubName || 'unknown';
        if (!byClub[club]) byClub[club] = [];
        byClub[club].push(entry);
    });

    // Shuffle within each club
    Object.values(byClub).forEach(clubEntries => {
        shuffleArray(clubEntries);
    });

    // Round-robin pick from clubs
    const result: Entry[] = [];
    const clubNames = shuffleArray(Object.keys(byClub));

    while (result.length < entries.length) {
        for (const club of clubNames) {
            if (byClub[club].length > 0) {
                result.push(byClub[club].shift()!);
            }
        }
    }

    let currentTime = new Date(options.firstStart);
    return result.map((entry, i) => {
        const assignment: StartAssignment = {
            entryId: entry.id,
            startTime: new Date(currentTime),
            order: i + 1,
        };
        currentTime = new Date(currentTime.getTime() + options.interval * 1000);
        return assignment;
    });
}

/**
 * Klungstart (group start for relay training)
 */
export function lottaKlungor(
    entries: Entry[],
    klungSize: number,
    options: LottningOptions
): StartAssignment[] {
    const shuffled = shuffleArray([...entries]);
    let currentTime = new Date(options.firstStart);
    let klungIndex = 0;

    return shuffled.map((entry, i) => {
        if (i > 0 && i % klungSize === 0) {
            currentTime = new Date(currentTime.getTime() + options.interval * 1000);
            klungIndex++;
        }

        return {
            entryId: entry.id,
            startTime: new Date(currentTime),
            order: i + 1,
            bibNumber: klungIndex + 1,
        };
    });
}

/**
 * Gemensam start (mass start)
 */
export function gemensamStart(
    entries: Entry[],
    startTime: Date
): StartAssignment[] {
    return entries.map((entry, i) => ({
        entryId: entry.id,
        startTime: new Date(startTime),
        order: i + 1,
    }));
}

/**
 * Seedad lottning (seeded based on ranking)
 */
export interface Ranking {
    entryId: string;
    rank: number;
}

export function lottaSeedad(
    entries: Entry[],
    rankings: Ranking[],
    options: LottningOptions
): StartAssignment[] {
    // Sort by ranking (lower is better)
    const rankMap = new Map(rankings.map(r => [r.entryId, r.rank]));

    const sorted = [...entries].sort((a, b) => {
        const rankA = rankMap.get(a.id) ?? 9999;
        const rankB = rankMap.get(b.id) ?? 9999;
        return rankA - rankB;
    });

    // Best runners get later starts (commonly used)
    const reversed = sorted.reverse();

    let currentTime = new Date(options.firstStart);
    return reversed.map((entry, i) => {
        const assignment: StartAssignment = {
            entryId: entry.id,
            startTime: new Date(currentTime),
            order: i + 1,
        };
        currentTime = new Date(currentTime.getTime() + options.interval * 1000);
        return assignment;
    });
}

/**
 * Create vacancies (empty start slots)
 */
export function createVacancies(
    count: number,
    startTime: Date,
    interval: number,
    startOrder: number
): StartAssignment[] {
    const vacancies: StartAssignment[] = [];
    let currentTime = new Date(startTime);

    for (let i = 0; i < count; i++) {
        vacancies.push({
            entryId: `vacancy-${i + 1}`,
            startTime: new Date(currentTime),
            order: startOrder + i,
        });
        currentTime = new Date(currentTime.getTime() + interval * 1000);
    }

    return vacancies;
}

// Helper functions

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function findSwapTarget(
    entries: Entry[],
    currentIndex: number,
    club: string,
    clubLastIndex: Record<string, number>,
    minSeparation: number
): number {
    // Look for someone further ahead to swap with
    for (let j = currentIndex + 1; j < entries.length; j++) {
        const targetClub = entries[j].clubName || 'unknown';

        // Check if swapping would be better
        const targetLastIndex = clubLastIndex[targetClub];
        if (targetLastIndex === undefined || currentIndex - targetLastIndex >= minSeparation) {
            return j;
        }
    }
    return -1;
}

/**
 * Calculate lottning stats
 */
export function calculateLottningStats(
    assignments: StartAssignment[],
    entries: Entry[]
): {
    totalEntries: number;
    clubCount: number;
    avgClubSeparation: number;
    minClubSeparation: number;
    firstStart: string;
    lastStart: string;
} {
    const entryMap = new Map(entries.map(e => [e.id, e]));
    const clubPositions: Record<string, number[]> = {};

    assignments.forEach((a, index) => {
        const entry = entryMap.get(a.entryId);
        if (entry) {
            const club = entry.clubName || 'unknown';
            if (!clubPositions[club]) clubPositions[club] = [];
            clubPositions[club].push(index);
        }
    });

    // Calculate separations
    const separations: number[] = [];
    Object.values(clubPositions).forEach(positions => {
        for (let i = 1; i < positions.length; i++) {
            separations.push(positions[i] - positions[i - 1]);
        }
    });

    const startTimes = assignments.map(a => new Date(a.startTime).getTime());

    return {
        totalEntries: assignments.length,
        clubCount: Object.keys(clubPositions).length,
        avgClubSeparation: separations.length > 0
            ? separations.reduce((a, b) => a + b, 0) / separations.length
            : 0,
        minClubSeparation: separations.length > 0
            ? Math.min(...separations)
            : 0,
        firstStart: new Date(Math.min(...startTimes)).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
        lastStart: new Date(Math.max(...startTimes)).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    };
}

/**
 * Start Groups for Multi-Class Lottning
 */
export interface StartGroup {
    id: string;
    name: string;
    startTime: Date;
    interval: number; // seconds between starts within group
    classIds: string[];
}

/**
 * Multi-class lottning with start groups
 * Classes in the same group share start times and are interleaved
 */
export function lottaWithStartGroups(
    entriesByClass: Map<string, Entry[]>,
    startGroups: StartGroup[],
    options: Omit<LottningOptions, 'firstStart'>
): Map<string, StartAssignment[]> {
    const results = new Map<string, StartAssignment[]>();

    for (const group of startGroups) {
        // Collect all entries from classes in this group
        const groupEntries: { entry: Entry; classId: string }[] = [];

        for (const classId of group.classIds) {
            const entries = entriesByClass.get(classId) || [];
            entries.forEach(entry => {
                groupEntries.push({ entry, classId });
            });
        }

        if (groupEntries.length === 0) continue;

        // Shuffle entries while trying to maintain club separation
        const shuffled = shuffleArray([...groupEntries]);

        // Apply club separation across all classes in group
        const clubLastIndex: Record<string, number> = {};
        const reordered: typeof shuffled = [];

        for (let i = 0; i < shuffled.length; i++) {
            const { entry } = shuffled[i];
            const club = entry.clubName || 'unknown';

            if (options.clubSeparation && clubLastIndex[club] !== undefined) {
                const lastIndex = clubLastIndex[club];
                const separation = reordered.length - lastIndex;

                if (separation < options.minClubSeparation) {
                    // Try to find better position
                    let inserted = false;
                    for (let j = reordered.length - 1; j >= Math.max(0, lastIndex + options.minClubSeparation); j--) {
                        const targetClub = reordered[j].entry.clubName || 'unknown';
                        const targetLastIndex = clubLastIndex[targetClub];
                        if (targetLastIndex === undefined || reordered.length - targetLastIndex >= options.minClubSeparation) {
                            reordered.splice(j + 1, 0, shuffled[i]);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        reordered.push(shuffled[i]);
                    }
                } else {
                    reordered.push(shuffled[i]);
                }
            } else {
                reordered.push(shuffled[i]);
            }

            clubLastIndex[club] = reordered.length - 1;
        }

        // Assign start times
        let currentTime = new Date(group.startTime);
        const assignmentsByClass = new Map<string, StartAssignment[]>();

        reordered.forEach((item, index) => {
            const assignment: StartAssignment = {
                entryId: item.entry.id,
                startTime: new Date(currentTime),
                order: index + 1,
            };

            if (!assignmentsByClass.has(item.classId)) {
                assignmentsByClass.set(item.classId, []);
            }
            assignmentsByClass.get(item.classId)!.push(assignment);

            currentTime = new Date(currentTime.getTime() + group.interval * 1000);
        });

        // Merge into results
        assignmentsByClass.forEach((assignments, classId) => {
            const existing = results.get(classId) || [];
            results.set(classId, [...existing, ...assignments]);
        });
    }

    return results;
}

/**
 * Import start groups from CSV
 * Format: "GroupName, StartTime, ClassId1, ClassId2, ..."
 */
export function parseStartGroups(csv: string, interval: number = 120): StartGroup[] {
    const lines = csv.trim().split('\n').filter(l => l.trim());
    const groups: StartGroup[] = [];

    for (const line of lines) {
        const parts = line.split(/[,;]/).map(p => p.trim());
        if (parts.length < 3) continue;

        const name = parts[0];
        const timeStr = parts[1];
        const classIds = parts.slice(2);

        // Parse time (HH:MM or HH:MM:SS)
        const [h, m, s] = timeStr.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(h, m, s || 0, 0);

        groups.push({
            id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name,
            startTime,
            interval,
            classIds,
        });
    }

    return groups;
}
