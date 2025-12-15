// Shared types and utilities for admin event tabs
import type { EventParticipantSettings } from '@/types/race';

export interface EventData {
    id: string;
    name: string;
    date: string;
    time: string;
    location?: string;
    type: string;
    classification: string;
    status: string;
    classes: EventClass[];
    entries: Entry[];
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
    siCard?: string;
    startTime?: string;
    status: 'registered' | 'started' | 'finished' | 'dns' | 'dnf';
}

export function saveEvent(event: EventData) {
    const stored = localStorage.getItem('events');
    const events = stored ? JSON.parse(stored) : [];
    const index = events.findIndex((e: EventData) => e.id === event.id);
    if (index >= 0) {
        events[index] = event;
    } else {
        events.push(event);
    }
    localStorage.setItem('events', JSON.stringify(events));
}

// Purple Pen XML parser
export function parsePurplePenData(xmlText: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const printAreaEl = doc.querySelector('print-area');
    const printArea = {
        left: parseFloat(printAreaEl?.getAttribute('left') || '0'),
        top: parseFloat(printAreaEl?.getAttribute('top') || '1000'),
        right: parseFloat(printAreaEl?.getAttribute('right') || '1000'),
        bottom: parseFloat(printAreaEl?.getAttribute('bottom') || '0'),
    };

    const mapWidth = printArea.right - printArea.left;
    const mapHeight = printArea.top - printArea.bottom;

    const controls: any[] = [];
    const controlEls = doc.querySelectorAll('control');
    controlEls.forEach((ctrl) => {
        const id = ctrl.getAttribute('id') || '';
        const kind = ctrl.getAttribute('kind') || 'normal';
        const code = ctrl.querySelector('code')?.textContent ||
            (kind === 'start' ? 'S' : kind === 'finish' ? 'M' : id);
        const locationEl = ctrl.querySelector('location');
        const x = parseFloat(locationEl?.getAttribute('x') || '0');
        const y = parseFloat(locationEl?.getAttribute('y') || '0');

        const relX = (x - printArea.left) / mapWidth;
        const relY = 1 - ((y - printArea.bottom) / mapHeight);

        controls.push({
            id, code,
            type: kind === 'start' ? 'start' : kind === 'finish' ? 'finish' : 'control',
            relX, relY,
        });
    });

    const courseControlMap = new Map<string, { controlId: string; next?: string }>();
    const ccEls = doc.querySelectorAll('course-control');
    ccEls.forEach((cc) => {
        const id = cc.getAttribute('id') || '';
        const controlId = cc.getAttribute('control') || '';
        const nextEl = cc.querySelector('next');
        const nextId = nextEl?.getAttribute('course-control') || undefined;
        courseControlMap.set(id, { controlId, next: nextId });
    });

    const parsedCourses: { id: string; name: string; controlIds: string[] }[] = [];
    const courseEls = doc.querySelectorAll('course');
    courseEls.forEach((course) => {
        const id = course.getAttribute('id') || '';
        const name = course.querySelector('name')?.textContent || `Course ${id}`;
        const firstEl = course.querySelector('first');
        const firstCcId = firstEl?.getAttribute('course-control');

        if (!firstCcId) return;

        const controlIds: string[] = [];
        let currentId: string | undefined = firstCcId;
        const visited = new Set<string>();

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const cc = courseControlMap.get(currentId);
            if (cc) {
                if (controls.some(c => c.id === cc.controlId)) {
                    controlIds.push(cc.controlId);
                }
                currentId = cc.next;
            } else {
                break;
            }
        }

        if (controlIds.length > 0) {
            parsedCourses.push({ id, name, controlIds });
        }
    });

    return { controls, courses: parsedCourses };
}
