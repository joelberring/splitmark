export type RankedResultStatus = 'OK' | 'MP' | 'DNF' | 'DSQ' | 'DNS' | 'OT' | 'UNKNOWN';

export interface RankedEntry<T = any> {
    entry: T;
    id: string;
    classId: string;
    className?: string;
    name: string;
    status: RankedResultStatus;
    isOk: boolean;
    timeSeconds?: number;
    position?: number;
    timeBehindSeconds?: number;
}

export interface RankedClassResults<T = any> {
    classId: string;
    className?: string;
    winnerTimeSeconds?: number;
    entries: RankedEntry<T>[];
}

const NON_OK_STATUS_ORDER: Record<Exclude<RankedResultStatus, 'OK'>, number> = {
    MP: 1,
    DNF: 2,
    DSQ: 3,
    DNS: 4,
    OT: 5,
    UNKNOWN: 6,
};

function asFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function parseClockToSeconds(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(':').map((part) => Number(part));
    if (!parts.every((part) => Number.isFinite(part) && part >= 0)) return null;

    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
}

function normalizeDurationToSeconds(raw: number): number | undefined {
    if (!Number.isFinite(raw) || raw <= 0) return undefined;

    // Heuristic: values above 100000 are very likely milliseconds.
    if (raw > 100000) {
        return Math.round(raw / 1000);
    }

    return Math.round(raw);
}

export function getEntryDurationSeconds(entry: any): number | undefined {
    const runningTime = asFiniteNumber(entry?.runningTime);
    if (runningTime !== null) {
        return normalizeDurationToSeconds(runningTime);
    }

    const resultTime = asFiniteNumber(entry?.time) ?? asFiniteNumber(entry?.resultTime);
    if (resultTime !== null) {
        return normalizeDurationToSeconds(resultTime);
    }

    const clockTime = parseClockToSeconds(entry?.resultTime);
    if (clockTime !== null) {
        return clockTime;
    }

    if (entry?.startTime && entry?.finishTime) {
        const start = new Date(entry.startTime).getTime();
        const finish = new Date(entry.finishTime).getTime();
        if (Number.isFinite(start) && Number.isFinite(finish) && finish > start) {
            return Math.round((finish - start) / 1000);
        }
    }

    return undefined;
}

function mapRawStatus(raw: string): RankedResultStatus {
    const normalized = raw.trim().toLowerCase();

    if (['ok', 'finished', 'approved'].includes(normalized)) return 'OK';
    if (['mp', 'missingpunch', 'mispunch'].includes(normalized)) return 'MP';
    if (['dnf', 'didnotfinish'].includes(normalized)) return 'DNF';
    if (['dsq', 'disqualified'].includes(normalized)) return 'DSQ';
    if (['dns', 'didnotstart'].includes(normalized)) return 'DNS';
    if (['ot', 'overtime'].includes(normalized)) return 'OT';

    return 'UNKNOWN';
}

export function normalizeResultStatus(entry: any): RankedResultStatus {
    if (entry?.resultStatus) {
        return mapRawStatus(String(entry.resultStatus));
    }

    if (entry?.status) {
        return mapRawStatus(String(entry.status));
    }

    return 'UNKNOWN';
}

function getEntryName(entry: any): string {
    if (typeof entry?.name === 'string' && entry.name.trim()) return entry.name.trim();

    const first = typeof entry?.firstName === 'string' ? entry.firstName.trim() : '';
    const last = typeof entry?.lastName === 'string' ? entry.lastName.trim() : '';
    const combined = `${first} ${last}`.trim();

    return combined || 'Okänd löpare';
}

function compareByName(a: any, b: any): number {
    return getEntryName(a).localeCompare(getEntryName(b), 'sv-SE');
}

export function rankClassEntries<T extends Record<string, any>>(entries: T[]): RankedEntry<T>[] {
    const normalized = entries.map((entry) => {
        const status = normalizeResultStatus(entry);
        const timeSeconds = getEntryDurationSeconds(entry);

        return {
            entry,
            id: String(entry.id || ''),
            classId: String(entry.classId || ''),
            className: entry.className,
            name: getEntryName(entry),
            status,
            isOk: status === 'OK' && typeof timeSeconds === 'number',
            timeSeconds,
        } as RankedEntry<T>;
    });

    const okEntries = normalized
        .filter((item) => item.isOk)
        .sort((a, b) => {
            const aTime = a.timeSeconds || Number.MAX_SAFE_INTEGER;
            const bTime = b.timeSeconds || Number.MAX_SAFE_INTEGER;
            if (aTime !== bTime) return aTime - bTime;
            return compareByName(a.entry, b.entry);
        });

    const winnerTimeSeconds = okEntries[0]?.timeSeconds;

    okEntries.forEach((item, index) => {
        item.position = index + 1;
        item.timeBehindSeconds = typeof winnerTimeSeconds === 'number' && typeof item.timeSeconds === 'number'
            ? Math.max(0, item.timeSeconds - winnerTimeSeconds)
            : undefined;
    });

    const nonOkEntries = normalized
        .filter((item) => !item.isOk)
        .sort((a, b) => {
            const aOrder = NON_OK_STATUS_ORDER[a.status as Exclude<RankedResultStatus, 'OK'>] ?? 99;
            const bOrder = NON_OK_STATUS_ORDER[b.status as Exclude<RankedResultStatus, 'OK'>] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;

            const aTime = a.timeSeconds ?? Number.MAX_SAFE_INTEGER;
            const bTime = b.timeSeconds ?? Number.MAX_SAFE_INTEGER;
            if (aTime !== bTime) return aTime - bTime;

            return compareByName(a.entry, b.entry);
        });

    return [...okEntries, ...nonOkEntries];
}

export function rankEntriesByClass<T extends Record<string, any>>(entries: T[]): RankedClassResults<T>[] {
    const byClass = new Map<string, T[]>();

    entries.forEach((entry) => {
        const classId = String(entry.classId || 'unknown');
        const current = byClass.get(classId) || [];
        current.push(entry);
        byClass.set(classId, current);
    });

    const ranked = Array.from(byClass.entries()).map(([classId, classEntries]) => {
        const rankedEntries = rankClassEntries(classEntries);
        const winnerTimeSeconds = rankedEntries.find((item) => item.isOk)?.timeSeconds;
        const className = rankedEntries.find((item) => item.className)?.className;

        return {
            classId,
            className,
            winnerTimeSeconds,
            entries: rankedEntries,
        } as RankedClassResults<T>;
    });

    ranked.sort((a, b) => {
        const aName = a.className || a.classId;
        const bName = b.className || b.classId;
        return aName.localeCompare(bName, 'sv-SE');
    });

    return ranked;
}

export function formatResultTime(seconds?: number): string {
    if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '-';

    const whole = Math.round(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const secs = whole % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeBehind(seconds?: number): string {
    if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return '';
    return `+${formatResultTime(seconds)}`;
}
