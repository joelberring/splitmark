export interface ExternalEvent {
    externalId: string;
    source: 'eventor' | 'trail';
    name: string;
    date: string;
    time?: string;
    location: string;
    organizer?: string;
    classification?: string;
    description?: string;
    url?: string;
    distance?: string; // Especially for trail
    infoSummary?: string; // AI generated
    feedSummary?: string; // AI generated
}

export abstract class BaseImporter {
    abstract fetchEvents(params?: any): Promise<ExternalEvent[]>;
}
