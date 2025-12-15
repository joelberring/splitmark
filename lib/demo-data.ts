/**
 * Demo Data Seeder - Seeds localStorage with complete test events
 * This allows testing of registration, course assignment, timing, etc.
 */

export interface DemoEvent {
    id: string;
    name: string;
    date: string;
    time: string;
    location: string;
    type: 'individual' | 'relay' | 'rogaining';
    classification: string;
    status: string;
    description?: string;
    resultsUrl?: string; // Link to detailed results viewer
    classes: DemoClass[];
    courses: DemoCourse[];
    entries: DemoEntry[];
}

interface DemoClass {
    id: string;
    name: string;
    courseId?: string;
    courseName?: string;
    entryCount: number;
}

interface DemoCourse {
    id: string;
    name: string;
    length: number; // meters
    climb?: number;
    controls: number;
}

interface DemoEntry {
    id: string;
    firstName: string;
    lastName: string;
    clubName: string;
    classId: string;
    className: string;
    siCard?: string;
    status: 'registered' | 'started' | 'finished' | 'dns' | 'dnf';
    startTime?: string;
    finishTime?: string;
    result?: number; // seconds
    entryType?: 'normal' | 'late';
}

// Demo events with full data for testing
export const DEMO_EVENTS: DemoEvent[] = [
    {
        id: 'demo-event-1',
        name: 'Vårsprånget 2025',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
        time: '10:00',
        location: 'Lunsen, Uppsala',
        type: 'individual',
        classification: 'regional',
        status: 'upcoming',
        description: 'Årets första stora tävling i Uppsala. Teknisk terräng med fina stenhällar.',
        classes: [
            { id: 'h21', name: 'H21', courseId: 'course-lang', courseName: 'Lång', entryCount: 24 },
            { id: 'd21', name: 'D21', courseId: 'course-lang', courseName: 'Lång', entryCount: 18 },
            { id: 'h35', name: 'H35', courseId: 'course-medel', courseName: 'Medel', entryCount: 12 },
            { id: 'd35', name: 'D35', courseId: 'course-medel', courseName: 'Medel', entryCount: 8 },
            { id: 'h50', name: 'H50', courseId: 'course-kort', courseName: 'Kort', entryCount: 15 },
            { id: 'd50', name: 'D50', courseId: 'course-kort', courseName: 'Kort', entryCount: 10 },
            { id: 'oppen-medel', name: 'Öppen Medel', courseId: 'course-medel', courseName: 'Medel', entryCount: 22 },
            { id: 'oppen-kort', name: 'Öppen Kort', courseId: 'course-kort', courseName: 'Kort', entryCount: 35 },
            { id: 'inskolning', name: 'Inskolning', courseId: 'course-inskolning', courseName: 'Inskolning', entryCount: 18 },
        ],
        courses: [
            { id: 'course-lang', name: 'Lång', length: 8200, climb: 180, controls: 18 },
            { id: 'course-medel', name: 'Medel', length: 5400, climb: 120, controls: 14 },
            { id: 'course-kort', name: 'Kort', length: 3200, climb: 70, controls: 10 },
            { id: 'course-inskolning', name: 'Inskolning', length: 1800, climb: 30, controls: 6 },
        ],
        entries: [
            { id: 'e1', firstName: 'Anna', lastName: 'Svensson', clubName: 'OK Linné', classId: 'd21', className: 'D21', siCard: '7234567', status: 'registered' },
            { id: 'e2', firstName: 'Erik', lastName: 'Johansson', clubName: 'IFK Lidingö', classId: 'h21', className: 'H21', siCard: '8345678', status: 'registered' },
            { id: 'e3', firstName: 'Maria', lastName: 'Månsson', clubName: 'Järla Orientering', classId: 'd35', className: 'D35', siCard: '9456789', status: 'registered' },
            { id: 'e4', firstName: 'Johan', lastName: 'Karlsson', clubName: 'OK Linné', classId: 'h35', className: 'H35', siCard: '1567890', status: 'registered' },
            { id: 'e5', firstName: 'Lisa', lastName: 'Larsson', clubName: 'Snättringe SK', classId: 'd21', className: 'D21', siCard: '2678901', status: 'registered' },
            { id: 'e6', firstName: 'Anders', lastName: 'Andersson', clubName: 'OK Gynge', classId: 'h50', className: 'H50', siCard: '3789012', status: 'registered' },
            { id: 'e7', firstName: 'Karin', lastName: 'Berg', clubName: 'OK Ravinen', classId: 'd50', className: 'D50', siCard: '4890123', status: 'registered' },
            { id: 'e8', firstName: 'Olle', lastName: 'Persson', clubName: 'IK Jarl', classId: 'oppen-medel', className: 'Öppen Medel', siCard: '5901234', status: 'registered' },
        ],
    },
    {
        id: 'demo-event-2',
        name: 'Stockholm Sprint Cup',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
        time: '18:00',
        location: 'Hammarby Sjöstad, Stockholm',
        type: 'individual',
        classification: 'local',
        status: 'upcoming',
        description: 'Kvällssprint i urban terräng. Snabba vägval och stadsplanering.',
        classes: [
            { id: 'h21', name: 'H21', courseId: 'sprint-elite', courseName: 'Sprint Elite', entryCount: 32 },
            { id: 'd21', name: 'D21', courseId: 'sprint-elite', courseName: 'Sprint Elite', entryCount: 28 },
            { id: 'oppen', name: 'Öppen', courseId: 'sprint-open', courseName: 'Sprint Open', entryCount: 45 },
        ],
        courses: [
            { id: 'sprint-elite', name: 'Sprint Elite', length: 3200, controls: 22 },
            { id: 'sprint-open', name: 'Sprint Open', length: 2100, controls: 15 },
        ],
        entries: [
            { id: 's1', firstName: 'Max', lastName: 'Nilsson', clubName: 'Djurgårdens IF', classId: 'h21', className: 'H21', siCard: '6012345', status: 'registered' },
            { id: 's2', firstName: 'Emma', lastName: 'Lindqvist', clubName: 'Nacka OK', classId: 'd21', className: 'D21', siCard: '7123456', status: 'registered' },
            { id: 's3', firstName: 'Oscar', lastName: 'Ström', clubName: 'Sollentuna OK', classId: 'h21', className: 'H21', siCard: '8234567', status: 'registered' },
        ],
    },
    {
        id: 'demo-event-3',
        name: 'Nattorientering Tyresta',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        time: '20:00',
        location: 'Tyresta nationalpark',
        type: 'individual',
        classification: 'club',
        status: 'upcoming',
        description: 'Äventyrlig nattorientering i vildmarken. Pannlampa krävs!',
        classes: [
            { id: 'natt-svår', name: 'Natt Svår', courseId: 'natt-lang', courseName: 'Natt Lång', entryCount: 15 },
            { id: 'natt-lätt', name: 'Natt Lätt', courseId: 'natt-kort', courseName: 'Natt Kort', entryCount: 22 },
        ],
        courses: [
            { id: 'natt-lang', name: 'Natt Lång', length: 6100, climb: 150, controls: 12 },
            { id: 'natt-kort', name: 'Natt Kort', length: 3500, climb: 80, controls: 8 },
        ],
        entries: [
            { id: 'n1', firstName: 'Viktor', lastName: 'Ekström', clubName: 'Järla Orientering', classId: 'natt-svår', className: 'Natt Svår', siCard: '9345678', status: 'registered' },
            { id: 'n2', firstName: 'Sara', lastName: 'Hedlund', clubName: 'OK Kansen', classId: 'natt-lätt', className: 'Natt Lätt', siCard: '1456789', status: 'registered' },
        ],
    },
    // COMPLETED EVENTS (Past events with results)
    {
        id: 'demo-past-1',
        name: 'Höstklassikern 2024',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks ago
        time: '10:00',
        location: 'Nackareservatet, Stockholm',
        type: 'individual',
        classification: 'regional',
        status: 'completed',
        description: 'Klassisk medeldistans i vacker höstterräng.',
        classes: [
            { id: 'h21', name: 'H21', courseId: 'medel-a', courseName: 'Medel A', entryCount: 28 },
            { id: 'd21', name: 'D21', courseId: 'medel-a', courseName: 'Medel A', entryCount: 22 },
            { id: 'h40', name: 'H40', courseId: 'medel-b', courseName: 'Medel B', entryCount: 18 },
            { id: 'd40', name: 'D40', courseId: 'medel-b', courseName: 'Medel B', entryCount: 14 },
            { id: 'oppen', name: 'Öppen', courseId: 'kort', courseName: 'Kort', entryCount: 35 },
        ],
        courses: [
            { id: 'medel-a', name: 'Medel A', length: 6800, climb: 150, controls: 15 },
            { id: 'medel-b', name: 'Medel B', length: 4500, climb: 100, controls: 12 },
            { id: 'kort', name: 'Kort', length: 2800, climb: 60, controls: 8 },
        ],
        entries: [
            { id: 'p1', firstName: 'Gustav', lastName: 'Lindgren', clubName: 'IFK Lidingö', classId: 'h21', className: 'H21', siCard: '1111111', status: 'finished', result: 2845, startTime: '10:00', finishTime: '10:47:25' },
            { id: 'p2', firstName: 'Erik', lastName: 'Johansson', clubName: 'OK Linné', classId: 'h21', className: 'H21', siCard: '2222222', status: 'finished', result: 2923, startTime: '10:03', finishTime: '10:51:43' },
            { id: 'p3', firstName: 'Oskar', lastName: 'Holm', clubName: 'Järla Orientering', classId: 'h21', className: 'H21', siCard: '3333333', status: 'finished', result: 3012, startTime: '10:06', finishTime: '10:56:18' },
            { id: 'p4', firstName: 'Anna', lastName: 'Svensson', clubName: 'OK Linné', classId: 'd21', className: 'D21', siCard: '4444444', status: 'finished', result: 3156, startTime: '10:30', finishTime: '11:22:36' },
            { id: 'p5', firstName: 'Emma', lastName: 'Lindqvist', clubName: 'Nacka OK', classId: 'd21', className: 'D21', siCard: '5555555', status: 'finished', result: 3287, startTime: '10:33', finishTime: '11:28:20' },
            { id: 'p6', firstName: 'Sara', lastName: 'Berg', clubName: 'Djurgårdens IF', classId: 'd21', className: 'D21', siCard: '6666666', status: 'finished', result: 3445, startTime: '10:36', finishTime: '11:33:41' },
            { id: 'p7', firstName: 'Johan', lastName: 'Karlsson', clubName: 'OK Gynge', classId: 'h40', className: 'H40', siCard: '7777777', status: 'finished', result: 2534, startTime: '11:00', finishTime: '11:42:14' },
            { id: 'p8', firstName: 'Anders', lastName: 'Nilsson', clubName: 'Snättringe SK', classId: 'h40', className: 'H40', siCard: '8888888', status: 'dnf', startTime: '11:03' },
        ],
    },
    {
        id: 'demo-past-2',
        name: 'KM Sprint OK Linné',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week ago
        time: '18:00',
        location: 'Uppsala Centrum',
        type: 'individual',
        classification: 'club',
        status: 'completed',
        description: 'Klubbmästerskap i sprint. Snabb stadsorientering!',
        classes: [
            { id: 'h-senior', name: 'H Senior', courseId: 'sprint', courseName: 'Sprint', entryCount: 15 },
            { id: 'd-senior', name: 'D Senior', courseId: 'sprint', courseName: 'Sprint', entryCount: 12 },
            { id: 'ungdom', name: 'Ungdom', courseId: 'sprint-kort', courseName: 'Sprint Kort', entryCount: 18 },
        ],
        courses: [
            { id: 'sprint', name: 'Sprint', length: 2800, controls: 18 },
            { id: 'sprint-kort', name: 'Sprint Kort', length: 1900, controls: 12 },
        ],
        entries: [
            { id: 'km1', firstName: 'Nils', lastName: 'Ekman', clubName: 'OK Linné', classId: 'h-senior', className: 'H Senior', siCard: '1234567', status: 'finished', result: 845, startTime: '18:00', finishTime: '18:14:05' },
            { id: 'km2', firstName: 'Patrik', lastName: 'Strand', clubName: 'OK Linné', classId: 'h-senior', className: 'H Senior', siCard: '2345678', status: 'finished', result: 923, startTime: '18:02', finishTime: '18:17:25' },
            { id: 'km3', firstName: 'Sofia', lastName: 'Nordin', clubName: 'OK Linné', classId: 'd-senior', className: 'D Senior', siCard: '3456789', status: 'finished', result: 967, startTime: '18:30', finishTime: '18:46:07' },
            { id: 'km4', firstName: 'Maja', lastName: 'Lund', clubName: 'OK Linné', classId: 'd-senior', className: 'D Senior', siCard: '4567890', status: 'finished', result: 1034, startTime: '18:32', finishTime: '18:49:26' },
            { id: 'km5', firstName: 'Elias', lastName: 'Björk', clubName: 'OK Linné', classId: 'ungdom', className: 'Ungdom', siCard: '5678901', status: 'finished', result: 612, startTime: '19:00', finishTime: '19:10:12' },
        ],
    },
    {
        id: 'demo-past-3',
        name: 'Söndagsturen',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
        time: '10:00',
        location: 'Stadsskogen, Uppsala',
        type: 'individual',
        classification: 'club',
        status: 'completed',
        description: 'Avslappnad söndagsträning för alla nivåer.',
        classes: [
            { id: 'svår', name: 'Svår', courseId: 'svar-bana', courseName: 'Svår', entryCount: 12 },
            { id: 'lätt', name: 'Lätt', courseId: 'latt-bana', courseName: 'Lätt', entryCount: 24 },
        ],
        courses: [
            { id: 'svar-bana', name: 'Svår', length: 4200, climb: 80, controls: 10 },
            { id: 'latt-bana', name: 'Lätt', length: 2100, climb: 40, controls: 7 },
        ],
        entries: [
            { id: 'st1', firstName: 'Viktor', lastName: 'Ekström', clubName: 'Järla Orientering', classId: 'svår', className: 'Svår', siCard: '6789012', status: 'finished', result: 1823, startTime: '10:00', finishTime: '10:30:23' },
            { id: 'st2', firstName: 'Lisa', lastName: 'Larsson', clubName: 'OK Linné', classId: 'svår', className: 'Svår', siCard: '7890123', status: 'finished', result: 2045, startTime: '10:05', finishTime: '10:39:10' },
            { id: 'st3', firstName: 'Karin', lastName: 'Holm', clubName: 'IK Jarl', classId: 'lätt', className: 'Lätt', siCard: '8901234', status: 'finished', result: 945, startTime: '10:30', finishTime: '10:45:45' },
            { id: 'st4', firstName: 'Olle', lastName: 'Persson', clubName: 'OK Kåre', classId: 'lätt', className: 'Lätt', siCard: '9012345', status: 'finished', result: 1123, startTime: '10:32', finishTime: '10:50:55' },
        ],
    },
    // Älvsjö Night Sprint - Real imported competition with map and splits
    {
        id: 'ans-2025',
        name: 'Älvsjö Night Sprint',
        date: '2025-12-02',
        time: '17:30',
        location: 'Älvsjö, Stockholm',
        type: 'individual',
        classification: 'club',
        status: 'completed',
        description: 'Nattsprint i Älvsjö med karta, banor och fullständiga resultat. Arrangör: OK Älvsjö-Örby.',
        resultsUrl: '/test-event', // Link to the detailed results viewer
        classes: [
            { id: 'korta', name: 'Korta', courseId: 'korta', courseName: 'Korta', entryCount: 15 },
            { id: 'mellan', name: 'Mellan', courseId: 'mellan', courseName: 'Mellan', entryCount: 18 },
            { id: 'langa', name: 'Långa', courseId: 'langa', courseName: 'Långa', entryCount: 22 },
        ],
        courses: [
            { id: 'korta', name: 'Korta', length: 2400, controls: 14 },
            { id: 'mellan', name: 'Mellan', length: 3200, controls: 18 },
            { id: 'langa', name: 'Långa', length: 4100, controls: 22 },
        ],
        entries: [
            { id: 'ans1', firstName: 'Svea', lastName: 'Larsson', clubName: 'OK Älvsjö-Örby', classId: 'korta', className: 'Korta', siCard: '7130719', status: 'finished', result: 1926, startTime: '18:45', finishTime: '19:17:06' },
            { id: 'ans2', firstName: 'Elisabeth', lastName: 'Bengtsson', clubName: 'IFK Lidingö SOK', classId: 'korta', className: 'Korta', siCard: '8534209', status: 'finished', result: 2140, startTime: '18:45', finishTime: '19:20:40' },
            { id: 'ans3', firstName: 'Adam', lastName: 'Segerslätt', clubName: 'IFK Umeå', classId: 'langa', className: 'Långa', siCard: '1234567', status: 'finished', result: 1650, startTime: '18:30', finishTime: '18:57:30' },
            { id: 'ans4', firstName: 'Anton', lastName: 'Akterin', clubName: 'OK Älvsjö-Örby', classId: 'langa', className: 'Långa', siCard: '2345678', status: 'finished', result: 1654, startTime: '18:32', finishTime: '18:59:34' },
            { id: 'ans5', firstName: 'Johan', lastName: 'Cumming', clubName: 'OK Älvsjö-Örby', classId: 'langa', className: 'Långa', siCard: '3456789', status: 'finished', result: 1823, startTime: '18:34', finishTime: '19:04:57' },
        ],
    },
];

/**
 * Seed localStorage with demo events if none exist
 */
export function seedDemoEventsIfEmpty(): boolean {
    if (typeof window === 'undefined') return false;

    const existing = localStorage.getItem('events');
    if (existing) {
        const events = JSON.parse(existing);
        if (events.length > 0) {
            return false; // Already have events
        }
    }

    // Seed with demo events
    localStorage.setItem('events', JSON.stringify(DEMO_EVENTS));
    return true;
}

/**
 * Force seed localStorage with demo events (overwrites existing)
 */
export function forceSeedDemoEvents(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('events', JSON.stringify(DEMO_EVENTS));
}

/**
 * Add demo events to existing events
 */
export function addDemoEvents(): void {
    if (typeof window === 'undefined') return;

    const existing = localStorage.getItem('events');
    const events = existing ? JSON.parse(existing) : [];

    // Add demo events with unique IDs
    DEMO_EVENTS.forEach(demo => {
        const exists = events.some((e: any) => e.id === demo.id);
        if (!exists) {
            events.push(demo);
        }
    });

    localStorage.setItem('events', JSON.stringify(events));
}
