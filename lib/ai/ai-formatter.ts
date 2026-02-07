export interface EnrichedContent {
    infoSummary: string;
    feedSummary: string;
    description: string;
}

export async function enrichEventContent(event: {
    name: string;
    date: string;
    location: string;
    organizer?: string;
    classification?: string;
    distance?: string;
}): Promise<EnrichedContent> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // Fallback or development mock
        return {
            infoSummary: `Kommande ${event.classification || 'lopp'} i ${event.location}.`,
            feedSummary: `Häng med på ${event.name} den ${event.date}!`,
            description: `Välkommen till ${event.name}. Ett spännande traillopp arrangerat av ${event.organizer || 'arrangören'}.`
        };
    }

    try {
        // Here we would call the Gemini API
        // For implementation, we'll use a fetch-based call to the Gemini 1.5 Flash model
        const model = 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = `
            Du är en expert på marknadsföring av löpning och orientering. 
            Formatera följande tävlingsdata till professionell information för en app.
            
            Tävling: ${event.name}
            Datum: ${event.date}
            Plats: ${event.location}
            Arrangör: ${event.organizer || 'Okänd'}
            Distans: ${event.distance || 'Okänd'}
            
            Returnera JSON med:
            - infoSummary: En kort, säljande sammanfattning (max 100 tecken).
            - feedSummary: En peppande text för ett socialt flöde (max 150 tecken).
            - description: En längre beskrivande text om loppet (3-4 meningar).
            
            Språk: Svenska.
        `;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) throw new Error('Gemini API call failed');

        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);

        return {
            infoSummary: result.infoSummary,
            feedSummary: result.feedSummary,
            description: result.description
        };
    } catch (error) {
        console.error('Error in AI enrichment:', error);
        return {
            infoSummary: `${event.name} i ${event.location}.`,
            feedSummary: `Missa inte ${event.name}!`,
            description: `Välkommen till ${event.name} den ${event.date}.`
        };
    }
}
