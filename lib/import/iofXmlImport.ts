// Import utilities for IOF XML 3.0 results and course data
// Supports MeOS exports, Purple Pen exports, and standard IOF ResultList

export interface ImportedEvent {
    id: string;
    name: string;
    date: string;
    time: string;
    location?: string;
    organizer?: string;
    status: 'completed';
    type: 'individual';
    classification: 'club';
    classes: ImportedClass[];
    entries: ImportedEntry[];
    results: ImportedResult[];
    courses: ImportedCourse[];
    controls: ImportedControl[];
    map?: {
        imageUrl: string;
        name: string;
        worldFile?: WorldFile;
    };
}

export interface ImportedClass {
    id: string;
    name: string;
    courseId?: string;
    courseName?: string;
    entryCount: number;
}

export interface ImportedEntry {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    club: string;
    clubId?: string;
    classId: string;
    className: string;
    siCard?: string;
    birthYear?: number;
    status: 'registered' | 'started' | 'finished' | 'dns' | 'dnf' | 'mp';
}

export interface ImportedResult {
    entryId: string;
    personId: string;
    name: string;
    club: string;
    className: string;
    classId: string;
    time: number; // seconds
    timeBehind: number;
    position: number;
    status: 'OK' | 'MP' | 'DNF' | 'DNS' | 'DSQ' | 'OT';
    startTime?: string;
    finishTime?: string;
    splits: { controlCode: string; time: number }[];
    siCard?: string;
}

export interface ImportedCourse {
    id: string;
    name: string;
    length?: number; // meters
    climb?: number;
    controls: string[]; // control codes in order
}

export interface ImportedControl {
    id: string;
    code: string;
    type: 'start' | 'control' | 'finish';
    lat?: number;
    lng?: number;
    mapX?: number;
    mapY?: number;
}

export interface WorldFile {
    pixelSizeX: number;
    rotationY: number;
    rotationX: number;
    pixelSizeY: number;
    originX: number; // SWEREF99 TM X
    originY: number; // SWEREF99 TM Y
}

// Parse IOF XML 3.0 ResultList
export function parseIOFResultList(xmlText: string): Partial<ImportedEvent> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const event: Partial<ImportedEvent> = {
        classes: [],
        entries: [],
        results: [],
    };

    // Event info
    const eventEl = doc.querySelector('Event');
    if (eventEl) {
        event.id = eventEl.querySelector('Id')?.textContent || `event-${Date.now()}`;
        event.name = eventEl.querySelector('Name')?.textContent || 'Importerad tävling';
        const dateEl = eventEl.querySelector('StartTime Date');
        if (dateEl) event.date = dateEl.textContent || '';
        const timeEl = eventEl.querySelector('StartTime Time');
        if (timeEl) event.time = timeEl.textContent?.substring(0, 5) || '10:00';
    }

    // Parse ClassResults
    const classResults = doc.querySelectorAll('ClassResult');
    classResults.forEach((classResult) => {
        const classEl = classResult.querySelector('Class');
        const classId = classEl?.querySelector('Id')?.textContent || `class-${Math.random().toString(36).substring(7)}`;
        const className = classEl?.querySelector('Name')?.textContent || 'Okänd klass';

        // Course info
        const courseEl = classResult.querySelector('Course');
        const courseName = courseEl?.querySelector('Name')?.textContent;
        const courseLength = parseInt(courseEl?.querySelector('Length')?.textContent || '0');

        // Add class if not exists
        if (!event.classes!.find(c => c.id === classId)) {
            event.classes!.push({
                id: classId,
                name: className,
                courseId: courseName || undefined,
                courseName: courseName || undefined,
                entryCount: 0,
            });
        }

        // Parse PersonResults
        const personResults = classResult.querySelectorAll('PersonResult');
        personResults.forEach((pr) => {
            const personEl = pr.querySelector('Person');
            const personId = personEl?.querySelector('Id')?.textContent || `person-${Math.random().toString(36).substring(7)}`;
            const firstName = personEl?.querySelector('Name Given')?.textContent || '';
            const lastName = personEl?.querySelector('Name Family')?.textContent || '';
            const fullName = `${firstName} ${lastName}`.trim();

            const orgEl = pr.querySelector('Organisation');
            const clubName = orgEl?.querySelector('Name')?.textContent || '';
            const clubId = orgEl?.querySelector('Id')?.textContent;

            const resultEl = pr.querySelector('Result');
            const status = resultEl?.querySelector('Status')?.textContent as any || 'OK';
            const time = parseInt(resultEl?.querySelector('Time')?.textContent || '0');
            const timeBehind = parseInt(resultEl?.querySelector('TimeBehind')?.textContent || '0');
            const position = parseInt(resultEl?.querySelector('Position')?.textContent || '0');
            const startTime = resultEl?.querySelector('StartTime')?.textContent;
            const finishTime = resultEl?.querySelector('FinishTime')?.textContent;
            const siCard = resultEl?.querySelector('ControlCard')?.textContent;

            // Parse splits
            const splits: { controlCode: string; time: number }[] = [];
            const splitTimes = resultEl?.querySelectorAll('SplitTime');
            splitTimes?.forEach((st) => {
                const controlCode = st.querySelector('ControlCode')?.textContent || '';
                const splitTime = parseInt(st.querySelector('Time')?.textContent || '0');
                if (controlCode) {
                    splits.push({ controlCode, time: splitTime });
                }
            });

            // Add entry
            const entryId = `entry-${personId}`;
            event.entries!.push({
                id: entryId,
                name: fullName,
                firstName,
                lastName,
                club: clubName,
                clubId: clubId || undefined,
                classId,
                className,
                siCard: siCard || undefined,
                status: status === 'OK' ? 'finished' : status === 'DNS' ? 'dns' : status === 'DNF' ? 'dnf' : 'finished',
            });

            // Add result
            event.results!.push({
                entryId,
                personId,
                name: fullName,
                club: clubName,
                className,
                classId,
                time,
                timeBehind,
                position,
                status,
                startTime: startTime || undefined,
                finishTime: finishTime || undefined,
                splits,
                siCard: siCard || undefined,
            });

            // Update entry count
            const cls = event.classes!.find(c => c.id === classId);
            if (cls) cls.entryCount++;
        });
    });

    return event;
}

