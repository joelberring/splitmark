/**
 * API Route: Fetch individual club info from Eventor
 * GET /api/eventor/clubs/[clubId]
 */

import { NextResponse } from 'next/server';
import { fetchEventorOrganisations } from '@/lib/eventor/sync';
import { findGeneratedEventorClub } from '@/lib/eventor/generated';

function normalizeClubId(raw: string): string {
    return raw.trim().toLowerCase().replace(/^eventor-/, '');
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const apiKey = process.env.EVENTOR_API_KEY;
    const { clubId } = await params;

    const generatedMatch = findGeneratedEventorClub(clubId);

    if (!apiKey) {
        if (!generatedMatch) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        return NextResponse.json({
            ...generatedMatch,
            source: 'generated-file',
        });
    }

    try {
        const allOrgs = await fetchEventorOrganisations(apiKey);
        const normalizedClubId = normalizeClubId(clubId);
        const club = allOrgs.find(org => normalizeClubId(org.id) === normalizedClubId);

        if (!club) {
            if (generatedMatch) {
                return NextResponse.json({
                    ...generatedMatch,
                    source: 'generated-file',
                });
            }
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        return NextResponse.json({
            ...club,
            source: 'eventor-api',
        });
    } catch (error: any) {
        console.error(`Failed to fetch info for club ${clubId}:`, error);
        if (generatedMatch) {
            return NextResponse.json({
                ...generatedMatch,
                source: 'generated-file',
                warning: error.message || 'Falling back to generated club',
            });
        }
        return NextResponse.json({ error: error.message || 'Failed to fetch club info' }, { status: 500 });
    }
}
