/**
 * Free Text Import for Competition Entries
 * 
 * Parses flexible text formats commonly used in orienteering:
 * - "Name, Club, Class, SI" format
 * - "Club\nName1, Class, SI\nName2, Class, SI" format
 * - Tab/semicolon separated variations
 */

import type { Entry } from '@/types/entry';

export interface ParsedEntry {
    firstName: string;
    lastName: string;
    clubName: string;
    className: string;
    siCard?: string;
    confidence: number; // 0-1 how confident we are in the parse
}

export interface ParseResult {
    entries: ParsedEntry[];
    errors: string[];
    format: string;
}

// Known Swedish orienteering clubs for fuzzy matching
const KNOWN_CLUBS = [
    'OK Linné', 'IFK Göteborg', 'Stora Tuna OK', 'Järla Orientering',
    'Almby IK', 'OK Kåre', 'Attunda OK', 'Djurgårdens IF', 'Snättringe SK',
    'IF Thor', 'Nacka OK', 'Eskilstuna OL', 'Borlänge SK', 'Falun-Borlänge SK',
    'Lidingö SK', 'Sundsvalls OK', 'Leksands OK', 'Sollentuna OK',
    'Täby OK', 'Västerås SK', 'Uppsala OK', 'Umeå OK',
    // Add more as needed
];

// Common class names
const KNOWN_CLASSES = [
    'H10', 'H12', 'H14', 'H16', 'H18', 'H20', 'H21', 'H35', 'H40', 'H45', 'H50', 'H55', 'H60', 'H65', 'H70', 'H75', 'H80',
    'D10', 'D12', 'D14', 'D16', 'D18', 'D20', 'D21', 'D35', 'D40', 'D45', 'D50', 'D55', 'D60', 'D65', 'D70', 'D75', 'D80',
    'Öppen 1', 'Öppen 2', 'Öppen 3', 'Öppen 4', 'Öppen 5', 'Öppen 6', 'Öppen 7', 'Öppen 8', 'Öppen 9', 'Öppen 10',
    'Korta', 'Mellan', 'Långa', 'Ultralånga',
    'Inskolning', 'Nybörjare', 'Motion', 'U1', 'U2', 'U3',
];

/**
 * Detect the format of the input text
 */
function detectFormat(text: string): 'csv' | 'club-grouped' | 'tab-separated' | 'unknown' {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return 'unknown';

    // Check for tab separation
    if (lines[0].includes('\t')) {
        return 'tab-separated';
    }

    // Check if first line is a club name (club-grouped format)
    const firstLine = lines[0].trim();
    const isClub = KNOWN_CLUBS.some(c =>
        firstLine.toLowerCase().includes(c.toLowerCase()) ||
        firstLine.match(/^[A-ZÅÄÖ][a-zåäö]+(\s+[A-ZÅÄÖ][a-zåäö]+)*\s*(OK|SK|IF|IK|SOK)$/)
    );
    if (isClub && !lines[0].includes(',')) {
        return 'club-grouped';
    }

    // Default to CSV
    return 'csv';
}

/**
 * Parse a name into first and last name
 */
function parseName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    if (parts.length === 2) {
        return { firstName: parts[0], lastName: parts[1] };
    }
    // Multiple parts - assume first is first name, rest is last name
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

/**
 * Check if a string looks like an SI card number (6-7 digits)
 */
function isSICard(value: string): boolean {
    return /^\d{6,7}$/.test(value.trim());
}

/**
 * Check if a string looks like a class name
 */
function isClassName(value: string): boolean {
    const v = value.trim();
    return KNOWN_CLASSES.some(c => c.toLowerCase() === v.toLowerCase()) ||
        /^[HD]\d{1,2}[EKNALMS]?$/.test(v) ||
        /^Öppen\s*\d+$/i.test(v);
}

/**
 * Parse CSV format: "Name, Club, Class, SI" or variations
 */
