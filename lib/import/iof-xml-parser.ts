'use client';

/**
 * IOF XML Parser Utilities
 * Parses IOF XML 3.0 format for courses, results, and entries
 * Supports forked courses with course pools (banpool)
 */

// ============ Course Pool Types ============

export interface CoursePool {
    id: string;
    className: string;              // Base class name (e.g., "Mellan")
    variants: CourseVariant[];      // All course variants in this pool
    forkPattern: string;            // e.g., "2x2" for AC/AD/BC/BD
}

export interface CourseVariant {
    id: string;
    fullName: string;               // "Mellan:Mellan AC"
    shortName: string;              // "Mellan AC"
    forkKey: string;                // "AC", "BD", etc.
    length: number;
    controls: ParsedControl[];
}

// ============ Core Types ============

export interface ParsedCourse {
    id: string;
    name: string;
    length: number; // meters
    climb?: number;
    controls: ParsedControl[];
    poolClassName?: string;         // NEW: If part of pool, which class (e.g., "Mellan")
    forkKey?: string;               // NEW: Fork key if pooled (e.g., "AC")
}

export interface ParsedControl {
    id: string;
    code: string;
    type: 'start' | 'control' | 'finish';
    order: number;
    lat?: number;
    lng?: number;
}

export interface ParsedClass {
    id: string;
    name: string;
    hasPool: boolean;               // NEW: True if this class has forked courses
    poolId?: string;                // NEW: Reference to course pool
    courseId?: string;              // Primary course ID (first variant if pooled)
    courseName?: string;            // Primary course name
    courseVariants?: string[];      // All variant names (for display)
    forkKeys?: string[];            // NEW: Fork keys available (e.g., ["AC", "AD", "BC", "BD"])
}

export interface ParsedResult {
    personId: string;
    firstName: string;
    lastName: string;
    club: string;
    clubId?: string;
    classId: string;
    className: string;
    courseName?: string;            // Specific course variant run
    forkKey?: string;               // NEW: Fork key for this result (e.g., "AD")
    siCard?: string;
    startTime?: string;
    finishTime?: string;
    time: number; // seconds
    status: 'OK' | 'MP' | 'DNF' | 'DNS' | 'DSQ';
    position?: number;
    splitTimes: { controlCode: string; time: number }[];
}

export interface ParsedEvent {
    id: string;
    name: string;
    date: string;
    organizer?: string;
    classes: ParsedClass[];
    courses: ParsedCourse[];
    coursePools: CoursePool[];      // NEW: Detected course pools
    results: ParsedResult[];
}


/**
 * Parse IOF XML 3.0 CourseData (from Purple Pen, OCAD)
 */
export function parseCourseDataXML(xmlString: string): { controls: ParsedControl[]; courses: ParsedCourse[] } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const controls: ParsedControl[] = [];
    const courses: ParsedCourse[] = [];

    // Parse controls
    const controlElements = doc.querySelectorAll('Control');
    controlElements.forEach((ctrl, index) => {
        const id = ctrl.querySelector('Id')?.textContent || `ctrl-${index}`;
        const type = ctrl.getAttribute('type')?.toLowerCase() || 'control';
        const position = ctrl.querySelector('Position');

        controls.push({
            id,
            code: id,
            type: type === 'start' ? 'start' : type === 'finish' ? 'finish' : 'control',
            order: index,
            lat: position ? parseFloat(position.getAttribute('lat') || '0') : undefined,
            lng: position ? parseFloat(position.getAttribute('lng') || '0') : undefined,
        });
    });

    // Parse courses
    const courseElements = doc.querySelectorAll('Course');
    courseElements.forEach((course, index) => {
        const name = course.querySelector('Name')?.textContent || `Course ${index + 1}`;
        const length = parseFloat(course.querySelector('Length')?.textContent || '0');
        const climb = parseFloat(course.querySelector('Climb')?.textContent || '0');

        const courseControls: ParsedControl[] = [];
        const controlCodes = course.querySelectorAll('CourseControl');
        controlCodes.forEach((cc, i) => {
            const controlCode = cc.querySelector('Control')?.textContent || '';
            const type = cc.getAttribute('type')?.toLowerCase();

            courseControls.push({
                id: `${name}-${i}`,
                code: controlCode,
                type: type === 'start' ? 'start' : type === 'finish' ? 'finish' : 'control',
                order: i,
            });
        });

        courses.push({
            id: `course-${index}`,
            name,
            length,
            climb,
            controls: courseControls.length > 0 ? courseControls : [],
        });
    });

    return { controls, courses };
}

