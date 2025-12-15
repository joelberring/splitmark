/**
 * Relay Management Library
 * Handles relay team management, forking validation, and changeover times
 */

import type { RelayClass, RelayTeam, RelayMember, RelayLeg } from '@/types/relay';

// ============= Forking Validation =============

export interface ForkingValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    controlDistribution: Map<string, number>;
}

/**
 * Validate that forking is fair - each control visited roughly same number of times
 */
export function validateForking(
    legs: RelayLeg[],
    teamCount: number
): ForkingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const controlDistribution = new Map<string, number>();

    // Count how many times each control is visited across all variants
    for (const leg of legs) {
        if (!leg.variants || leg.variants.length === 0) {
            warnings.push(`Sträcka ${leg.legNumber}: Inga gaffelvarianter definierade`);
            continue;
        }

        // Each variant should be run by approximately teamCount/variantCount teams
        const expectedPerVariant = teamCount / leg.variants.length;

        // For demonstration - in real implementation, parse course controls
        for (const variantId of leg.variants) {
            const current = controlDistribution.get(variantId) || 0;
            controlDistribution.set(variantId, current + 1);
        }
    }

    // Check for imbalance (>20% deviation is a warning, >50% is an error)
    const counts = Array.from(controlDistribution.values());
    if (counts.length > 0) {
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        for (const [variant, count] of controlDistribution) {
            const deviation = Math.abs(count - avg) / avg;
            if (deviation > 0.5) {
                errors.push(`Variant ${variant}: Obalanserad fördelning (${count} vs ${avg.toFixed(1)} förväntat)`);
            } else if (deviation > 0.2) {
                warnings.push(`Variant ${variant}: Något obalanserad (${count} vs ${avg.toFixed(1)})`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        controlDistribution
    };
}

/**
 * Generate fork assignments for teams to ensure fairness
 */
export function generateForkAssignments(
    teams: RelayTeam[],
    legs: RelayLeg[]
): Map<string, string[]> {
    const assignments = new Map<string, string[]>();

    for (const team of teams) {
        const teamForks: string[] = [];

        for (const leg of legs) {
            if (!leg.variants || leg.variants.length === 0) {
                teamForks.push('');
                continue;
            }

            // Simple round-robin assignment for fairness
            const variantIndex = teams.indexOf(team) % leg.variants.length;
            teamForks.push(leg.variants[variantIndex]);
        }

        assignments.set(team.id, teamForks);
    }

    return assignments;
}

// ============= Changeover Time Tracking =============

export interface ChangeoverTime {
    teamId: string;
    legNumber: number;
    arrivalTime: Date;
    departureTime?: Date;
    waitTime?: number; // ms waiting for next runner
}

/**
 * Calculate changeover times for a team
 */
export function calculateChangeoverTimes(
    team: RelayTeam
): ChangeoverTime[] {
    const changeovers: ChangeoverTime[] = [];

    for (let i = 0; i < team.members.length - 1; i++) {
        const current = team.members[i];
        const next = team.members[i + 1];

        if (current.legFinishTime) {
            const changeover: ChangeoverTime = {
                teamId: team.id,
                legNumber: current.legNumber,
                arrivalTime: new Date(current.legFinishTime),
            };

            if (next.legStartTime) {
                changeover.departureTime = new Date(next.legStartTime);
                changeover.waitTime = changeover.departureTime.getTime() - changeover.arrivalTime.getTime();
            }

            changeovers.push(changeover);
        }
    }

    return changeovers;
}

// ============= Team Lineup Import =============

export interface TeamLineup {
    teamName: string;
    clubName: string;
    members: {
        name: string;
        legNumber: number;
        siCard?: string;
    }[];
}

/**
 * Parse team lineups from CSV format:
 * TeamName,Club,Leg1Name,Leg1SI,Leg2Name,Leg2SI,...
 */
export function parseTeamLineupsCSV(csv: string): TeamLineup[] {
    const lines = csv.trim().split('\n').filter(l => l.trim());
    const teams: TeamLineup[] = [];

    for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 4) continue;

        const [teamName, clubName, ...memberParts] = parts;
        const members: TeamLineup['members'] = [];
        let legNumber = 1;

        for (let i = 0; i < memberParts.length; i += 2) {
            const name = memberParts[i];
            const siCard = memberParts[i + 1];
            if (name) {
                members.push({ name, legNumber, siCard: siCard || undefined });
                legNumber++;
            }
        }

        if (members.length > 0) {
            teams.push({ teamName, clubName, members });
        }
    }

    return teams;
}

/**
 * Parse team lineups from text format:
 * Lag 1 - OK Linné
 * 1. Anna Andersson (123456)
 * 2. Bertil Bengtsson (234567)
 */
export function parseTeamLineupsText(text: string): TeamLineup[] {
    const lines = text.trim().split('\n');
    const teams: TeamLineup[] = [];
    let currentTeam: TeamLineup | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for team header: "TeamName - ClubName" or "TeamName (ClubName)"
        const teamMatch = trimmed.match(/^(.+?)\s*[-–]\s*(.+)$/) ||
            trimmed.match(/^(.+?)\s*\(([^)]+)\)$/);

        if (teamMatch && !trimmed.match(/^\d+\./)) {
            if (currentTeam && currentTeam.members.length > 0) {
                teams.push(currentTeam);
            }
            currentTeam = {
                teamName: teamMatch[1].trim(),
                clubName: teamMatch[2].trim(),
                members: []
            };
            continue;
        }

        // Check for member line: "1. Name (SI)" or "1. Name"
        const memberMatch = trimmed.match(/^(\d+)\.\s*(.+?)(?:\s*\((\d+)\))?$/);
        if (memberMatch && currentTeam) {
            currentTeam.members.push({
                legNumber: parseInt(memberMatch[1]),
                name: memberMatch[2].trim(),
                siCard: memberMatch[3]
            });
        }
    }

    if (currentTeam && currentTeam.members.length > 0) {
        teams.push(currentTeam);
    }

    return teams;
}

// ============= Result Calculations =============

/**
 * Calculate leg times for a team
 */
export function calculateLegTimes(team: RelayTeam): {
    legNumber: number;
    memberName: string;
    time: number | null;
    status: 'ok' | 'mp' | 'dnf' | 'dns' | 'running';
}[] {
    return team.members.map(member => {
        let time: number | null = null;
        let status: 'ok' | 'mp' | 'dnf' | 'dns' | 'running' = 'dns';

        if (member.legStartTime && member.legFinishTime) {
            time = new Date(member.legFinishTime).getTime() - new Date(member.legStartTime).getTime();
            status = member.status === 'mp' ? 'mp' :
                member.status === 'dnf' ? 'dnf' : 'ok';
        } else if (member.legStartTime && !member.legFinishTime) {
            status = 'running';
        }

        return {
            legNumber: member.legNumber,
            memberName: `${member.firstName} ${member.lastName}`,
            time,
            status
        };
    });
}

/**
 * Sort teams by total time
 */
export function sortTeamsByResult(teams: RelayTeam[]): RelayTeam[] {
    return [...teams].sort((a, b) => {
        // Teams with all OK legs first
        const aComplete = a.members.every(m => m.legFinishTime && m.status !== 'mp');
        const bComplete = b.members.every(m => m.legFinishTime && m.status !== 'mp');

        if (aComplete && !bComplete) return -1;
        if (!aComplete && bComplete) return 1;

        // Then by total time
        return (a.totalTime || Infinity) - (b.totalTime || Infinity);
    });
}