function parseCSV(text: string): ParseResult {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const entries: ParsedEntry[] = [];
    const errors: string[] = [];

    // Try to detect column order from first line (if it's a header)
    let hasHeader = false;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('namn') || firstLine.includes('name') ||
        firstLine.includes('klubb') || firstLine.includes('club')) {
        hasHeader = true;
    }

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by comma or semicolon
        const parts = line.split(/[,;]/).map(p => p.trim()).filter(p => p);

        if (parts.length < 2) {
            errors.push(`Rad ${i + 1}: För få fält (${parts.length})`);
            continue;
        }

        // Intelligent field detection
        let name = '';
        let club = '';
        let className = '';
        let siCard = '';

        for (const part of parts) {
            if (isSICard(part)) {
                siCard = part;
            } else if (isClassName(part)) {
                className = part;
            } else if (KNOWN_CLUBS.some(c => c.toLowerCase() === part.toLowerCase())) {
                club = part;
            } else if (!name) {
                name = part;
            } else if (!club) {
                club = part;
            }
        }

        if (!name) {
            errors.push(`Rad ${i + 1}: Kunde inte hitta namn`);
            continue;
        }

        const { firstName, lastName } = parseName(name);
        entries.push({
            firstName,
            lastName,
            clubName: club,
            className,
            siCard: siCard || undefined,
            confidence: 0.8
        });
    }

    return { entries, errors, format: 'csv' };
}

/**
 * Parse club-grouped format:
 * Club Name
 * Person1, Class, SI
 * Person2, Class, SI
 * 
 * Club Name 2
 * Person3, Class, SI
 */
function parseClubGrouped(text: string): ParseResult {
    const lines = text.trim().split('\n');
    const entries: ParsedEntry[] = [];
    const errors: string[] = [];

    let currentClub = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            currentClub = ''; // Reset on empty line
            continue;
        }

        // Check if this is a club line
        const parts = line.split(/[,;]/).map(p => p.trim());

        if (parts.length === 1 && !isSICard(parts[0]) && !isClassName(parts[0])) {
            // Likely a club name
            currentClub = parts[0];
            continue;
        }

        // Parse as entry
        let name = '';
        let className = '';
        let siCard = '';

        for (const part of parts) {
            if (isSICard(part)) {
                siCard = part;
            } else if (isClassName(part)) {
                className = part;
            } else if (!name) {
                name = part;
            }
        }

        if (!name) continue;

        const { firstName, lastName } = parseName(name);
        entries.push({
            firstName,
            lastName,
            clubName: currentClub,
            className,
            siCard: siCard || undefined,
            confidence: 0.7
        });
    }

    return { entries, errors, format: 'club-grouped' };
}

/**
 * Parse tab-separated format
 */
function parseTabSeparated(text: string): ParseResult {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const entries: ParsedEntry[] = [];
    const errors: string[] = [];

    // Check for header row
    let hasHeader = false;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('namn') || firstLine.includes('name')) {
        hasHeader = true;
    }

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split('\t').map(p => p.trim());

        if (parts.length < 2) continue;

        // Assume order: Name, Club, Class, SI (most common in Excel)
        const { firstName, lastName } = parseName(parts[0]);

        entries.push({
            firstName,
            lastName,
            clubName: parts[1] || '',
            className: parts[2] || '',
            siCard: parts[3] && isSICard(parts[3]) ? parts[3] : undefined,
            confidence: 0.9
        });
    }

    return { entries, errors, format: 'tab-separated' };
}

/**
 * Main function: Parse free text into entries
 */
export function parseFreeText(text: string): ParseResult {
    const format = detectFormat(text);

    switch (format) {
        case 'tab-separated':
            return parseTabSeparated(text);
        case 'club-grouped':
            return parseClubGrouped(text);
        case 'csv':
        default:
            return parseCSV(text);
    }
}

/**
 * Convert ParsedEntry to Entry
 */
export function toEntry(
    parsed: ParsedEntry,
    eventId: string,
    classId?: string
): Entry {
    return {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventId,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        clubId: undefined,
        clubName: parsed.clubName,
        classId: classId || '',
        className: parsed.className,
        siCard: parsed.siCard,
        status: 'registered',
        entryType: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Fuzzy match a club name to known clubs
 */
export function matchClub(input: string): string | null {
    const lowerInput = input.toLowerCase().trim();

    // Exact match
    const exact = KNOWN_CLUBS.find(c => c.toLowerCase() === lowerInput);
    if (exact) return exact;

    // Partial match
    const partial = KNOWN_CLUBS.find(c =>
        c.toLowerCase().includes(lowerInput) ||
        lowerInput.includes(c.toLowerCase())
    );

    return partial || null;
}
