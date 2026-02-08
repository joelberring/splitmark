const STORAGE_KEY = "splitmark:offline-actions:v1";
const STORAGE_EVENT = "splitmark:offline-actions-updated";

const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 7;
const DEFAULT_AUTO_FLUSH_MS = 20_000;

export type OfflineActionStatus = "pending" | "syncing" | "failed";

export interface OfflineActionRecord<TPayload = unknown> {
    id: string;
    type: string;
    payload: TPayload;
    attempts: number;
    status: OfflineActionStatus;
    createdAt: string;
    updatedAt: string;
    nextRetryAt?: string;
    lastError?: string;
    context?: {
        eventId?: string;
        label?: string;
    };
}

export interface OfflineQueueSummary {
    total: number;
    pending: number;
    syncing: number;
    failed: number;
    nextRetryAt?: string;
    lastUpdatedAt?: string;
}

type OfflineActionHandler<TPayload = unknown> = (
    payload: TPayload,
    action: OfflineActionRecord<TPayload>
) => Promise<void>;

const handlers = new Map<string, OfflineActionHandler>();
const listeners = new Set<(summary: OfflineQueueSummary, actions: OfflineActionRecord[]) => void>();

let flushPromise: Promise<OfflineQueueSummary> | null = null;
let autoFlushStarted = false;
let autoFlushTimer: ReturnType<typeof setInterval> | null = null;
let onlineListener: (() => void) | null = null;

function isBrowser(): boolean {
    return typeof window !== "undefined";
}

function safeDateIso(value?: string): string {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString();
}

function readActions(): OfflineActionRecord[] {
    if (!isBrowser()) return [];

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item) => item && typeof item === "object" && typeof item.id === "string")
            .map((item) => {
                const createdAt = safeDateIso(item.createdAt) || new Date().toISOString();
                const updatedAt = safeDateIso(item.updatedAt) || createdAt;
                const nextRetryAt = safeDateIso(item.nextRetryAt) || undefined;
                const status: OfflineActionStatus =
                    item.status === "syncing" || item.status === "failed" ? item.status : "pending";

                return {
                    id: String(item.id),
                    type: String(item.type || "unknown"),
                    payload: item.payload,
                    attempts: Math.max(0, Math.round(Number(item.attempts || 0))),
                    status,
                    createdAt,
                    updatedAt,
                    nextRetryAt,
                    lastError: typeof item.lastError === "string" ? item.lastError : undefined,
                    context: item.context && typeof item.context === "object"
                        ? {
                            eventId: typeof item.context.eventId === "string" ? item.context.eventId : undefined,
                            label: typeof item.context.label === "string" ? item.context.label : undefined,
                        }
                        : undefined,
                } as OfflineActionRecord;
            })
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    } catch {
        return [];
    }
}

function writeActions(actions: OfflineActionRecord[]): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

function createSummary(actions: OfflineActionRecord[]): OfflineQueueSummary {
    let pending = 0;
    let syncing = 0;
    let failed = 0;
    let nextRetryAt: string | undefined;
    let lastUpdatedAt: string | undefined;

    for (const action of actions) {
        if (action.status === "syncing") {
            syncing += 1;
        } else if (action.status === "failed") {
            failed += 1;
        } else {
            pending += 1;
            if (action.nextRetryAt && (!nextRetryAt || action.nextRetryAt < nextRetryAt)) {
                nextRetryAt = action.nextRetryAt;
            }
        }

        if (!lastUpdatedAt || action.updatedAt > lastUpdatedAt) {
            lastUpdatedAt = action.updatedAt;
        }
    }

    return {
        total: actions.length,
        pending,
        syncing,
        failed,
        nextRetryAt,
        lastUpdatedAt,
    };
}

function emitUpdate(actions?: OfflineActionRecord[]): void {
    const snapshot = actions ?? readActions();
    const summary = createSummary(snapshot);

    listeners.forEach((listener) => {
        try {
            listener(summary, snapshot);
        } catch (error) {
            console.error("Offline queue listener error:", error);
        }
    });

    if (isBrowser()) {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: summary }));
    }
}

function nextRetryIso(attempts: number): string {
    const delay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (2 ** Math.max(0, attempts - 1)));
    return new Date(Date.now() + delay).toISOString();
}

function shouldProcessAction(action: OfflineActionRecord, nowMs: number, includeFailed: boolean): boolean {
    if (action.status === "syncing") return false;
    if (action.status === "failed" && !includeFailed) return false;
    if (!action.nextRetryAt) return true;

    const retryMs = new Date(action.nextRetryAt).getTime();
    if (Number.isNaN(retryMs)) return true;
    return retryMs <= nowMs;
}

