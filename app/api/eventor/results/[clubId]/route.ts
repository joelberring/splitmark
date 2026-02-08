/**
 * API Route: Fetch recent results for a club from Eventor
 * GET /api/eventor/results/[clubId]
 */

import { NextResponse } from 'next/server';
import { fetchClubResults } from '@/lib/eventor/sync';

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

    try {
        if (!normalizedClubId) {
            return NextResponse.json(
                { error: 'Club ID required' },
                { status: 400 }
            );
        }

        // Fetch results for the last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
        const toDate = now.toISOString().split('T')[0];

        const results = await fetchClubResults(apiKey, normalizedClubId, fromDate, toDate);

        return NextResponse.json({
            results,
            count: results.length,
            fromDate,
            toDate,
        });
    } catch (error: any) {
        console.error(`Failed to fetch results for club ${clubId}:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch results' },
            { status: 500 }
        );
    }
}
