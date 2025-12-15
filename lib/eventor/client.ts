/**
 * Eventor API Client
 * Integration with Svenska Orienteringsförbundets system
 */

import type { EventList, EntryList, ResultList } from '@/types/iof';
import { parseEventList, parseEntryList, serializeResultList } from '../iof/parser';

export class EventorClient {
    private baseURL: string;
    private apiKey: string;

    constructor(apiKey?: string) {
        this.baseURL = process.env.NEXT_PUBLIC_EVENTOR_API_URL || 'https://eventor.orientering.se/api';
        this.apiKey = apiKey || process.env.EVENTOR_API_KEY || '';
    }

    /**
     * Fetch upcoming events
     */
    async getEvents(params?: {
        fromDate?: string; // YYYY-MM-DD
        toDate?: string;
        organisationId?: string;
        classificationId?: string;
    }): Promise<EventList> {
        const queryParams = new URLSearchParams();

        if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
        if (params?.toDate) queryParams.append('toDate', params.toDate);
        if (params?.organisationId) queryParams.append('organisationId', params.organisationId);
        if (params?.classificationId) queryParams.append('classificationId', params.classificationId);

        const xml = await this.fetch(`/events?${queryParams.toString()}`);
        return parseEventList(xml);
    }

    /**
     * Get event details
     */
    async getEvent(eventId: string): Promise<EventList> {
        const xml = await this.fetch(`/event/${eventId}`);
        return parseEventList(xml);
    }

    /**
     * Get entries for an event
     */
    async getEntries(eventId: string): Promise<EntryList> {
        const xml = await this.fetch(`/entries/event/${eventId}`);
        return parseEntryList(xml);
    }

    /**
     * Get start list for an event
     */
    async getStartList(eventId: string): Promise<any> {
        const xml = await this.fetch(`/starts/event/${eventId}`);
        // Parse start list
        return xml; // TODO: Parse properly
    }

    /**
     * Get results for an event
     */
    async getResults(eventId: string, params?: {
        includeSplitTimes?: boolean;
    }): Promise<ResultList> {
        const queryParams = new URLSearchParams();

        if (params?.includeSplitTimes) {
            queryParams.append('includeSplitTimes', 'true');
        }

        const xml = await this.fetch(`/results/event/${eventId}?${queryParams.toString()}`);
        // Parse result list
        return JSON.parse(xml); // TODO: Parse properly with parseResultList
    }

    /**
     * Upload results to Eventor
     */
    async uploadResults(eventId: string, results: ResultList): Promise<void> {
        const xml = serializeResultList(results);

        await this.fetch(`/results/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
            },
            body: xml,
        });
    }

    /**
     * Search for competitors
     */
    async searchCompetitors(query: string): Promise<any> {
        const xml = await this.fetch(`/persons?name=${encodeURIComponent(query)}`);
        return xml; // TODO: Parse to CompetitorList
    }

    /**
     * Get organisations (clubs)
     */
    async getOrganisations(): Promise<any> {
        const xml = await this.fetch('/organisations');
        return xml; // TODO: Parse to OrganisationList
    }

    /**
     * Internal fetch with API key authentication
     */
    private async fetch(
        endpoint: string,
        options?: RequestInit
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Eventor API key not configured');
        }

        const url = `${this.baseURL}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'ApiKey': this.apiKey,
                ...options?.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Eventor API error (${response.status}): ${error}`);
        }

        return response.text();
    }

    /**
     * Set API key (for user-provided keys)
     */
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Check if client is configured
     */
    isConfigured(): boolean {
        return !!this.apiKey;
    }
}

// Export singleton instance
export const eventor = new EventorClient();
