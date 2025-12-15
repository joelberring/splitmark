/**
 * API Route: Fetch all clubs from Eventor
 * GET /api/eventor/clubs
 */

import { NextResponse } from 'next/server';
import { fetchEventorOrganisations, type EventorClub } from '@/lib/eventor/sync';

// Cache clubs for 24 hours (they don't change often)
let cachedClubs: EventorClub[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
    const apiKey = process.env.EVENTOR_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Eventor API key not configured' },
            { status: 500 }
        );
    }

    try {
        // Check cache
        if (cachedClubs && Date.now() - cacheTime < CACHE_DURATION) {
            return NextResponse.json({
                clubs: cachedClubs,
                cached: true,
                count: cachedClubs.length,
            });
        }

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
        });
    } catch (error: any) {
        console.error('Failed to fetch clubs from Eventor:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch clubs' },
            { status: 500 }
        );
    }
}
