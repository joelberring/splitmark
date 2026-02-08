/**
 * Club Types and Swedish Orienteering Clubs (generated from Eventor)
 */

import generatedClubData from '@/data/eventor-clubs.generated.json';

export interface Club {
    id: string;
    name: string;
    shortName?: string;
    districtId: string;
    districtName: string;
    eventorId?: string;
    website?: string;
    location?: string;
}

export interface ClubMembership {
    odId: string;
    role: 'member' | 'admin' | 'board';
    joinedAt: string;
}

export interface District {
    id: string;
    name: string;
    shortName: string;
    eventorId?: string;
}

type GeneratedDistrict = {
    id: string;
    name: string;
    shortName: string;
    eventorId?: string;
};

type GeneratedClub = {
    id: string;
    name: string;
    shortName?: string;
    districtId: string;
    districtName: string;
    eventorId?: string;
    location?: string;
};

const generatedDistricts = (generatedClubData?.districts || []) as GeneratedDistrict[];
const generatedClubs = (generatedClubData?.clubs || []) as GeneratedClub[];

export const DISTRICTS: District[] = generatedDistricts.map((district) => ({
    id: district.id,
    name: district.name,
    shortName: district.shortName || district.name,
    eventorId: district.eventorId,
}));

export const CLUBS: Club[] = generatedClubs.map((club) => ({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    districtId: club.districtId,
    districtName: club.districtName,
    eventorId: club.eventorId,
    location: club.location,
}));

// Search clubs by name or district
export function searchClubs(query: string): Club[] {
    const q = query.toLowerCase().trim();
    if (!q) return CLUBS;

    return CLUBS.filter(club =>
        club.name.toLowerCase().includes(q) ||
        club.shortName?.toLowerCase().includes(q) ||
        club.districtName.toLowerCase().includes(q) ||
        club.location?.toLowerCase().includes(q)
    );
}

// Get clubs by district
export function getClubsByDistrict(districtId: string): Club[] {
    return CLUBS.filter(club => club.districtId === districtId);
}

// Find club by ID
export function findClubById(clubId: string): Club | undefined {
    return CLUBS.find(club => club.id === clubId);
}
