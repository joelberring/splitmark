/**
 * Relay Types for Team Orienteering
 */

import type { Course, CourseVariant } from './course';
import type { Entry } from './entry';

/**
 * A relay class with multiple legs
 */
export interface RelayClass {
    id: string;
    name: string;
    eventId: string;

    // Leg configuration
    legs: RelayLeg[];
    legCount: number;

    // Teams
    teams: RelayTeam[];

    // Settings
    massStart: boolean;
    chaseStart: boolean; // Jaktstart
    parallelStart: boolean;

    createdAt: string;
    updatedAt: string;
}

/**
 * A single leg in a relay
 */
export interface RelayLeg {
    legNumber: number;
    name: string;
    courseId: string;

    // Forking variants for this leg
    variants?: string[];

    // Optional settings
    minAge?: number;
    maxAge?: number;
    gender?: 'M' | 'F' | 'any';
}

/**
 * A team in a relay
 */
export interface RelayTeam {
    id: string;
    name: string;
    clubId: string;
    clubName: string;
    classId: string;

    // Team members for each leg
    members: RelayMember[];

    // Start time (for mass start or chase start)
    startTime?: string;

    // Result
    status: 'registered' | 'running' | 'finished' | 'dns' | 'dnf' | 'dsq';
    finishTime?: string;
    totalTime?: number; // ms
    position?: number;

    createdAt: string;
    updatedAt: string;
}

/**
 * A member of a relay team
 */
export interface RelayMember {
    legNumber: number;
    entryId?: string; // Link to Entry if known

    // Person info (may be anonymous initially)
    firstName: string;
    lastName: string;
    siCard?: string;
    birthYear?: number;

    // Variant assignment
    variantId?: string;

    // Timing
    legStartTime?: string;
    legFinishTime?: string;
    legTime?: number; // ms

    // Status
    status: 'registered' | 'running' | 'finished' | 'mp' | 'dnf';
}

/**
 * Create an empty relay team
 */
export function createRelayTeam(
    classId: string,
    clubId: string,
    clubName: string,
    teamName: string,
    legCount: number
): RelayTeam {
    return {
        id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: teamName,
        clubId,
        clubName,
        classId,
        members: Array.from({ length: legCount }, (_, i) => ({
            legNumber: i + 1,
            firstName: 'Vakant',
            lastName: '',
            status: 'registered',
        })),
        status: 'registered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Assign a runner to a leg
 */
export function assignRunnerToLeg(
    team: RelayTeam,
    legNumber: number,
    runner: Partial<RelayMember>
): RelayTeam {
    return {
        ...team,
        members: team.members.map(m =>
            m.legNumber === legNumber
                ? { ...m, ...runner }
                : m
        ),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Calculate total team time from leg times
 */
export function calculateTeamTime(team: RelayTeam): number {
    return team.members.reduce((total, m) => total + (m.legTime || 0), 0);
}

/**
 * Sort teams by total time (for results)
 */
export function sortTeamsByTime(teams: RelayTeam[]): RelayTeam[] {
    return [...teams]
        .filter(t => t.status === 'finished')
        .sort((a, b) => (a.totalTime || Infinity) - (b.totalTime || Infinity))
        .map((t, i) => ({ ...t, position: i + 1 }));
}

/**
 * Import team line-up from text
 * Format: "ClubName, TeamName, Runner1, Runner2, Runner3..."
 */
export function parseTeamLineup(
    text: string,
    classId: string,
    legCount: number
): RelayTeam[] {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const teams: RelayTeam[] = [];

    for (const line of lines) {
        const parts = line.split(/[,;]/).map(p => p.trim());
        if (parts.length < 2) continue;

        const clubName = parts[0];
        const teamName = parts[1] || `${clubName} 1`;

        const team = createRelayTeam(classId, '', clubName, teamName, legCount);

        // Assign runners from remaining parts
        for (let i = 2; i < parts.length && i - 2 < legCount; i++) {
            const runnerName = parts[i];
            if (!runnerName || runnerName === '-') continue;

            const nameParts = runnerName.split(/\s+/);
            team.members[i - 2] = {
                ...team.members[i - 2],
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
            };
        }

        teams.push(team);
    }

    return teams;
}
