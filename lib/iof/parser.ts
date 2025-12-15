/**
 * IOF XML 3.0 Parser
 * Converts between IOF XML format and TypeScript types
 */

import { parseStringPromise, Builder } from 'xml2js';
import type {
    EventList,
    EntryList,
    ResultList,
    StartList,
    CourseData,
} from '@/types/iof';

// ============= Parser =============

export class IOFParser {
    /**
     * Parse IOF XML string to typed object
     */
    static async parse<T = any>(xml: string): Promise<T> {
        try {
            const result = await parseStringPromise(xml, {
                explicitArray: false,
                mergeAttrs: true,
                normalizeTags: true,
                trim: true,
            });

            return this.transformKeys(result) as T;
        } catch (error) {
            console.error('Failed to parse IOF XML:', error);
            throw new Error(`XML parsing failed: ${error}`);
        }
    }

    /**
     * Convert object to IOF XML string
     */
    static toXML(data: any, rootName: string = 'EventList'): string {
        const builder = new Builder({
            rootName,
            xmldec: { version: '1.0', encoding: 'UTF-8' },
            renderOpts: { pretty: true, indent: '  ' },
        });

        return builder.buildObject(this.reverseTransformKeys(data));
    }

    /**
     * Transform XML keys to camelCase
     */
    private static transformKeys(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.transformKeys(item));
        }

        if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((result, key) => {
                const camelKey = this.toCamelCase(key);
                result[camelKey] = this.transformKeys(obj[key]);
                return result;
            }, {} as any);
        }

        return obj;
    }

    /**
     * Reverse transform: camelCase to PascalCase for XML
     */
    private static reverseTransformKeys(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.reverseTransformKeys(item));
        }

        if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((result, key) => {
                const pascalKey = this.toPascalCase(key);
                result[pascalKey] = this.reverseTransformKeys(obj[key]);
                return result;
            }, {} as any);
        }

        return obj;
    }

    /**
     * Convert PascalCase/kebab-case to camelCase
     */
    private static toCamelCase(str: string): string {
        return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase())
            .replace(/^(.)/, char => char.toLowerCase());
    }

    /**
     * Convert camelCase to PascalCase
     */
    private static toPascalCase(str: string): string {
        return str.replace(/^(.)/, char => char.toUpperCase());
    }
}

// ============= Specific Parsers =============

export async function parseEventList(xml: string): Promise<EventList> {
    return IOFParser.parse<EventList>(xml);
}

export async function parseEntryList(xml: string): Promise<EntryList> {
    return IOFParser.parse<EntryList>(xml);
}

export async function parseResultList(xml: string): Promise<ResultList> {
    return IOFParser.parse<ResultList>(xml);
}

export async function parseStartList(xml: string): Promise<StartList> {
    return IOFParser.parse<StartList>(xml);
}

export async function parseCourseData(xml: string): Promise<CourseData> {
    return IOFParser.parse<CourseData>(xml);
}

// ============= Serializers =============

export function serializeResultList(data: ResultList): string {
    return IOFParser.toXML(data, 'ResultList');
}

export function serializeEntryList(data: EntryList): string {
    return IOFParser.toXML(data, 'EntryList');
}

export function serializeStartList(data: StartList): string {
    return IOFParser.toXML(data, 'StartList');
}

export function serializeCourseData(data: CourseData): string {
    return IOFParser.toXML(data, 'CourseData');
}

// ============= Validators =============

/**
 * Validate IOF XML against basic structure
 */
export function validateIOFXML(xml: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Basic XML validation
    if (!xml || xml.trim().length === 0) {
        errors.push('XML is empty');
    }

    if (!xml.includes('<?xml')) {
        errors.push('Missing XML declaration');
    }

    // Check for common IOF root elements
    const hasValidRoot = [
        'EventList',
        'EntryList',
        'ResultList',
        'StartList',
        'CourseData',
        'CompetitorList',
    ].some(root => xml.includes(`<${root}`));

    if (!hasValidRoot) {
        errors.push('Invalid IOF root element');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