/**
 * Parse IOF XML 3.0 ResultList
 */
export function parseResultListXML(xmlString: string): ParsedEvent {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Parse event info
    const eventEl = doc.querySelector('Event');
    const eventId = eventEl?.querySelector('Id')?.textContent || `event-${Date.now()}`;
    const eventName = eventEl?.querySelector('Name')?.textContent || 'Imported Event';
    const dateEl = eventEl?.querySelector('StartTime Date');
    const eventDate = dateEl?.textContent || new Date().toISOString().split('T')[0];

    const classes: ParsedClass[] = [];
    const courses: ParsedCourse[] = [];
    const results: ParsedResult[] = [];
    const coursePools: CoursePool[] = [];

    // Parse class results
    const classResults = doc.querySelectorAll('ClassResult');
    classResults.forEach((cr) => {
        const classEl = cr.querySelector('Class');
        const classId = classEl?.querySelector('Id')?.textContent || `class-${classes.length}`;
        const className = classEl?.querySelector('Name')?.textContent || 'Unknown Class';

        // Track courses and fork keys for this class
        const classCoursesSet = new Set<string>();
        const classForkKeys = new Set<string>();

        // Parse person results - get course info from each person's result
        const personResults = cr.querySelectorAll('PersonResult');
        personResults.forEach((pr) => {
            const person = pr.querySelector('Person');
            const personId = person?.querySelector('Id')?.textContent || `person-${results.length}`;
            const firstName = person?.querySelector('Given')?.textContent || '';
            const lastName = person?.querySelector('Family')?.textContent || '';

            const org = pr.querySelector('Organisation');
            const clubName = org?.querySelector('Name')?.textContent || '';
            const clubId = org?.querySelector('Id')?.textContent;

            const result = pr.querySelector('Result');

            // Course info is often inside Result for forked courses
            const courseEl = result?.querySelector('Course') || pr.querySelector('Course');
            const personCourseName = courseEl?.querySelector('Name')?.textContent || '';
            const courseLength = parseFloat(courseEl?.querySelector('Length')?.textContent || '0');

            // Extract pool info and fork key from course name
            const { poolClassName, forkKey } = parseCourseName(personCourseName);

            // Add course if not already seen
            if (personCourseName && !courses.find(c => c.name === personCourseName)) {
                courses.push({
                    id: `course-${courses.length}`,
                    name: personCourseName,
                    length: courseLength,
                    controls: [],
                    poolClassName,
                    forkKey,
                });
            }

            if (personCourseName) {
                classCoursesSet.add(personCourseName);
            }
            if (forkKey) {
                classForkKeys.add(forkKey);
            }

            const siCard = result?.querySelector('ControlCard')?.textContent;
            const startTime = result?.querySelector('StartTime')?.textContent;
            const finishTime = result?.querySelector('FinishTime')?.textContent;
            const time = parseInt(result?.querySelector('Time')?.textContent || '0');
            const position = parseInt(result?.querySelector('Position')?.textContent || '0');
            const statusEl = result?.querySelector('Status')?.textContent || 'OK';

            let status: ParsedResult['status'] = 'OK';
            if (statusEl === 'MissingPunch' || statusEl === 'MisPunch') status = 'MP';
            else if (statusEl === 'DidNotFinish') status = 'DNF';
            else if (statusEl === 'DidNotStart') status = 'DNS';
            else if (statusEl === 'Disqualified') status = 'DSQ';

            // Parse split times and extract control sequence
            const splitTimes: { controlCode: string; time: number }[] = [];
            const controlCodes: string[] = [];
            const splits = result?.querySelectorAll('SplitTime');
            splits?.forEach((split) => {
                const controlCode = split.querySelector('ControlCode')?.textContent || '';
                const splitTime = parseInt(split.querySelector('Time')?.textContent || '0');
                if (controlCode) {
                    splitTimes.push({ controlCode, time: splitTime });
                    if (!controlCodes.includes(controlCode)) {
                        controlCodes.push(controlCode);
                    }
                }
            });

            // Update course controls from first valid result's split times
            // (Only if course has no controls and this result has OK status)
            if (personCourseName && status === 'OK' && controlCodes.length > 0) {
                const course = courses.find(c => c.name === personCourseName);
                if (course && course.controls.length === 0) {
                    course.controls = controlCodes.map((code, index) => ({
                        id: `${course.id}-ctrl-${index}`,
                        code,
                        type: index === 0 ? 'start' as const :
                            index === controlCodes.length - 1 ? 'finish' as const : 'control' as const,
                        order: index + 1,
                    }));
                }
            }

            results.push({
                personId,
                firstName,
                lastName,
                club: clubName,
                clubId: clubId ?? undefined,
                classId,
                className,
                courseName: personCourseName,
                forkKey, // NEW: Store fork key for this result
                siCard: siCard ?? undefined,
                startTime: startTime ?? undefined,
                finishTime: finishTime ?? undefined,
                time,
                status,
                position: position || undefined,
                splitTimes,
            });
        });

        // Determine if this class uses a course pool
        const courseVariantsArray = Array.from(classCoursesSet);
        const forkKeysArray = Array.from(classForkKeys);
        const hasPool = courseVariantsArray.length > 1;
        const primaryCourse = courseVariantsArray[0] || className;

        // Create course pool if multiple variants exist
        if (hasPool) {
            const poolId = `pool-${className}`;
            if (!coursePools.find(p => p.className === className)) {
                coursePools.push({
                    id: poolId,
                    className,
                    variants: courseVariantsArray.map(name => {
                        const course = courses.find(c => c.name === name);
                        return {
                            id: course?.id || '',
                            fullName: name,
                            shortName: name.includes(':') ? name.split(':')[1] : name,
                            forkKey: course?.forkKey || '',
                            length: course?.length || 0,
                            controls: course?.controls || [],
                        };
                    }),
                    forkPattern: detectForkPattern(forkKeysArray),
                });
            }
        }

        classes.push({
            id: classId,
            name: className,
            hasPool,
            poolId: hasPool ? `pool-${className}` : undefined,
            courseId: courses.find(c => c.name === primaryCourse)?.id,
            courseName: primaryCourse,
            courseVariants: courseVariantsArray,
            forkKeys: forkKeysArray.length > 0 ? forkKeysArray : undefined,
        });
    });

    return {
        id: eventId,
        name: eventName,
        date: eventDate,
        classes,
        courses,
        coursePools,
        results,
    };
}

