/**
 * API Route: Fetch individual club info from Eventor
 * GET /api/eventor/clubs/[clubId]
 */

import { NextResponse } from 'next/server';
import { fetchEventorOrganisations } from '@/lib/eventor/sync';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const apiKey = process.env.EVENTOR_API_KEY;
    const { clubId } = await params;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Eventor API key not configured' },
            { status: 500 }
        );
    }

    try {
        const allOrgs = await fetchEventorOrganisations(apiKey);
        const club = allOrgs.find(org => org.id === clubId);

        if (!club) {
            return NextResponse.json(
                { error: 'Club not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(club);
    } catch (error: any) {
        console.error(`Failed to fetch info for club ${clubId}:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch club info' },
            { status: 500 }
        );
    }
}