// Parse IOF XML 3.0 CourseData (from Purple Pen)
export function parseIOFCourseData(xmlText: string): { courses: ImportedCourse[]; controls: ImportedControl[] } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const controls: ImportedControl[] = [];
    const courses: ImportedCourse[] = [];

    // Parse controls
    const controlEls = doc.querySelectorAll('RaceCourseData > Control');
    controlEls.forEach((ctrl) => {
        const id = ctrl.querySelector('Id')?.textContent || '';
        const type = ctrl.getAttribute('type')?.toLowerCase() as any || 'control';
        const posEl = ctrl.querySelector('Position');
        const lat = parseFloat(posEl?.getAttribute('lat') || '0');
        const lng = parseFloat(posEl?.getAttribute('lng') || '0');
        const mapPosEl = ctrl.querySelector('MapPosition');
        const mapX = parseFloat(mapPosEl?.getAttribute('x') || '0');
        const mapY = parseFloat(mapPosEl?.getAttribute('y') || '0');

        controls.push({
            id,
            code: id,
            type: type === 'start' ? 'start' : type === 'finish' ? 'finish' : 'control',
            lat,
            lng,
            mapX,
            mapY,
        });
    });

    // Parse courses
    const courseEls = doc.querySelectorAll('RaceCourseData > Course');
    courseEls.forEach((course) => {
        const id = course.querySelector('Id')?.textContent || `course-${Math.random().toString(36).substring(7)}`;
        const name = course.querySelector('Name')?.textContent || 'Okänd bana';
        const length = parseInt(course.querySelector('Length')?.textContent || '0');
        const climb = parseInt(course.querySelector('Climb')?.textContent || '0');

        // Get control references
        const controlRefs: string[] = [];
        const ccEls = course.querySelectorAll('CourseControl');
        ccEls.forEach((cc) => {
            const controlId = cc.querySelector('Control')?.textContent;
            if (controlId) controlRefs.push(controlId);
        });

        courses.push({
            id,
            name,
            length,
            climb,
            controls: controlRefs,
        });
    });

    return { courses, controls };
}

// Parse World File (.pgw, .jgw, .tfw)
export function parseWorldFile(content: string): WorldFile {
    const lines = content.trim().split('\n').map(l => parseFloat(l.trim()));
    return {
        pixelSizeX: lines[0] || 0,
        rotationY: lines[1] || 0,
        rotationX: lines[2] || 0,
        pixelSizeY: lines[3] || 0,
        originX: lines[4] || 0,
        originY: lines[5] || 0,
    };
}

// Convert SWEREF99 TM to WGS84
export function sweref99ToWgs84(x: number, y: number): { lat: number; lng: number } {
    // Simplified conversion - for accurate results use proj4
    // SWEREF99 TM: EPSG:3006
    // These formulas are approximations for Stockholm area
    const lat = 59.33 + (y - 6580000) / 111320;
    const lng = 18.07 + (x - 674500) / (111320 * Math.cos(59.33 * Math.PI / 180));
    return { lat, lng };
}

// Format time in seconds to MM:SS or H:MM:SS
export function formatTime(seconds: number): string {
    if (seconds <= 0) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format time difference with + prefix
export function formatTimeDiff(seconds: number): string {
    if (seconds <= 0) return '';
    return `+${formatTime(seconds)}`;
}
