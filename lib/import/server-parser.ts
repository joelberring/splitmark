import { XMLParser } from 'fast-xml-parser';
import { FirestoreEvent, EventClass, EventEntry, EventCourse } from '../firestore/events';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '_text',
});

/**
 * Server-side parser for IOF XML 3.0 ResultList
 * Returns data formatted for FirestoreEvent
 */
export function parseResultListServer(xmlString: string) {
    const parsed = parser.parse(xmlString);
    const resultList = parsed.ResultList;
    if (!resultList) return null;

    const event = resultList.Event;
    const eventName = event?.Name || 'Älvsjö Night Sprint';
    const eventDate = event?.StartTime?.Date || '2025-12-02';

    const classes: EventClass[] = [];
    const entries: EventEntry[] = [];
    const results: EventEntry[] = [];

    const classResults = Array.isArray(resultList.ClassResult)
        ? resultList.ClassResult
        : [resultList.ClassResult];

    classResults.forEach((cr: any) => {
        if (!cr) return;
        const classId = cr.Class?.Id || cr.Class?.Name || 'unknown';
        const className = cr.Class?.Name || 'Unknown';

        const personResults = Array.isArray(cr.PersonResult)
            ? cr.PersonResult
            : [cr.PersonResult];

        personResults.forEach((pr: any) => {
            if (!pr) return;
            const person = pr.Person;
            const personId = person?.Id || `p-${results.length}`;
            const name = `${person?.Name?.Given || ''} ${person?.Name?.Family || ''}`.trim();
            const club = pr.Organisation?.Name || '';
            const result = pr.Result;

            if (!result) return;

            const status = result.Status || 'OK';
            const time = parseInt(result.Time || '0');
            const position = parseInt(result.Position || '0');
            const siCard = result.ControlCard || '';

            // Format splits
            const splits: { controlCode: string; time: number }[] = [];
            if (result.SplitTime) {
                const splitList = Array.isArray(result.SplitTime) ? result.SplitTime : [result.SplitTime];
                splitList.forEach((s: any) => {
                    splits.push({
                        controlCode: s.ControlCode,
                        time: parseInt(s.Time || '0')
                    });
                });
            }

            const entryId = `entry-${personId}`;

            entries.push({
                id: entryId,
                name,
                club,
                classId,
                className,
                siCard,
                status: status === 'OK' ? 'finished' : (status.toLowerCase() as any),
            });

            results.push({
                id: entryId,
                name,
                club,
                classId,
                className,
                time,
                position,
                status: 'finished',
                resultStatus: status.toLowerCase() as any,
                splitTimes: splits
            });
        });

        classes.push({
            id: classId,
            name: className,
            entryCount: personResults.length
        });
    });

    // Calculate time behind for each class
    classes.forEach(cls => {
        const classResults = results.filter(r => r.classId === cls.id && (r.status === 'finished' || r.resultStatus === 'ok'));
        if (classResults.length > 0) {
            const runnerTimes = classResults
                .map(r => r.time)
                .filter((t): t is number => typeof t === 'number');

            if (runnerTimes.length > 0) {
                const winnerTime = Math.min(...runnerTimes);
                classResults.forEach(r => {
                    if (typeof r.time === 'number') {
                        r.timeBehind = r.time - winnerTime;
                    }
                });
            }
        }
    });

    return {
        name: eventName,
        date: eventDate,
        classes,
        entries,
        results
    };
}

/**
 * Server-side parser for IOF XML 3.0 CourseData
 */
export function parseCourseDataServer(xmlString: string) {
    const parsed = parser.parse(xmlString);
    const courseData = parsed.CourseData;
    if (!courseData) return null;

    const courses: EventCourse[] = [];
    const allControls = new Map<string, any>();

    // Parse all controls first
    const controlList = Array.isArray(courseData.Control) ? courseData.Control : [courseData.Control];
    controlList.forEach((c: any) => {
        if (!c) return;
        allControls.set(c.Id, {
            id: c.Id,
            lat: c.Position?.['@_lat'],
            lng: c.Position?.['@_lng']
        });
    });

    // Parse courses
    const courseList = Array.isArray(courseData.Course) ? courseData.Course : [courseData.Course];
    courseList.forEach((c: any) => {
        if (!c) return;
        const courseControls = Array.isArray(c.CourseControl) ? c.CourseControl : [c.CourseControl];

        courses.push({
            id: c.Id || c.Name,
            name: c.Name,
            length: parseInt(c.Length || '0'),
            climb: parseInt(c.Climb || '0'),
            controls: courseControls.map((cc: any) => cc.Control).filter(Boolean)
        });
    });

    return { courses, controls: Array.from(allControls.values()) };
}
