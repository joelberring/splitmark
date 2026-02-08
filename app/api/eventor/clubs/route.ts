/**
 * API Route: Fetch all clubs from Eventor
 * GET /api/eventor/clubs
 */

import { NextResponse } from 'next/server';
import { fetchEventorOrganisations, type EventorClub } from '@/lib/eventor/sync';
import { getGeneratedEventorClubs } from '@/lib/eventor/generated';

// Cache clubs for 24 hours (they don't change often)
let cachedClubs: EventorClub[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
    const apiKey = process.env.EVENTOR_API_KEY;
    const generatedClubs = getGeneratedEventorClubs();

    if (cachedClubs && Date.now() - cacheTime < CACHE_DURATION) {
        return NextResponse.json({
            clubs: cachedClubs,
            cached: true,
            count: cachedClubs.length,
            source: 'eventor-api',
        });
    }

    if (!apiKey) {
        return NextResponse.json({
            clubs: generatedClubs,
            cached: true,
            count: generatedClubs.length,
            source: 'generated-file',
        });
    }

    try {
        // Fetch fresh data
        const allOrgs = await fetchEventorOrganisations(apiKey);

        // Filter to only clubs (not districts/federation)
        const clubs = allOrgs.filter(org => org.type === 'Club');

        // Cache the result
        cachedClubs = clubs;
        cacheTime = Date.now();

        return NextResponse.json({
            clubs,
            cached: false,
            count: clubs.length,
            source: 'eventor-api',
        });
    } catch (error: any) {
        console.error('Failed to fetch clubs from Eventor:', error);
        return NextResponse.json({
            clubs: generatedClubs,
            cached: true,
            count: generatedClubs.length,
            source: 'generated-file',
            warning: error.message || 'Falling back to generated clubs',
        });
    }
}