function upsertAction(actions: OfflineActionRecord[], updated: OfflineActionRecord): OfflineActionRecord[] {
    const index = actions.findIndex((item) => item.id === updated.id);
    if (index === -1) {
        return [...actions, updated].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    const next = [...actions];
    next[index] = updated;
    return next;
}

export function registerOfflineActionHandler<TPayload = unknown>(
    type: string,
    handler: OfflineActionHandler<TPayload>
): void {
    handlers.set(type, handler as OfflineActionHandler);
}

export function getOfflineActions(): OfflineActionRecord[] {
    return readActions();
}

export function getOfflineActionsForEvent(eventId?: string): OfflineActionRecord[] {
    if (!eventId) return getOfflineActions();
    return getOfflineActions().filter((action) => action.context?.eventId === eventId);
}

export function getOfflineQueueSummary(eventId?: string): OfflineQueueSummary {
    const actions = eventId ? getOfflineActionsForEvent(eventId) : getOfflineActions();
    return createSummary(actions);
}

export function subscribeOfflineQueue(
    callback: (summary: OfflineQueueSummary, actions: OfflineActionRecord[]) => void,
    eventId?: string
): () => void {
    if (!isBrowser()) {
        callback(createSummary([]), []);
        return () => { };
    }

    const wrapped = (summary: OfflineQueueSummary, actions: OfflineActionRecord[]) => {
        if (!eventId) {
            callback(summary, actions);
            return;
        }

        const filteredActions = actions.filter((action) => action.context?.eventId === eventId);
        callback(createSummary(filteredActions), filteredActions);
    };

    listeners.add(wrapped);

    const storageListener = (event: StorageEvent) => {
        if (event.key && event.key !== STORAGE_KEY) return;
        const actions = readActions();
        wrapped(createSummary(actions), actions);
    };

    window.addEventListener("storage", storageListener);

    const initial = readActions();
    wrapped(createSummary(initial), initial);

    return () => {
        listeners.delete(wrapped);
        window.removeEventListener("storage", storageListener);
    };
}

export function enqueueOfflineAction<TPayload = unknown>(params: {
    type: string;
    payload: TPayload;
    context?: OfflineActionRecord["context"];
}): OfflineActionRecord<TPayload> | null {
    if (!isBrowser()) return null;

    const nowIso = new Date().toISOString();
    const action: OfflineActionRecord<TPayload> = {
        id: `${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: params.type,
        payload: params.payload,
        attempts: 0,
        status: "pending",
        createdAt: nowIso,
        updatedAt: nowIso,
        context: params.context,
    };

    const next = [...readActions(), action].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    writeActions(next);
    emitUpdate(next);

    return action;
}

export function retryFailedOfflineActions(eventId?: string): void {
    if (!isBrowser()) return;

    const nowIso = new Date().toISOString();
    const next = readActions().map((action) => {
        const isTargetEvent = !eventId || action.context?.eventId === eventId;
        if (!isTargetEvent || action.status !== "failed") {
            return action;
        }

        return {
            ...action,
            status: "pending" as const,
            nextRetryAt: nowIso,
            updatedAt: nowIso,
        };
    });

    writeActions(next);
    emitUpdate(next);
}

export function clearOfflineActions(): void {
    if (!isBrowser()) return;
    writeActions([]);
    emitUpdate([]);
}

export async function flushOfflineActions(options?: {
    includeFailed?: boolean;
    eventId?: string;
}): Promise<OfflineQueueSummary> {
    if (!isBrowser()) {
        return createSummary([]);
    }

    if (flushPromise) {
        return flushPromise;
    }

    flushPromise = (async () => {
        let actions = readActions();

        if (!navigator.onLine) {
            const summary = createSummary(options?.eventId
                ? actions.filter((action) => action.context?.eventId === options.eventId)
                : actions);
            emitUpdate(actions);
            return summary;
        }

        const nowMs = Date.now();

        for (const currentAction of actions) {
            if (options?.eventId && currentAction.context?.eventId !== options.eventId) {
                continue;
            }

            if (!shouldProcessAction(currentAction, nowMs, !!options?.includeFailed)) {
                continue;
            }

            const handler = handlers.get(currentAction.type);
            if (!handler) {
                const failedMissingHandler: OfflineActionRecord = {
                    ...currentAction,
                    status: "failed",
                    attempts: currentAction.attempts + 1,
                    updatedAt: new Date().toISOString(),
                    nextRetryAt: undefined,
                    lastError: `Ingen handler registrerad för ${currentAction.type}`,
                };
                actions = upsertAction(actions, failedMissingHandler);
                writeActions(actions);
                continue;
            }

            const syncingAction: OfflineActionRecord = {
                ...currentAction,
                status: "syncing",
                updatedAt: new Date().toISOString(),
            };
            actions = upsertAction(actions, syncingAction);
            writeActions(actions);
            emitUpdate(actions);

            try {
                await handler(syncingAction.payload, syncingAction);
                actions = actions.filter((action) => action.id !== syncingAction.id);
                writeActions(actions);
                emitUpdate(actions);
            } catch (error) {
                const nextAttempts = syncingAction.attempts + 1;
                const isExhausted = nextAttempts >= MAX_ATTEMPTS;
                const retryAction: OfflineActionRecord = {
                    ...syncingAction,
                    attempts: nextAttempts,
                    status: isExhausted ? "failed" : "pending",
                    updatedAt: new Date().toISOString(),
                    nextRetryAt: isExhausted ? undefined : nextRetryIso(nextAttempts),
                    lastError: error instanceof Error ? error.message : String(error),
                };
                actions = upsertAction(actions, retryAction);
                writeActions(actions);
                emitUpdate(actions);
            }
        }

        const scopedActions = options?.eventId
            ? actions.filter((action) => action.context?.eventId === options.eventId)
            : actions;

        const summary = createSummary(scopedActions);
        emitUpdate(actions);
        return summary;
    })();

    try {
        return await flushPromise;
    } finally {
        flushPromise = null;
    }
}

export function startOfflineQueueAutoFlush(intervalMs: number = DEFAULT_AUTO_FLUSH_MS): void {
    if (!isBrowser() || autoFlushStarted) return;

    autoFlushStarted = true;

    onlineListener = () => {
        void flushOfflineActions();
    };

    window.addEventListener("online", onlineListener);

    autoFlushTimer = setInterval(() => {
        if (!navigator.onLine) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        void flushOfflineActions();
    }, Math.max(5_000, intervalMs));

    void flushOfflineActions();
}

export function stopOfflineQueueAutoFlush(): void {
    if (!isBrowser()) return;
    if (autoFlushTimer) {
        clearInterval(autoFlushTimer);
        autoFlushTimer = null;
    }
    if (onlineListener) {
        window.removeEventListener('online', onlineListener);
        onlineListener = null;
    }
    autoFlushStarted = false;
}
