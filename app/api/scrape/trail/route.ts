import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://loppkartan.se/lista/traillopp', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch loppkartan: ${response.status}`);
        }

        const html = await response.text();

        // Simple regex-based parsing for the demo
        // In a real app we'd use cheerio
        const events: any[] = [];
        const itemRegex = /<a href="\/loppsidor\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;

        while ((match = itemRegex.exec(html)) !== null && events.length < 20) {
            const slug = match[1];
            const content = match[2];

            // Extract name from content (usually inside a span or h3)
            const nameMatch = content.match(/<h3[^>]*>([^<]+)<\/h3>/) || content.match(/<span[^>]*>([^<]+)<\/span>/);
            const name = nameMatch ? nameMatch[1].trim() : slug.replace(/_/g, ' ');

            events.push({
                externalId: `trail-${slug}`,
                source: 'trail',
                name: name,
                url: `https://loppkartan.se/loppsidor/${slug}`,
                // Date and location are usually in nearby tags, 
                // but regex parsing is brittle for complex HTML.
                // We'll use some defaults and let AI enrich it later if possible.
                date: '2025-06-01', // Placeholder
                location: 'Sverige',
            });
        }

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('Scraper error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
