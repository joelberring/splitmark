/**
 * Competition domain helpers.
 * Centralizes status normalization and access rules for guest/authenticated users.
 */

export type CompetitionStatus = 'draft' | 'upcoming' | 'live' | 'completed';

export interface EventLike {
    id?: string;
    status?: string;
    date?: string;
    time?: string;
    visibility?: string;
    clubId?: string;
    createdBy?: string;
}

export interface UserLike {
    uid?: string;
    role?: string;
    systemRole?: string;
    clubId?: string;
}

export interface EventAccessProfile {
    status: CompetitionStatus;
    canView: boolean;
    canViewLive: boolean;
    canViewReplay: boolean;
    canViewResults: boolean;
    canRegister: boolean;
    registrationRequiresLogin: boolean;
    canUseSocialFeatures: boolean;
}

const LIVE_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 12 * 60 * 60 * 1000;
const AUTO_COMPLETE_AFTER_MS = 18 * 60 * 60 * 1000;

function parseEventStart(date?: string, time?: string): Date | null {
    if (!date) return null;

    const datePart = date.slice(0, 10);
    const timePart = time && time.trim() ? time.trim() : '00:00';
    const withSeconds = timePart.length === 5 ? `${timePart}:00` : timePart;
    const parsed = new Date(`${datePart}T${withSeconds}`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeRawStatus(raw?: string): string {
    return (raw || '').trim().toLowerCase();
}

function isPrivileged(user: UserLike | null): boolean {
    if (!user) return false;
    return user.systemRole === 'super_admin' || user.role === 'admin' || user.role === 'organizer';
}

export function getCompetitionStatus(event: EventLike, now: Date = new Date()): CompetitionStatus {
    const raw = normalizeRawStatus(event.status);
    const start = parseEventStart(event.date, event.time);
    const nowMs = now.getTime();
    const startMs = start?.getTime();

    const isTimeLive = typeof startMs === 'number'
        ? nowMs >= startMs - LIVE_WINDOW_BEFORE_MS && nowMs <= startMs + LIVE_WINDOW_AFTER_MS
        : false;

    const isTimeCompleted = typeof startMs === 'number'
        ? nowMs > startMs + AUTO_COMPLETE_AFTER_MS
        : false;

    if (['completed', 'finished', 'closed', 'results', 'result'].includes(raw)) {
        return 'completed';
    }
    if (['draft', 'private', 'hidden'].includes(raw)) {
        return 'draft';
    }
    if (['live', 'active', 'ongoing', 'running'].includes(raw)) {
        return isTimeCompleted ? 'completed' : 'live';
    }
    if (['upcoming', 'scheduled', 'planned', 'registration_open', 'open', 'published'].includes(raw)) {
        if (isTimeCompleted) return 'completed';
        if (isTimeLive) return 'live';
        return 'upcoming';
    }

    if (isTimeCompleted) return 'completed';
    if (isTimeLive) return 'live';
    if (startMs && startMs > nowMs) return 'upcoming';
    return 'draft';
}

export function isEventVisibleToUser(event: EventLike, user: UserLike | null): boolean {
    const status = getCompetitionStatus(event);
    const visibility = (event.visibility || 'public').toLowerCase();

    if (isPrivileged(user)) {
        return true;
    }

    if (status === 'draft') {
        return user?.uid === event.createdBy;
    }

    if (visibility === 'public') {
        return true;
    }

    if (visibility === 'club') {
        return !!user?.clubId && !!event.clubId && user.clubId === event.clubId;
    }

    if (visibility === 'private') {
        return !!user?.uid && user.uid === event.createdBy;
    }

    return true;
}

export function getEventAccessProfile(
    event: EventLike,
    user: UserLike | null
): EventAccessProfile {
    const status = getCompetitionStatus(event);
    const canView = isEventVisibleToUser(event, user);
    const isLoggedIn = !!user?.uid;

    return {
        status,
        canView,
        canViewLive: canView && status === 'live',
        canViewReplay: canView && status === 'completed',
        canViewResults: canView && (status === 'live' || status === 'completed'),
        canRegister: canView && isLoggedIn && status === 'upcoming',
        registrationRequiresLogin: !isLoggedIn,
        canUseSocialFeatures: canView && isLoggedIn,
    };
}

