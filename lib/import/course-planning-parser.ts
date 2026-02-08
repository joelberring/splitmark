import { XMLParser } from 'fast-xml-parser';
import {
    DEFAULT_COURSE_GPS_MODE,
    DEFAULT_COURSE_MOBILE_OPTIONS,
    type EventPlanningControl,
    type EventPlanningCourse,
} from '@/lib/events/course-planning';

export type CoursePlanningSourceFormat = 'purplepen' | 'iof-coursedata' | 'unknown';

export interface ParsedCoursePlanningData {
    controls: EventPlanningControl[];
    courses: EventPlanningCourse[];
    format: CoursePlanningSourceFormat;
    warnings: string[];
}

interface PurplePath {
    controlIds: string[];
    forkLabel: string;
}

interface PurpleCourseControlNode {
    id: string;
    controlId: string;
    nextId?: string;
    variationType?: string;
    variationEndId?: string;
    variationTargets: string[];
}

interface PurplePathExpansionResult {
    paths: PurplePath[];
    truncated: boolean;
}

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
});

function toArray<T>(value: T | T[] | null | undefined): T[] {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

function readText(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (typeof value === 'object') {
        const source = value as Record<string, unknown>;
        if (typeof source['#text'] === 'string') return source['#text'];
        if (typeof source._text === 'string') return source._text;
    }

    return undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
    const text = readText(value);
    if (text === undefined) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const key = keyFn(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}

function toCourseType(value: string | undefined): EventPlanningControl['type'] {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'start') return 'start';
    if (normalized === 'finish') return 'finish';
    return 'control';
}

function normalizeForkLabel(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const direct = trimmed.match(/([A-Z]{1,4})$/);
    if (direct) return direct[1];

    const numeric = trimmed.match(/([0-9]{1,2})$/);
    if (numeric) return numeric[1];

    return undefined;
}

function splitCourseVariantName(name: string): { baseName: string; forkLabel?: string } {
    const normalizedName = name.trim();
    if (!normalizedName) return { baseName: 'Course' };

    if (normalizedName.includes(':')) {
        const [basePart, variantPart] = normalizedName.split(':');
        return {
            baseName: basePart.trim() || normalizedName,
            forkLabel: normalizeForkLabel(variantPart),
        };
    }

    const suffixMatch = normalizedName.match(/^(.*?)[\s_-]([A-Z]{1,4}|[0-9]{1,2})$/);
    if (suffixMatch) {
        return {
            baseName: suffixMatch[1].trim() || normalizedName,
            forkLabel: suffixMatch[2],
        };
    }

    return { baseName: normalizedName };
}

function deriveForkLabelFromFamily(name: string, family: string): string | undefined {
    const normalizedName = name.trim();
    const normalizedFamily = family.trim();
    if (!normalizedName || !normalizedFamily) return undefined;

    const direct = normalizeForkLabel(normalizedName);
    if (direct) return direct;

    if (normalizedName.startsWith(normalizedFamily)) {
        const suffix = normalizedName.slice(normalizedFamily.length).trim();
        return normalizeForkLabel(suffix);
    }

    return undefined;
}

function parseIofCourseData(root: Record<string, unknown>): ParsedCoursePlanningData {
    const warnings: string[] = [];
    const raceCourseDataItems = toArray(
        (root.CourseData as Record<string, unknown> | undefined)?.RaceCourseData
    );

    if (raceCourseDataItems.length === 0) {
        return {
            controls: [],
            courses: [],
            format: 'iof-coursedata',
            warnings: ['IOF CourseData saknar RaceCourseData.'],
        };
    }

    let minX: number | undefined;
    let maxX: number | undefined;
    let minY: number | undefined;
    let maxY: number | undefined;

    const rawControls: Array<EventPlanningControl & { mapX?: number; mapY?: number }> = [];
    const rawCourses: Array<{
        id: string;
        name: string;
        lengthMeters?: number;
        climbMeters?: number;
        controlIds: string[];
        baseName: string;
        forkLabel?: string;
    }> = [];

    for (const raceData of raceCourseDataItems) {
        if (!raceData || typeof raceData !== 'object') continue;
        const race = raceData as Record<string, unknown>;

        const map = race.Map as Record<string, unknown> | undefined;
        const topLeft = map?.MapPositionTopLeft as Record<string, unknown> | undefined;
        const bottomRight = map?.MapPositionBottomRight as Record<string, unknown> | undefined;
        const topLeftX = parseOptionalNumber(topLeft?.['@_x']);
        const topLeftY = parseOptionalNumber(topLeft?.['@_y']);
        const bottomRightX = parseOptionalNumber(bottomRight?.['@_x']);
        const bottomRightY = parseOptionalNumber(bottomRight?.['@_y']);

        if (topLeftX !== undefined && bottomRightX !== undefined) {
            minX = Math.min(topLeftX, bottomRightX);
            maxX = Math.max(topLeftX, bottomRightX);
        }
        if (topLeftY !== undefined && bottomRightY !== undefined) {
            minY = Math.min(topLeftY, bottomRightY);
            maxY = Math.max(topLeftY, bottomRightY);
        }

        const controls = toArray(race.Control);
        controls.forEach((controlNode, index) => {
            if (!controlNode || typeof controlNode !== 'object') return;
            const node = controlNode as Record<string, unknown>;

            const id = readText(node.Id) || `ctrl-${index + 1}`;
            const type = toCourseType(readText(node['@_type']));

            const position = node.Position as Record<string, unknown> | undefined;
            const lat = parseOptionalNumber(position?.['@_lat']);
            const lng = parseOptionalNumber(position?.['@_lng']);

            const mapPosition = node.MapPosition as Record<string, unknown> | undefined;
            const x = parseOptionalNumber(mapPosition?.['@_x']);
            const y = parseOptionalNumber(mapPosition?.['@_y']);

            if (x !== undefined) {
                minX = minX === undefined ? x : Math.min(minX, x);
                maxX = maxX === undefined ? x : Math.max(maxX, x);
            }
            if (y !== undefined) {
                minY = minY === undefined ? y : Math.min(minY, y);
                maxY = maxY === undefined ? y : Math.max(maxY, y);
            }

            const code = readText(node.Code) || id;

            rawControls.push({
                id,
                code,
                type,
                lat,
                lng,
                mapX: x,
                mapY: y,
            });
        });

        const courses = toArray(race.Course);
        courses.forEach((courseNode, index) => {
            if (!courseNode || typeof courseNode !== 'object') return;
            const node = courseNode as Record<string, unknown>;

            const id = readText(node.Id) || `course-${index + 1}`;
            const name = readText(node.Name) || `Course ${index + 1}`;
            const familyName = readText(node.CourseFamily)?.trim();
            const parsedName = splitCourseVariantName(name);

            const courseControls = toArray(node.CourseControl)
                .map((courseControlNode) => {
                    if (!courseControlNode || typeof courseControlNode !== 'object') return undefined;
                    const cc = courseControlNode as Record<string, unknown>;
                    return readText(cc.Control) || readText(cc.ControlCode);
                })
                .filter((controlId): controlId is string => !!controlId);

            if (courseControls.length === 0) {
                warnings.push(`Banan "${name}" innehåller inga CourseControl-element.`);
            }

            rawCourses.push({
                id,
                name,
                lengthMeters: parseOptionalNumber(node.Length),
                climbMeters: parseOptionalNumber(node.Climb),
                controlIds: courseControls,
                baseName: familyName || parsedName.baseName,
                forkLabel: familyName
                    ? deriveForkLabelFromFamily(name, familyName)
                    : parsedName.forkLabel,
            });
        });
    }

    const xSpan = minX !== undefined && maxX !== undefined ? maxX - minX : undefined;
    const ySpan = minY !== undefined && maxY !== undefined ? maxY - minY : undefined;
    const canComputeRelative = xSpan !== undefined && ySpan !== undefined && xSpan > 0 && ySpan > 0;

    const controls = uniqueBy(rawControls, (control) => control.id).map((control) => {
        const withRelative = { ...control };

        if (canComputeRelative) {
            const mapControl = rawControls.find((item) => item.id === control.id);
            const x = (mapControl as any)?.mapX as number | undefined;
            const y = (mapControl as any)?.mapY as number | undefined;
            if (typeof x === 'number' && typeof y === 'number') {
                withRelative.relX = clamp01((x - (minX as number)) / (xSpan as number));
                withRelative.relY = clamp01(1 - ((y - (minY as number)) / (ySpan as number)));
            }
        }

        return withRelative;
    });

    const controlsById = new Map(controls.map((control) => [control.id, control]));

    const groupedByBase = new Map<string, typeof rawCourses>();
    rawCourses.forEach((course) => {
        const existing = groupedByBase.get(course.baseName) || [];
        existing.push(course);
        groupedByBase.set(course.baseName, existing);
    });

    const courses = rawCourses.map((course, index) => {
        const group = groupedByBase.get(course.baseName) || [];
        let forkLabel = course.forkLabel;
        if (!forkLabel && group.length > 1) {
            const offset = group.findIndex((candidate) => candidate.id === course.id);
            forkLabel = String.fromCharCode(65 + Math.max(0, offset));
        }

        const controlIds = course.controlIds.filter((controlId) => controlsById.has(controlId));
        if (controlIds.length < course.controlIds.length) {
            warnings.push(
                `Banan "${course.name}" refererar kontroller som saknas i Control-listan.`
            );
        }

        return {
            id: course.id || `course-${index + 1}`,
            name: course.name,
            controlIds,
            lengthMeters: course.lengthMeters,
            climbMeters: course.climbMeters,
            forkLabel,
            gpsMode: { ...DEFAULT_COURSE_GPS_MODE },
            mobileOptions: { ...DEFAULT_COURSE_MOBILE_OPTIONS },
        } satisfies EventPlanningCourse;
    });

    return {
        controls,
        courses,
        format: 'iof-coursedata',
        warnings,
    };
}

function branchToken(index: number): string {
    if (index < 26) return String.fromCharCode(65 + index);
    return `${index + 1}`;
}

function dedupeConsecutive(ids: string[]): string[] {
    const result: string[] = [];
    for (const id of ids) {
        if (!id) continue;
        if (result[result.length - 1] !== id) {
            result.push(id);
        }
    }
    return result;
}

function buildPurpleBranches(node: PurpleCourseControlNode): Array<{ targetId: string; token?: string }> {
    const uniqueVariationTargets = Array.from(
        new Set(node.variationTargets.filter((targetId) => targetId))
    );

    if (uniqueVariationTargets.length > 0 || node.variationType === 'fork') {
        const resolvedTargets = uniqueVariationTargets
            .map((targetId) => {
                if (targetId === node.id) return node.nextId;
                return targetId;
            })
            .filter((targetId): targetId is string => !!targetId && targetId !== node.id);

        const uniqueResolved = Array.from(new Set(resolvedTargets));
        if (uniqueResolved.length > 0) {
            const includeTokens = uniqueResolved.length > 1;
            return uniqueResolved.map((targetId, index) => ({
                targetId,
                token: includeTokens ? branchToken(index) : undefined,
            }));
        }
    }

    if (node.nextId && node.nextId !== node.id) {
        return [{ targetId: node.nextId }];
    }

    return [];
}

function buildPurpleForkBranches(
    node: PurpleCourseControlNode,
    nodes: Map<string, PurpleCourseControlNode>
): Array<{ controlIds: string[]; nextNodeId?: string; token?: string }> {
    if (node.variationType !== 'fork' || !node.variationEndId) return [];

    const rawEntries = node.variationTargets.length > 0
        ? node.variationTargets
        : [node.id];

    const entryIds = Array.from(
        new Set(
            rawEntries
                .map((targetId) => (targetId === node.id ? node.id : targetId))
                .filter((targetId) => !!targetId)
        )
    );

    if (entryIds.length === 0) return [];

    const includeTokens = entryIds.length > 1;

    return entryIds
        .map((entryId, index) => {
            const branchControls: string[] = [];
            const branchSeen = new Set<string>();
            let currentId: string | undefined = entryId;
            let guard = 0;

            while (
                currentId
                && currentId !== node.variationEndId
                && !branchSeen.has(currentId)
                && guard < 180
            ) {
                guard += 1;
                branchSeen.add(currentId);

                const currentNode = nodes.get(currentId);
                if (!currentNode) {
                    break;
                }

                if (currentNode.controlId) {
                    branchControls.push(currentNode.controlId);
                }

                if (!currentNode.nextId || currentNode.nextId === currentId) {
                    currentId = undefined;
                    break;
                }
                currentId = currentNode.nextId;
            }

            return {
                controlIds: dedupeConsecutive(branchControls),
                nextNodeId: node.variationEndId || currentId,
                token: includeTokens ? branchToken(index) : undefined,
            };
        })
        .filter((branch) => branch.controlIds.length > 0 || !!branch.nextNodeId);
}

function expandPurpleCoursePaths(
    firstCourseControlId: string,
    nodes: Map<string, PurpleCourseControlNode>,
    maxPaths = 64
): PurplePathExpansionResult {
    const results: PurplePath[] = [];
    const maxDepth = 300;
    let truncated = false;

    const dfs = (
        nodeId: string,
        controlIds: string[],
        tokens: string[],
        seen: Map<string, number>,
        depth: number
    ) => {
        if (results.length >= maxPaths) {
            truncated = true;
            return;
        }
        if (depth > maxDepth) return;

        const node = nodes.get(nodeId);
        if (!node) {
            results.push({
                controlIds: dedupeConsecutive(controlIds),
                forkLabel: tokens.join(''),
            });
            return;
        }

        const seenCount = seen.get(nodeId) || 0;
        if (seenCount >= 2) {
            results.push({
                controlIds: dedupeConsecutive(controlIds),
                forkLabel: tokens.join(''),
            });
            return;
        }

        const nextSeen = new Map(seen);
        nextSeen.set(nodeId, seenCount + 1);

        const forkBranches = buildPurpleForkBranches(node, nodes);
        if (forkBranches.length > 0) {
            forkBranches.forEach((branch) => {
                const mergedControls = dedupeConsecutive([...controlIds, ...branch.controlIds]);
                const nextTokens = branch.token ? [...tokens, branch.token] : [...tokens];
                if (branch.nextNodeId) {
                    dfs(branch.nextNodeId, mergedControls, nextTokens, nextSeen, depth + 1);
                } else {
                    results.push({
                        controlIds: mergedControls,
                        forkLabel: nextTokens.join(''),
                    });
                }
            });
            return;
        }

        const nextControls = node.controlId
            ? [...controlIds, node.controlId]
            : [...controlIds];

        const branches = buildPurpleBranches(node);

        if (branches.length === 0) {
            results.push({
                controlIds: dedupeConsecutive(nextControls),
                forkLabel: tokens.join(''),
            });
            return;
        }

        branches.forEach((branch) => {
            const nextTokens = branch.token ? [...tokens, branch.token] : [...tokens];
            dfs(branch.targetId, nextControls, nextTokens, nextSeen, depth + 1);
        });
    };

    dfs(firstCourseControlId, [], [], new Map(), 0);

    const deduped = uniqueBy(results, (path) => path.controlIds.join('>'));
    return {
        paths: deduped,
        truncated,
    };
}

function parsePurplePenData(root: Record<string, unknown>): ParsedCoursePlanningData {
    const warnings: string[] = [];
    const eventRoot = root['course-scribe-event'] as Record<string, unknown> | undefined;
    if (!eventRoot) {
        return {
            controls: [],
            courses: [],
            format: 'purplepen',
            warnings: ['Purple Pen-fil saknar course-scribe-event-root.'],
        };
    }

    const eventNode = eventRoot.event as Record<string, unknown> | undefined;
    const printAreaFromEvent = eventNode?.['print-area'] as Record<string, unknown> | undefined;
    const fallbackCourse = toArray(eventRoot.course)[0] as Record<string, unknown> | undefined;
    const printAreaFromCourse = fallbackCourse?.['print-area'] as Record<string, unknown> | undefined;
    const printAreaNode = printAreaFromEvent || printAreaFromCourse;

    const rawControlNodes = toArray(eventRoot.control);
    const rawControls = rawControlNodes
        .map((controlNode, index) => {
            if (!controlNode || typeof controlNode !== 'object') return undefined;
            const node = controlNode as Record<string, unknown>;
            const id = readText(node['@_id']) || `control-${index + 1}`;
            const kind = (readText(node['@_kind']) || 'normal').toLowerCase();
            const code = readText(node.code)
                || (kind === 'start' ? 'S' : kind === 'finish' ? 'M' : id);
            const location = node.location as Record<string, unknown> | undefined;
            const x = parseOptionalNumber(location?.['@_x']);
            const y = parseOptionalNumber(location?.['@_y']);

            return {
                id,
                code,
                kind,
                x,
                y,
            };
        })
        .filter((control) => !!control) as Array<{
            id: string;
            code: string;
            kind: string;
            x: number | undefined;
            y: number | undefined;
        }>;

    const xValues = rawControls
        .map((control) => control.x)
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
    const yValues = rawControls
        .map((control) => control.y)
        .filter((value): value is number => value !== undefined && Number.isFinite(value));

    const printLeft = parseOptionalNumber(printAreaNode?.['@_left']);
    const printRight = parseOptionalNumber(printAreaNode?.['@_right']);
    const printBottom = parseOptionalNumber(printAreaNode?.['@_bottom']);
    const printTop = parseOptionalNumber(printAreaNode?.['@_top']);

    const left = printLeft ?? (xValues.length > 0 ? Math.min(...xValues) : 0);
    const right = printRight ?? (xValues.length > 0 ? Math.max(...xValues) : 1000);
    const bottom = printBottom ?? (yValues.length > 0 ? Math.min(...yValues) : 0);
    const top = printTop ?? (yValues.length > 0 ? Math.max(...yValues) : 1000);
    const width = right - left;
    const height = top - bottom;

    const controls: EventPlanningControl[] = rawControls.map((control) => {
        const relX = control.x !== undefined && width > 0
            ? clamp01((control.x - left) / width)
            : undefined;
        const relY = control.y !== undefined && height > 0
            ? clamp01(1 - ((control.y - bottom) / height))
            : undefined;

        return {
            id: control.id,
            code: control.code,
            type: control.kind === 'start' ? 'start' : control.kind === 'finish' ? 'finish' : 'control',
            relX,
            relY,
        } satisfies EventPlanningControl;
    });

    const controlsById = new Map(controls.map((control) => [control.id, control]));

    const rawNodes = toArray(eventRoot['course-control']);
    const courseControlNodes = new Map<string, PurpleCourseControlNode>();
    rawNodes.forEach((node) => {
        if (!node || typeof node !== 'object') return;
        const source = node as Record<string, unknown>;
        const id = readText(source['@_id']);
        if (!id) return;

        const nextNode = source.next as Record<string, unknown> | undefined;
        const nextId = readText(nextNode?.['@_course-control']);

        const variationTargets = toArray(source.variation)
            .map((variationNode) => {
                if (!variationNode || typeof variationNode !== 'object') return undefined;
                return readText((variationNode as Record<string, unknown>)['@_course-control']);
            })
            .filter((targetId): targetId is string => !!targetId);

        courseControlNodes.set(id, {
            id,
            controlId: readText(source['@_control']) || '',
            nextId,
            variationType: readText(source['@_variation'])?.toLowerCase(),
            variationEndId: readText(source['@_variation-end']),
            variationTargets,
        });
    });

    const rawCourses = toArray(eventRoot.course);
    const courses: EventPlanningCourse[] = [];

    rawCourses.forEach((courseNode, index) => {
        if (!courseNode || typeof courseNode !== 'object') return;
        const source = courseNode as Record<string, unknown>;
        const courseId = readText(source['@_id']) || `course-${index + 1}`;
        const name = readText(source.name) || `Course ${index + 1}`;
        const firstNode = source.first as Record<string, unknown> | undefined;
        const firstCourseControlId = readText(firstNode?.['@_course-control']);
        if (!firstCourseControlId) return;

        const expanded = expandPurpleCoursePaths(firstCourseControlId, courseControlNodes);
        if (expanded.paths.length === 0) {
            warnings.push(`Kunde inte läsa kontrollföljd för bana "${name}".`);
            return;
        }
        if (expanded.truncated) {
            warnings.push(`Banan "${name}" har många varianter. Visar de första ${expanded.paths.length}.`);
        }

        expanded.paths.forEach((path, variantIndex) => {
            const controlIds = dedupeConsecutive(path.controlIds)
                .filter((controlId) => controlsById.has(controlId));
            if (controlIds.length === 0) return;

            const forkLabel = path.forkLabel || (expanded.paths.length > 1 ? branchToken(variantIndex) : undefined);
            const variantSuffix = forkLabel ? ` ${forkLabel}` : '';

            courses.push({
                id: expanded.paths.length > 1 ? `${courseId}-${variantIndex + 1}` : courseId,
                name: `${name}${variantSuffix}`,
                controlIds,
                forkLabel,
                gpsMode: { ...DEFAULT_COURSE_GPS_MODE },
                mobileOptions: { ...DEFAULT_COURSE_MOBILE_OPTIONS },
            });
        });
    });

    return {
        controls,
        courses: uniqueBy(courses, (course) => `${course.name}:${course.controlIds.join('>')}`),
        format: 'purplepen',
        warnings,
    };
}

export function parseCoursePlanningDataFromXml(xmlText: string): ParsedCoursePlanningData {
    let parsed: Record<string, unknown>;
    try {
        parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
    } catch (error) {
        return {
            controls: [],
            courses: [],
            format: 'unknown',
            warnings: [`XML-kunde inte tolkas: ${(error as Error).message}`],
        };
    }

    if (parsed.CourseData) {
        return parseIofCourseData(parsed);
    }
    if (parsed['course-scribe-event']) {
        return parsePurplePenData(parsed);
    }

    return {
        controls: [],
        courses: [],
        format: 'unknown',
        warnings: ['Okänt filformat: varken CourseData eller course-scribe-event hittades.'],
    };
}
