import type { AffineMatrix } from '@/lib/geo/affine';
import type { SensitivityLevel, VirtualControl } from '@/types/virtual-controls';
import { SENSITIVITY_RADII } from '@/types/virtual-controls';

export type PlanningControlType = 'start' | 'control' | 'finish';

export interface EventPlanningControl {
    id: string;
    code: string;
    type: PlanningControlType;
    relX?: number;
    relY?: number;
    lat?: number;
    lng?: number;
    description?: string;
    gpsRadius?: number;
}

export interface EventCourseGpsMode {
    enabled: boolean;
    sensitivity: SensitivityLevel;
    customRadius?: number;
}

export interface EventCourseMobileOptions {
    allowMobileMap: boolean;
    hideRunnerDot: boolean;
}

export interface EventPlanningCourse {
    id: string;
    name: string;
    controlIds: string[];
    lengthMeters?: number;
    climbMeters?: number;
    forkLabel?: string;
    gpsMode: EventCourseGpsMode;
    mobileOptions: EventCourseMobileOptions;
}

export interface ControlCoordinateDeriveOptions {
    calibration?: AffineMatrix | null;
    imageWidth?: number;
    imageHeight?: number;
}

export interface BuildVirtualControlsResult {
    controls: VirtualControl[];
    missingControlCodes: string[];
}

export const DEFAULT_COURSE_GPS_MODE: EventCourseGpsMode = {
    enabled: true,
    sensitivity: 'standard',
};

export const DEFAULT_COURSE_MOBILE_OPTIONS: EventCourseMobileOptions = {
    allowMobileMap: true,
    hideRunnerDot: true,
};

export function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function normalizePlanningControls(rawControls: unknown): EventPlanningControl[] {
    if (!Array.isArray(rawControls)) return [];

    return rawControls
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const source = item as Record<string, unknown>;
            const id = String(source.id || source.code || `control-${Math.random().toString(36).slice(2, 10)}`);
            const code = String(source.code || id);
            const rawType = String(source.type || 'control');
            const type: PlanningControlType = rawType === 'start' || rawType === 'finish' ? rawType : 'control';

            return {
                id,
                code,
                type,
                relX: isFiniteNumber(source.relX) ? source.relX : undefined,
                relY: isFiniteNumber(source.relY) ? source.relY : undefined,
                lat: isFiniteNumber(source.lat) ? source.lat : undefined,
                lng: isFiniteNumber(source.lng) ? source.lng : undefined,
                gpsRadius: isFiniteNumber(source.gpsRadius) ? source.gpsRadius : undefined,
                description: typeof source.description === 'string' ? source.description : undefined,
            };
        });
}

export function normalizePlanningCourses(rawCourses: unknown): EventPlanningCourse[] {
    if (!Array.isArray(rawCourses)) return [];

    return rawCourses
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const source = item as Record<string, unknown>;
            const gpsModeSource = (source.gpsMode as Record<string, unknown> | undefined) || {};
            const mobileSource = (source.mobileOptions as Record<string, unknown> | undefined) || {};

            const sensitivityValue = String(gpsModeSource.sensitivity || DEFAULT_COURSE_GPS_MODE.sensitivity);
            const sensitivity: SensitivityLevel =
                sensitivityValue === 'exact'
                    ? 'exact'
                    : sensitivityValue === 'relaxed'
                        ? 'relaxed'
                        : sensitivityValue === 'custom'
                            ? 'custom'
                            : 'standard';

            return {
                id: String(source.id || `course-${Math.random().toString(36).slice(2, 10)}`),
                name: String(source.name || 'Ny bana'),
                controlIds: Array.isArray(source.controlIds)
                    ? source.controlIds.map((id) => String(id))
                    : [],
                lengthMeters: isFiniteNumber(source.lengthMeters) ? source.lengthMeters : undefined,
                climbMeters: isFiniteNumber(source.climbMeters) ? source.climbMeters : undefined,
                forkLabel: typeof source.forkLabel === 'string' ? source.forkLabel : undefined,
                gpsMode: {
                    enabled: gpsModeSource.enabled !== false,
                    sensitivity,
                    customRadius: isFiniteNumber(gpsModeSource.customRadius) ? gpsModeSource.customRadius : undefined,
                },
                mobileOptions: {
                    allowMobileMap: mobileSource.allowMobileMap !== false,
                    hideRunnerDot: mobileSource.hideRunnerDot !== false,
                },
            };
        });
}

