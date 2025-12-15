/**
 * Eventor API Sync Functions
 * Fetch and parse club and member data from Eventor
 */

import { XMLParser } from 'fast-xml-parser';

const EVENTOR_API_BASE = 'https://eventor.orientering.se/api';

export interface EventorClub {
    id: string;
    name: string;
    shortName?: string;
    type: 'Club' | 'District' | 'Federation';
    parentOrganisationId?: string;
}

export interface EventorPerson {
    id: string;
    firstName: string;
    lastName: string;
    birthDate?: string;
    sex?: 'M' | 'F';
    siCard?: string;
    defaultClass?: string;
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '_text',
});

/**
 * Fetch all organisations (clubs, districts, federation) from Eventor
 */
export async function fetchEventorOrganisations(apiKey: string): Promise<EventorClub[]> {
    const response = await fetch(`${EVENTOR_API_BASE}/organisations`, {
        headers: { 'ApiKey': apiKey },
    });

    if (!response.ok) {
        throw new Error(`Eventor API error: ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);

    const orgList = parsed.OrganisationList?.Organisation;
    if (!orgList) return [];

    const orgs = Array.isArray(orgList) ? orgList : [orgList];

    return orgs.map((org: any) => ({
        id: org.OrganisationId?._text || org.OrganisationId || '',
        name: org.Name?._text || org.Name || '',
        shortName: org.ShortName?._text || org.ShortName || undefined,
        type: org.OrganisationType?.['@_type'] || org.OrganisationType?._text || 'Club',
        parentOrganisationId: org.ParentOrganisation?.OrganisationId?._text ||
            org.ParentOrganisation?.OrganisationId || undefined,
    }));
}

/**
 * Fetch members of a specific club
 */
export async function fetchClubMembers(apiKey: string, organisationId: string): Promise<EventorPerson[]> {
    const response = await fetch(
        `${EVENTOR_API_BASE}/persons/organisations/${organisationId}?includeContactDetails=false`,
        { headers: { 'ApiKey': apiKey } }
    );

    if (!response.ok) {
        throw new Error(`Eventor API error: ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);

    const personList = parsed.PersonList?.Person;
    if (!personList) return [];

    const persons = Array.isArray(personList) ? personList : [personList];

    return persons.map((p: any) => ({
        id: p.PersonId?._text || p.PersonId || '',
        firstName: p.PersonName?.Given?._text || p.PersonName?.Given || '',
        lastName: p.PersonName?.Family?._text || p.PersonName?.Family || '',
        birthDate: p.BirthDate?.Date?._text || p.BirthDate?.Date || undefined,
        sex: p.Sex?._text || p.Sex || undefined,
    }));
}

/**
 * Get organisation that owns the API key
 */
export async function getApiKeyOwner(apiKey: string): Promise<EventorClub | null> {
    const response = await fetch(`${EVENTOR_API_BASE}/organisation/apiKey`, {
        headers: { 'ApiKey': apiKey },
    });

    if (!response.ok) {
        return null;
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const org = parsed.Organisation;

    if (!org) return null;

    return {
        id: org.OrganisationId?._text || org.OrganisationId || '',
        name: org.Name?._text || org.Name || '',
        shortName: org.ShortName?._text || org.ShortName || undefined,
        type: 'Club',
    };
}

/**
 * Fetch competitor details (SI card, default class) for club members
 */
export async function fetchClubCompetitors(apiKey: string, organisationId: string): Promise<any[]> {
    const response = await fetch(
        `${EVENTOR_API_BASE}/competitors?organisationId=${organisationId}`,
        { headers: { 'ApiKey': apiKey } }
    );

    if (!response.ok) {
        throw new Error(`Eventor API error: ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);

    const competitorList = parsed.CompetitorList?.Competitor;
    if (!competitorList) return [];

    const competitors = Array.isArray(competitorList) ? competitorList : [competitorList];

    return competitors.map((c: any) => ({
        personId: c.Person?.PersonId?._text || c.Person?.PersonId || '',
        firstName: c.Person?.PersonName?.Given?._text || c.Person?.PersonName?.Given || '',
        lastName: c.Person?.PersonName?.Family?._text || c.Person?.PersonName?.Family || '',
        siCard: c.CCard?.CCardId?._text || c.CCard?.CCardId || undefined,
        defaultClass: c.DefaultClass?.EventClassId?._text || undefined,
    }));
}
