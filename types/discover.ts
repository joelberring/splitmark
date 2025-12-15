/**
 * Event Discovery Types
 * Types for Instagram/Strava-inspired event feed
 */

// Event types
export type EventType =
    | 'sprint'
    | 'medel'
    | 'lång'
    | 'ultra'
    | 'natt'
    | 'stafett'
    | 'träning'
    | 'ol';

// Event level
export type EventLevel =
    | 'local'
    | 'regional'
    | 'national'
    | 'championship'
    | 'international';

// Terrain type
export type TerrainType = 'forest' | 'urban' | 'park' | 'mixed';

// Location info
export interface EventLocation {
    name: string;
    municipality: string;
    region?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    distanceFromUser?: number; // km
}

// Organiser info
export interface EventOrganiser {
    id: string;
    name: string;
    shortName?: string;
    logo?: string;
}

// Social stats
export interface EventSocialStats {
    likes: number;
    comments: number;
    shares: number;
}

// Event feed item
export interface EventFeedItem {
    id: string;
    eventorId?: string;

    // Basic info
    name: string;
    description?: string;
    date: string;
    time: string;

    // Visual
    heroImage?: string;
    thumbnails?: string[];

    // Location
    location: EventLocation;

    // Categorization
    type: EventType;
    level: EventLevel;
    terrain: TerrainType;

    // Stats
    entryCount: number;
    maxEntries?: number;
    courseLength?: number; // km (main class)
    courseClimb?: number; // m

    // Organiser
    organiser: EventOrganiser;

    // Social
    social: EventSocialStats;
    isLiked?: boolean;
    isSaved?: boolean;

    // User-specific
    friendsGoing?: string[]; // friend IDs
    clubMatesGoingCount?: number;

    // Registration
    registrationOpen: boolean;
    registrationDeadline?: string;
    registrationUrl?: string;

    // Featured
    isFeatured?: boolean;
    featuredReason?: string;
}

// Filter state
export interface DiscoverFilters {
    search: string;
    types: EventType[];
    levels: EventLevel[];
    terrains: TerrainType[];
    maxDistance: number; // km
    dateFrom: string;
    dateTo: string;
    onlyWithFriends: boolean;
    onlyOpen: boolean;
}

// Sort options
export type SortOption =
    | 'date'
    | 'popularity'
    | 'distance'
    | 'newest';

// Default filters
export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
    search: '',
    types: [],
    levels: [],
    terrains: [],
    maxDistance: 200,
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    onlyWithFriends: false,
    onlyOpen: true,
};

// User preferences for personalization
export interface DiscoverPreferences {
    homeLocation?: {
        lat: number;
        lng: number;
        name: string;
    };
    favoriteClubs: string[];
    preferredTypes: EventType[];
    preferredDistance: number;
}

// Demo event images (placeholder URLs)
export const DEMO_EVENT_IMAGES = [
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop', // Forest
    'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&h=600&fit=crop', // Trail
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop', // Runner
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop', // Forest path
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop', // Runner
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=600&fit=crop', // Trail running
];