export function getCourseControls(
    course: EventPlanningCourse | null | undefined,
    allControls: EventPlanningControl[]
): EventPlanningControl[] {
    if (!course) return [];

    const map = new Map(allControls.map((control) => [control.id, control]));
    return course.controlIds
        .map((id) => map.get(id))
        .filter((control): control is EventPlanningControl => !!control);
}

export function deriveLatLngFromControl(
    control: EventPlanningControl,
    options: ControlCoordinateDeriveOptions
): { lat: number; lng: number } | null {
    if (isFiniteNumber(control.lat) && isFiniteNumber(control.lng)) {
        return { lat: control.lat, lng: control.lng };
    }

    const calibration = options.calibration;
    if (
        !calibration
        || !isFiniteNumber(control.relX)
        || !isFiniteNumber(control.relY)
        || !isFiniteNumber(options.imageWidth)
        || !isFiniteNumber(options.imageHeight)
        || options.imageWidth <= 0
        || options.imageHeight <= 0
    ) {
        return null;
    }

    const pixelX = control.relX * options.imageWidth;
    const pixelY = control.relY * options.imageHeight;

    const lng = calibration.a * pixelX + calibration.b * pixelY + calibration.c;
    const lat = calibration.d * pixelX + calibration.e * pixelY + calibration.f;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat, lng };
}

function resolveRadius(
    control: EventPlanningControl,
    gpsMode: EventCourseGpsMode
): number {
    if (isFiniteNumber(control.gpsRadius) && control.gpsRadius > 0) {
        return control.gpsRadius;
    }

    if (gpsMode.sensitivity === 'custom' && isFiniteNumber(gpsMode.customRadius) && gpsMode.customRadius > 0) {
        return gpsMode.customRadius;
    }

    return SENSITIVITY_RADII[gpsMode.sensitivity === 'custom' ? 'standard' : gpsMode.sensitivity];
}

export function buildVirtualControls(
    course: EventPlanningCourse,
    allControls: EventPlanningControl[],
    options: ControlCoordinateDeriveOptions = {}
): BuildVirtualControlsResult {
    const courseControls = getCourseControls(course, allControls);
    const missingControlCodes: string[] = [];

    const virtualControls: VirtualControl[] = [];
    for (let index = 0; index < courseControls.length; index += 1) {
        const control = courseControls[index];
        const coordinates = deriveLatLngFromControl(control, options);
        if (!coordinates) {
            missingControlCodes.push(control.code);
            continue;
        }

        virtualControls.push({
            id: control.id,
            code: control.code,
            type: control.type,
            order: index,
            lat: coordinates.lat,
            lng: coordinates.lng,
            radius: resolveRadius(control, course.gpsMode),
            description: control.description,
        });
    }

    return {
        controls: virtualControls,
        missingControlCodes,
    };
}

function haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
        + Math.cos(phi1) * Math.cos(phi2)
        * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function estimateCourseLengthMeters(
    controls: EventPlanningControl[],
    options: ControlCoordinateDeriveOptions = {}
): number | null {
    if (controls.length < 2) return null;

    let length = 0;
    let hasAnySegment = false;

    for (let i = 1; i < controls.length; i += 1) {
        const prev = deriveLatLngFromControl(controls[i - 1], options);
        const current = deriveLatLngFromControl(controls[i], options);
        if (!prev || !current) continue;

        length += haversineMeters(prev.lat, prev.lng, current.lat, current.lng);
        hasAnySegment = true;
    }

    return hasAnySegment ? Math.round(length) : null;
}

export function generateControlId(): string {
    return `ctrl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateCourseId(): string {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
