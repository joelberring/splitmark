import { BaseImporter, ExternalEvent } from './base';
import { eventor } from '../eventor/client';

export class EventorImporter extends BaseImporter {
    async fetchEvents(params: { fromDate: string; toDate: string; classificationId?: string }): Promise<ExternalEvent[]> {
        if (!eventor.isConfigured()) {
            throw new Error('Eventor API key is not configured. Please add it to your settings.');
        }

        try {
            const eventList = await eventor.getEvents(params);

            // eventList structure depends on parseEventList implementation
            // Based on lib/eventor/client.ts, we assume it returns list of events
            const events = (eventList as any).Event || [];

            return events.map((e: any) => ({
                externalId: e.EventId?._text || e.EventId || '',
                source: 'eventor' as const,
                name: e.Name?._text || e.Name || 'Namnlös tävling',
                date: e.StartDate?.Date?._text || e.StartDate?.Date || '',
                time: e.StartTime?.Time?._text || e.StartTime?.Time || undefined,
                location: e.BaseLocationId?._text || '', // Ideally we parse Address/Location
                organizer: e.Organiser?.Name?._text || '',
                classification: e.EventClassificationId?._text || '',
                url: `https://eventor.orientering.se/Events/Show/${e.EventId?._text || e.EventId}`,
            }));
        } catch (error) {
            console.error('Error fetching from Eventor:', error);
            throw error;
        }
    }
}

export const eventorImporter = new EventorImporter();
