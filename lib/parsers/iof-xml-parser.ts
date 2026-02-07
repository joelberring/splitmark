/**
 * Simple parser for IOF XML 3.0 (Data Exchange Standard).
 * Extracts event metadata and course information.
 */
export interface IOFEvent {
    name: string;
    startTime?: string;
    endTime?: string;
    location?: {
        name?: string;
        lat?: number;
        lng?: number;
    };
    classes: IOFClass[];
}

export interface IOFClass {
    name: string;
    course?: IOFCourse;
}

export interface IOFCourse {
    name: string;
    length?: number;
    climb?: number;
    controls: IOFControl[];
}

export interface IOFControl {
    code: string;
    name?: string;
    type?: 'start' | 'control' | 'finish';
}

export const parseIOFXML = (xmlString: string): IOFEvent => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
        throw new Error('Invalid XML document');
    }

    const eventName = xmlDoc.querySelector('Event > Name')?.textContent || 'Unnamed Event';
    const startTime = xmlDoc.querySelector('StartTime')?.textContent || undefined;

    const event: IOFEvent = {
        name: eventName,
        startTime,
        classes: []
    };

    // Extract Classes
    const classNodes = xmlDoc.querySelectorAll('Class');
    classNodes.forEach(node => {
        const className = node.querySelector('Name')?.textContent || 'Unknown Class';
        event.classes.push({ name: className });
    });

    // In IOF XML 3.0, courses are often linked to classes
    // This is a simplified extraction
    const courseNodes = xmlDoc.querySelectorAll('Course');
    courseNodes.forEach((node, index) => {
        const courseName = node.querySelector('Name')?.textContent || `Course ${index + 1}`;
        const controls: IOFControl[] = [];

        const controlNodes = node.querySelectorAll('CourseControl');
        controlNodes.forEach(cNode => {
            const code = cNode.querySelector('Control')?.textContent || '0';
            const type = cNode.getAttribute('type') as any || 'control';
            controls.push({ code, type });
        });

        if (event.classes[index]) {
            event.classes[index].course = {
                name: courseName,
                controls
            };
        }
    });

    return event;
};
