import generatedClubData from '@/data/eventor-clubs.generated.json';
import type { EventorClub } from './sync';

type GeneratedDistrict = {
    id: string;
    eventorId?: string;
    name: string;
};

type GeneratedClub = {
    id: string;
    eventorId?: string;
    name: string;
    shortName?: string;
    districtId?: string;
};

function toRawEventorId(value?: string): string {
    if (!value) return '';
    return value.replace(/^eventor-/, '');
}

function normalizeClubIdInput(clubId: string): string {
    return clubId.trim().toLowerCase().replace(/^eventor-/, '');
}

export function getGeneratedEventorClubs(): EventorClub[] {
    const districts = (generatedClubData?.districts || []) as GeneratedDistrict[];
    const clubs = (generatedClubData?.clubs || []) as GeneratedClub[];

    const districtEventorIdById = new Map<string, string>();
    for (const district of districts) {
        districtEventorIdById.set(district.id, toRawEventorId(district.eventorId || district.id));
    }

    const mappedClubs: EventorClub[] = [];

    for (const club of clubs) {
        const id = toRawEventorId(club.eventorId || club.id);
        if (!id || !club.name) continue;

        mappedClubs.push({
            id,
            name: club.name,
            shortName: club.shortName,
            type: 'Club',
            parentOrganisationId: club.districtId ? districtEventorIdById.get(club.districtId) : undefined,
        });
    }

    return mappedClubs.sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));
}

export function findGeneratedEventorClub(clubId: string): EventorClub | null {
    const normalized = normalizeClubIdInput(clubId);
    if (!normalized) return null;

    const clubs = getGeneratedEventorClubs();
    return clubs.find((club) => normalizeClubIdInput(club.id) === normalized) || null;
}