/**
 * Parse a course name to extract pool class name and fork key
 * Examples:
 *   "Korta" -> { poolClassName: undefined, forkKey: undefined }
 *   "Mellan:Mellan AC" -> { poolClassName: "Mellan", forkKey: "AC" }
 *   "Långa:Långa BD" -> { poolClassName: "Lång", forkKey: "BD" }
 */
function parseCourseName(courseName: string): { poolClassName?: string; forkKey?: string } {
    if (!courseName) return {};

    // Check for pool format: "ClassName:VariantName"
    if (courseName.includes(':')) {
        const [poolClassName, variantName] = courseName.split(':');
        const forkKey = extractForkKey(variantName);
        return { poolClassName: poolClassName.trim(), forkKey };
    }

    return {};
}

/**
 * Extract fork key from variant name
 * Examples:
 *   "Mellan AC" -> "AC"
 *   "Långa BD" -> "BD"
 *   "Course 1" -> undefined
 */
function extractForkKey(variantName: string): string | undefined {
    if (!variantName) return undefined;

    const parts = variantName.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1];

    // Fork keys are typically 1-4 uppercase letters (A, AB, AC, BD, ABCD, etc.)
    if (/^[A-Z]{1,4}$/.test(lastPart)) {
        return lastPart;
    }

    return undefined;
}

/**
 * Detect the fork pattern from a list of fork keys
 * Examples:
 *   ["AC", "AD", "BC", "BD"] -> "2x2"
 *   ["A", "B"] -> "2"
 *   ["A", "B", "C"] -> "3"
 */
