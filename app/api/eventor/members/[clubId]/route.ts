/**
 * API Route: Fetch members of a specific club
 * GET /api/eventor/members/[clubId]
 */

import { NextResponse } from 'next/server';
import { fetchClubMembers, fetchClubCompetitors } from '@/lib/eventor/sync';

function normalizeClubId(rawClubId: string): string {
    return rawClubId.trim().replace(/^eventor-/, '');
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const apiKey = process.env.EVENTOR_API_KEY;
    const { clubId } = await params;
    const normalizedClubId = normalizeClubId(clubId);

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Eventor API key not configured' },
            { status: 500 }
        );
    }

    if (!normalizedClubId) {
        return NextResponse.json(
            { error: 'Club ID required' },
            { status: 400 }
        );
    }

    try {
        // Fetch members and competitors in parallel
        const [members, competitors] = await Promise.all([
            fetchClubMembers(apiKey, normalizedClubId),
            fetchClubCompetitors(apiKey, normalizedClubId).catch(() => []), // Competitors might fail for non-owned clubs
        ]);

        // Merge competitor data (SI card, etc) with member data
        const competitorMap = new Map(competitors.map((c: any) => [c.personId, c]));

        const enrichedMembers = members.map(member => {
            const competitor = competitorMap.get(member.id);
            return {
                ...member,
                siCard: competitor?.siCard,
                defaultClass: competitor?.defaultClass,
            };
        });

        return NextResponse.json({
            clubId: normalizedClubId,
            members: enrichedMembers,
            count: enrichedMembers.length,
        });
    } catch (error: any) {
        console.error(`Failed to fetch members for club ${clubId}:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch members' },
            { status: 500 }
        );
    }
}
