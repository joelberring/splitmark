/**
 * Test Club Data from Eventor API
 * 
 * This file contains pre-fetched club and member data from Eventor
 * for use in testing and development.
 */

// Test clubs from Eventor
export const TEST_CLUBS = [
    {
        id: '636',
        eventorId: 636,
        name: 'Centrum OK',
        shortName: 'Centrum OK',
        districtId: '18', // Stockholm OF
        districtName: 'Stockholms OF',
        location: 'Stockholm',
        website: 'http://www.centrumok.se',
        email: 'oskar@thatswe.com',
    },
];

// Members from Centrum OK (328 members)
// Note: Only Centrum OK members are available with our API key
export const CENTRUM_OK_MEMBERS = [
    { id: '431', firstName: 'Olle', lastName: 'Tyrland', birthYear: 1976, siCard: '8524181' },
    { id: '1519', firstName: 'Stefan', lastName: 'Persson', birthYear: 1958, siCard: '8011670' },
    { id: '2796', firstName: 'Anna', lastName: 'Holmström Wikell', birthYear: 1986, siCard: '33844' },
    { id: '2898', firstName: 'Jonas', lastName: 'Kjäll', birthYear: 1982, siCard: '8204099' },
    { id: '3993', firstName: 'Henrik', lastName: 'Lundgren', birthYear: 1979 },
    { id: '3998', firstName: 'Tomas', lastName: 'Holmberg', birthYear: 1979 },
    { id: '4468', firstName: 'Gustav', lastName: 'Delén', birthYear: 1987, siCard: '15034' },
    { id: '4660', firstName: 'Julia', lastName: 'Frisk', birthYear: 1989, siCard: '895403' },
    { id: '4688', firstName: 'Torbjörn', lastName: 'Persson', birthYear: 1984, siCard: '29390' },
    { id: '4915', firstName: 'Magnus', lastName: 'Yngvesson', birthYear: 1989, siCard: '8090806' },
    { id: '5124', firstName: 'Lovisa', lastName: 'Birath', birthYear: 1991, siCard: '306199' },
    { id: '5159', firstName: 'Kristina', lastName: 'Aspvall', birthYear: 1988, siCard: '8122688' },
    { id: '5277', firstName: 'Sofie', lastName: 'Karlsson', birthYear: 1990, siCard: '988645' },
    { id: '5490', firstName: 'Jerk', lastName: 'Rönnols', birthYear: 1985, siCard: '851228' },
    { id: '5558', firstName: 'Mats', lastName: 'Johnsson', birthYear: 1988, siCard: '7880505' },
    { id: '6109', firstName: 'Peter', lastName: 'Rosén', birthYear: 1964, siCard: '8621807' },
    { id: '7221', firstName: 'Linnea', lastName: 'Börjars', birthYear: 1988, siCard: '407201' },
    { id: '7462', firstName: 'Fredrik', lastName: 'Åkerlind', birthYear: 1985, siCard: '9200667' },
    { id: '7486', firstName: 'Alexandra', lastName: 'Sundgren', birthYear: 1991, siCard: '8071091' },
    { id: '7781', firstName: 'Ylva', lastName: 'Fornander', birthYear: 1976, siCard: '428884' },
    { id: '7869', firstName: 'Daniel', lastName: 'Lind', birthYear: 1976, siCard: '76082' },
    // ... first 20 members shown, full list available via API
];

// Function to get all Centrum OK members via API
export async function fetchCentrumOKMembers() {
    const response = await fetch('/api/eventor/members/636');
    if (!response.ok) throw new Error('Failed to fetch members');
    const data = await response.json();
    return data.members;
}

// Function to get all Swedish clubs via API
export async function fetchAllClubs() {
    const response = await fetch('/api/eventor/clubs');
    if (!response.ok) throw new Error('Failed to fetch clubs');
    const data = await response.json();
    return data.clubs;
}

// Seed function to populate localStorage with test club data
export function seedTestClubs() {
    const existing = localStorage.getItem('clubs');
    if (!existing) {
        localStorage.setItem('clubs', JSON.stringify(TEST_CLUBS));
    }
}