function detectForkPattern(forkKeys: string[]): string {
    if (forkKeys.length === 0) return '';

    // Check for 2x2 pattern (AC, AD, BC, BD)
    const sorted = [...forkKeys].sort();
    if (sorted.length === 4 &&
        sorted.includes('AC') && sorted.includes('AD') &&
        sorted.includes('BC') && sorted.includes('BD')) {
        return '2x2';
    }

    // Check for 2x2x2 pattern (8 variants)
    if (sorted.length === 8) return '2x2x2';

    // Simple count
    return forkKeys.length.toString();
}


/**
 * Convert parsed event to app format and save to localStorage
 */
export function importParsedEventToLocalStorage(event: ParsedEvent): string {
    const eventId = `event-${Date.now()}`;

    // Convert to app format
    const appEvent = {
        id: eventId,
        name: event.name,
        date: event.date,
        time: '17:30',
        location: 'Älvsjö',
        organizer: 'OK Älvsjö-Örby',
        classification: 'Local',
        description: 'Importerad tävling',
        status: 'completed',
        // Classes
        classes: event.classes.map(c => ({
            id: c.id,
            name: c.name,
            courseId: c.courseId,
            courseName: c.courseName,
            entryCount: event.results.filter(r => r.classId === c.id).length,
        })),
        // Courses
        courses: event.courses.map(c => ({
            id: c.id,
            eventId,
            name: c.name,
            length: c.length,
            climb: c.climb || 0,
            controls: c.controls.map(ctrl => ({
                id: ctrl.id,
                code: ctrl.code,
                type: ctrl.type,
                order: ctrl.order,
                lat: ctrl.lat,
                lng: ctrl.lng,
            })),
            classIds: event.classes.filter(cls => cls.courseId === c.id).map(cls => cls.id),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })),
        // Entries (from results)
        entries: event.results.map(r => ({
            id: r.personId,
            name: `${r.firstName} ${r.lastName}`,
            firstName: r.firstName,
            lastName: r.lastName,
            club: r.club,
            clubId: r.clubId,
            classId: r.classId,
            siCard: r.siCard,
            startTime: r.startTime,
            finishTime: r.finishTime,
            time: r.time,
            status: r.status === 'OK' ? 'finished' : r.status === 'DNS' ? 'dns' : r.status === 'DNF' ? 'dnf' : 'finished',
            position: r.position,
            splitTimes: r.splitTimes,
        })),
        // Media
        images: [],
        attachments: [],
        googleMapsUrl: '',
        // Settings
        registrationSettings: {
            deadline: '',
            lateDeadline: '',
            allowLateRegistration: false,
            lateRegistrationFee: 0,
            allowDirectRegistration: false,
            directRegistrationClasses: [],
            directRegistrationAllClasses: true,
        },
        gpsMode: { enabled: false, sensitivity: 'standard' },
        spectatorMode: {
            showOLMapToSpectators: true,
            showCourseToSpectators: true,
            courseVisibleAfterFinish: true,
        },
        createdAt: new Date().toISOString(),
        createdBy: 'import',
    };

    // Save to localStorage
    const storedEvents = localStorage.getItem('events');
    const events = storedEvents ? JSON.parse(storedEvents) : [];
    events.push(appEvent);
    localStorage.setItem('events', JSON.stringify(events));

    return eventId;
}

/**
 * Parse Purple Pen (.ppen) XML file
 * Extracts controls with map-relative positions (0-1 range)
 */
export interface PurplePenControl {
    id: string;
    code: string;
    kind: 'start' | 'normal' | 'finish';
    x: number;  // Map coordinate
    y: number;  // Map coordinate
    relX?: number;  // Relative position 0-1
    relY?: number;  // Relative position 0-1
}

export interface PurplePenCourse {
    id: string;
    name: string;
    controls: string[];  // Control IDs in order
}

export interface PurplePenData {
    title: string;
    scale: number;
    printArea: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    controls: PurplePenControl[];
    courses: PurplePenCourse[];
}

