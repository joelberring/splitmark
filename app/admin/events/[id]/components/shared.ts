// Shared types and utilities for admin event tabs
import type { EventParticipantSettings } from '@/types/race';
import type {
    EventPlanningControl,
    EventPlanningCourse,
} from '@/lib/events/course-planning';
import {
    parseCoursePlanningDataFromXml,
    type ParsedCoursePlanningData,
} from '@/lib/import/course-planning-parser';

export interface EventData {
    id: string;
    name: string;
    date: string;
    time: string;
    location?: string;
    type: string;
    classification: string;
    status: 'draft' | 'active' | 'completed';
    clubId?: string;
    createdBy?: string;
    eventAdminIds?: string[];
    classes: EventClass[];
    entries: Entry[];
    courses?: any[];
    ppenControls?: EventPlanningControl[];
    ppenCourses?: EventPlanningCourse[];
    map?: {
        imageUrl: string;
        name?: string;
        visibility?: {
            mode?: 'always' | 'scheduled' | 'hidden';
            releaseAt?: string;
            hideAt?: string;
            fallbackBaseMap?: 'none' | 'osm';
        };
        optimization?: {
            originalBytes?: number;
            processedBytes?: number;
            compressionRatio?: number;
            originalWidth?: number;
            originalHeight?: number;
            width?: number;
            height?: number;
            cropApplied?: boolean;
            cropRect?: { left: number; top: number; right: number; bottom: number };
            format?: string;
            quality?: number;
            preset?: 'balanced' | 'mobile' | 'highDetail' | 'custom';
            updatedAt?: string;
        };
    };
}

export interface EventClass {
    id: string;
    name: string;
    courseId?: string;
    courseName?: string;
    courseVariants?: string[];
    entryCount: number;
}

export interface Entry {
    id: string;
    name: string;
    club: string;
    classId: string;
    className?: string;
    siCard?: string;
    startTime?: string;
    finishTime?: string;
    resultTime?: string;
    status: 'registered' | 'confirmed' | 'started' | 'finished' | 'dns' | 'dnf' | 'dsq' | 'cancelled';
    resultStatus?: 'ok' | 'mp' | 'dnf' | 'dsq' | 'dns' | 'ot';
    punches?: { code: string; time: string }[];
    createdAt?: string;
    updatedAt?: string;
}

export function saveEvent(event: EventData) {
    // Import dynamically to avoid SSR issues
    import('@/lib/firestore/events').then(({ saveEvent: firestoreSave }) => {
        firestoreSave(event as any).catch(console.error);
    }).catch(() => {
        // Fallback to localStorage
        const stored = localStorage.getItem('events');
        const events = stored ? JSON.parse(stored) : [];
        const index = events.findIndex((e: EventData) => e.id === event.id);
        if (index >= 0) {
            events[index] = event;
        } else {
            events.push(event);
        }
        localStorage.setItem('events', JSON.stringify(events));
    });
}
export function calculateResultTime(start: string, finish: string): string {
    const [sH, sM] = start.split(':').map(Number);
    const [fH, fM] = finish.split(':').map(Number);

    let totalSeconds = ((fH * 3600) + (fM * 60)) - ((sH * 3600) + (sM * 60));
    if (totalSeconds < 0) totalSeconds += 24 * 3600; // Handle midnight wrap

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function checkMP(courseControls: string[], punches: { code: string }[]): boolean {
    if (!courseControls || courseControls.length === 0) return false;

    let courseIdx = 0;
    // Basic orienteering rule: controls must be visited in order.
    // However, some systems are more lenient. 
    // Here we check if all required codes were visited in the correct sequence.
    for (const punch of punches) {
        if (punch.code === courseControls[courseIdx]) {
            courseIdx++;
        }
        if (courseIdx === courseControls.length) return false; // All found!
    }

    return courseIdx < courseControls.length; // True if some controls were missed
}

// Purple Pen XML parser
export function parsePurplePenData(xmlText: string) {
    const parsed = parseCoursePlanningDataFromXml(xmlText);
    return {
        controls: parsed.controls,
        courses: parsed.courses,
    };
}

export function parseCourseFileData(xmlText: string): ParsedCoursePlanningData {
    return parseCoursePlanningDataFromXml(xmlText);
}