export function parsePurplePenXML(xmlString: string): PurplePenData | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        // Get event info
        const eventEl = doc.querySelector('event');
        const title = eventEl?.querySelector('title')?.textContent || 'Unnamed';
        const mapEl = eventEl?.querySelector('map');
        const scale = parseFloat(mapEl?.getAttribute('scale') || '10000');

        // Get print area (map bounds in map units)
        const printAreaEl = doc.querySelector('print-area');
        const printArea = {
            left: parseFloat(printAreaEl?.getAttribute('left') || '0'),
            top: parseFloat(printAreaEl?.getAttribute('top') || '0'),
            right: parseFloat(printAreaEl?.getAttribute('right') || '1000'),
            bottom: parseFloat(printAreaEl?.getAttribute('bottom') || '0'),
        };

        const mapWidth = printArea.right - printArea.left;
        const mapHeight = printArea.top - printArea.bottom;

        // Parse controls
        const controls: PurplePenControl[] = [];
        const controlEls = doc.querySelectorAll('control');
        controlEls.forEach((ctrl) => {
            const id = ctrl.getAttribute('id') || '';
            const kind = ctrl.getAttribute('kind') as 'start' | 'normal' | 'finish' || 'normal';
            const code = ctrl.querySelector('code')?.textContent || (kind === 'start' ? 'S' : kind === 'finish' ? 'F' : id);
            const locationEl = ctrl.querySelector('location');
            const x = parseFloat(locationEl?.getAttribute('x') || '0');
            const y = parseFloat(locationEl?.getAttribute('y') || '0');

            // Calculate relative position (0-1 range)
            const relX = (x - printArea.left) / mapWidth;
            const relY = 1 - ((y - printArea.bottom) / mapHeight); // Invert Y for screen coords

            controls.push({
                id,
                code,
                kind,
                x,
                y,
                relX,
                relY,
            });
        });

        // Parse course-controls (these are at root level, not inside courses)
        const courseControlMap = new Map<string, { control: string; next?: string }>();
        const courseControlEls = doc.querySelectorAll('course-control');
        courseControlEls.forEach((cc) => {
            const id = cc.getAttribute('id') || '';
            const controlId = cc.getAttribute('control') || '';
            const nextEl = cc.querySelector('next');
            const nextId = nextEl?.getAttribute('course-control') ?? undefined;
            courseControlMap.set(id, { control: controlId, next: nextId });
        });

        // Parse courses by following the linked list from "first"
        const courses: PurplePenCourse[] = [];
        const courseEls = doc.querySelectorAll('course');
        courseEls.forEach((course) => {
            const id = course.getAttribute('id') || '';
            const name = course.querySelector('name')?.textContent || `Course ${id}`;
            const firstEl = course.querySelector('first');
            const firstCourseControlId = firstEl?.getAttribute('course-control');

            if (!firstCourseControlId) return;

            // Traverse the linked list
            const controlIds: string[] = [];
            let currentId: string | undefined = firstCourseControlId;
            const visited = new Set<string>(); // Prevent infinite loops

            while (currentId && !visited.has(currentId)) {
                visited.add(currentId);
                const cc = courseControlMap.get(currentId);
                if (cc) {
                    controlIds.push(cc.control);
                    currentId = cc.next;
                } else {
                    break;
                }
            }

            if (controlIds.length > 0) {
                courses.push({
                    id,
                    name,
                    controls: controlIds,
                });
            }
        });

        console.log('Parsed Purple Pen courses:', courses.map(c => `${c.name}: ${c.controls.length} controls`));

        return {
            title,
            scale,
            printArea,
            controls,
            courses,
        };
    } catch (error) {
        console.error('Failed to parse Purple Pen XML:', error);
        return null;
    }
}

/**
 * Merge Purple Pen data into parsed event
 * Adds control positions to existing courses
 */
export function mergePurplePenData(event: ParsedEvent, ppenData: PurplePenData): ParsedEvent {
    // Create a map of control codes to relative positions
    const controlPositions = new Map<string, { relX: number; relY: number }>();
    ppenData.controls.forEach(ctrl => {
        if (ctrl.relX !== undefined && ctrl.relY !== undefined) {
            controlPositions.set(ctrl.code, { relX: ctrl.relX, relY: ctrl.relY });
        }
    });

    // Update courses with control positions
    const updatedCourses = event.courses.map(course => {
        const updatedControls = course.controls.map(ctrl => {
            const pos = controlPositions.get(ctrl.code);
            if (pos) {
                return {
                    ...ctrl,
                    relX: pos.relX,
                    relY: pos.relY,
                };
            }
            return ctrl;
        });

        return {
            ...course,
            controls: updatedControls,
        };
    });

    return {
        ...event,
        courses: updatedCourses,
    };
}

