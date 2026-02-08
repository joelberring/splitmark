'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEvent, type FirestoreEvent } from '@/lib/firestore/events';
import { saveEntry, subscribeToEntries } from '@/lib/firestore/entries';
import { SportIdentReader, type SICard } from '@/lib/sportident/reader';
import {
    isRadioControlLive,
    saveRadioControlDeviceStatus,
    saveRadioControlPassage,
    subscribeToRadioControlDevices,
    subscribeToRadioControlPassages,
    type RadioControlMode,
    type RadioControlDeviceStatus,
    type RadioControlPassage,
    type RadioPassageSource,
} from '@/lib/firestore/radio-controls';
import type { Entry } from '@/types/entry';

type BatteryManagerLike = {
    level: number;
    charging: boolean;
    addEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void;
    removeEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void;
};

type WakeLockSentinelLike = {
    released: boolean;
    release: () => Promise<void>;
    addEventListener?: (type: 'release', listener: () => void) => void;
};

type NavigatorBatteryLike = Navigator & {
    getBattery?: () => Promise<BatteryManagerLike>;
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

interface StationConfig {
    stationCode: string;
    stationName: string;
    masterId: string;
    mode: RadioControlMode;
    keepAwake: boolean;
    lowPowerMode: boolean;
}

interface FinishFeedback {
    tone: 'ok' | 'warn' | 'red';
    headline: string;
    runnerName?: string;
    timeText?: string;
    placementText?: string;
    detail?: string;
    shownAt: string;
}

const DEVICE_ID_STORAGE_KEY = 'splitmark:radio-device-id';
const DEFAULT_STATION_CONFIG: StationConfig = {
    stationCode: '',
    stationName: '',
    masterId: '',
    mode: 'radio_control',
    keepAwake: true,
    lowPowerMode: false,
};

function stationConfigStorageKey(eventId: string): string {
    return `splitmark:radio-config:${eventId}`;
}

function createDeviceId(): string {
    return `radio-device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDeviceId(): string {
    if (typeof window === 'undefined') return createDeviceId();
    const stored = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
    const next = createDeviceId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
}

function normalizeCardNumber(value: string): string {
    return value.replace(/\s+/g, '').trim();
}

function normalizeEntryCard(value?: string): string {
    if (!value) return '';
    return normalizeCardNumber(String(value)).toLowerCase();
}

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('sv-SE', { hour12: false });
}

function formatBattery(level?: number, charging?: boolean): string {
    if (!Number.isFinite(Number(level))) return 'okänd';
    const suffix = charging ? ' (laddar)' : '';
    return `${Math.round(Number(level))}%${suffix}`;
}

function computeHeartbeatSeconds(params: {
    mode: RadioControlMode;
    lowPowerMode: boolean;
    batteryLevel?: number;
    charging?: boolean;
}): number {
    let interval = params.lowPowerMode ? 90 : 30;

    if (params.mode === 'remote_finish') {
        interval = params.lowPowerMode ? 45 : 20;
    }

    if (typeof document !== 'undefined' && document.hidden) {
        interval = Math.max(interval, 120);
    }

    if (!params.charging && Number.isFinite(Number(params.batteryLevel))) {
        const battery = Number(params.batteryLevel);
        if (battery <= 15) interval = Math.max(interval, 180);
        else if (battery <= 30) interval = Math.max(interval, 90);
    }

    return interval;
}

function normalizeStatusValue(value?: Entry['status']): Entry['status'] {
    if (
        value === 'registered'
        || value === 'confirmed'
        || value === 'started'
        || value === 'finished'
        || value === 'dns'
        || value === 'dnf'
        || value === 'dsq'
        || value === 'cancelled'
    ) {
        return value;
    }
    return 'finished';
}

function parseClockText(value: string): { hour: number; minute: number; second: number } | null {
    const trimmed = value.trim();
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return null;
    const parts = trimmed.split(':').map((part) => Number(part));
    const hour = parts[0];
    const minute = parts[1];
    const second = parts.length > 2 ? parts[2] : 0;
    if (![hour, minute, second].every((part) => Number.isFinite(part))) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    return { hour, minute, second };
}

function toDateFromValue(value: string | undefined, referenceIso?: string): Date | null {
    if (!value) return null;

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const clock = parseClockText(value);
    if (!clock) return null;

    const reference = referenceIso ? new Date(referenceIso) : new Date();
    if (Number.isNaN(reference.getTime())) return null;

    const composed = new Date(reference);
    composed.setHours(clock.hour, clock.minute, clock.second, 0);
    return composed;
}

function calculateElapsedMs(startValue?: string, finishValue?: string): number | null {
    const finishDate = toDateFromValue(finishValue);
    if (!finishDate) return null;

    const startDate = toDateFromValue(startValue, finishDate.toISOString());
    if (!startDate) return null;

    let diff = finishDate.getTime() - startDate.getTime();
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    if (!Number.isFinite(diff) || diff < 0) return null;
    return diff;
}

function formatElapsedMs(ms?: number | null): string | undefined {
    if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) return undefined;
    const totalSeconds = Math.round(Number(ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isRedExitStatus(entry: Partial<Entry> & { resultStatus?: string }): boolean {
    return (
        entry.resultStatus === 'mp'
        || entry.resultStatus === 'dnf'
        || entry.resultStatus === 'dns'
        || entry.resultStatus === 'dsq'
        || entry.status === 'dnf'
        || entry.status === 'dns'
        || entry.status === 'dsq'
    );
}

function calculatePlacement(entries: Entry[], candidate: Entry): { position: number; total: number } | null {
    if (!candidate.classId) return null;

    const merged = entries.map((entry) => (entry.id === candidate.id ? candidate : entry));
    if (!merged.some((entry) => entry.id === candidate.id)) {
        merged.push(candidate);
    }

    const ranked = merged
        .filter((entry) => entry.classId === candidate.classId)
        .filter((entry) => entry.status === 'finished' || entry.resultStatus === 'ok')
        .filter((entry) => !isRedExitStatus(entry))
        .map((entry) => ({
            id: entry.id,
            elapsedMs: calculateElapsedMs(
                (entry as any).actualStartTime || entry.startTime,
                entry.finishTime || (entry as any).resultFinishTime
            ),
        }))
        .filter((item): item is { id: string; elapsedMs: number } => Number.isFinite(Number(item.elapsedMs)) && Number(item.elapsedMs) > 0)
        .sort((left, right) => left.elapsedMs - right.elapsedMs);

    const index = ranked.findIndex((item) => item.id === candidate.id);
    if (index < 0) return null;

    return {
        position: index + 1,
        total: ranked.length,
    };
}

function mergePunch(existing: any[], stationCode: string, readAt: string): any[] {
    const safeExisting = Array.isArray(existing) ? existing : [];
    const last = safeExisting[safeExisting.length - 1];
    if (last?.code === stationCode && typeof last?.time === 'string') {
        const prevMs = new Date(last.time).getTime();
        const nextMs = new Date(readAt).getTime();
        if (Number.isFinite(prevMs) && Number.isFinite(nextMs) && Math.abs(nextMs - prevMs) < 5_000) {
            return safeExisting;
        }
    }

    return [
        ...safeExisting,
        { code: stationCode, time: readAt },
    ];
}

export default function RadioControlPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<FirestoreEvent | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);

    const [deviceId, setDeviceId] = useState('');
    const [config, setConfig] = useState<StationConfig>(DEFAULT_STATION_CONFIG);
    const [liveMode, setLiveMode] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [statusError, setStatusError] = useState<string>('');

    const [batteryLevel, setBatteryLevel] = useState<number | undefined>(undefined);
    const [batteryCharging, setBatteryCharging] = useState<boolean | undefined>(undefined);
    const [heartbeatSeconds, setHeartbeatSeconds] = useState(30);
    const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);

    const [radioDevices, setRadioDevices] = useState<RadioControlDeviceStatus[]>([]);
    const [recentPassages, setRecentPassages] = useState<RadioControlPassage[]>([]);
    const [finishFeedback, setFinishFeedback] = useState<FinishFeedback | null>(null);

    const [manualCardNumber, setManualCardNumber] = useState('');
    const [manualSaving, setManualSaving] = useState(false);

    const [siConnected, setSiConnected] = useState(false);
    const [siReading, setSiReading] = useState(false);
    const [siError, setSiError] = useState('');

    const readerRef = useRef<SportIdentReader | null>(null);
    const shouldReadCardsRef = useRef(false);
    const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

    const thisDeviceStatus = useMemo(
        () => radioDevices.find((item) => item.deviceId === deviceId),
        [radioDevices, deviceId]
    );

    const liveDevices = useMemo(
        () => radioDevices.filter((item) => isRadioControlLive(item)),
        [radioDevices]
    );

    const lowBatteryDevices = useMemo(
        () => radioDevices.filter((item) => Number(item.batteryLevel || 0) > 0 && Number(item.batteryLevel) <= 20),
        [radioDevices]
    );

    const registerPassage = useCallback(async (
        source: RadioPassageSource,
        rawCardNumber: string,
        options?: {
            hasCompleteRead?: boolean;
            punchCount?: number;
            startTime?: string;
            finishTime?: string;
            cardPunches?: Array<{ code: string; time: string }>;
        }
    ) => {
        const cardNumber = normalizeCardNumber(rawCardNumber);
        if (!cardNumber) return;
        if (!deviceId) return;

        const nowIso = new Date().toISOString();
        const normalizedInputCard = cardNumber.toLowerCase();
        const matchedEntry = entries.find((entry) => normalizeEntryCard(entry.siCard) === normalizedInputCard);
        const stationCode = config.stationCode.trim() || 'RADIO';
        const stationName = config.stationName.trim() || undefined;

        await saveRadioControlPassage(eventId, {
            deviceId,
            stationCode,
            stationName,
            masterId: config.masterId.trim() || undefined,
            cardNumber,
            source,
            readAt: nowIso,
            hasCompleteRead: !!options?.hasCompleteRead,
            punchCount: options?.punchCount,
            startTime: options?.startTime,
            finishTime: options?.finishTime,
            entryId: matchedEntry?.id,
            entryName: matchedEntry ? `${matchedEntry.firstName} ${matchedEntry.lastName}`.trim() : undefined,
        });

        if (matchedEntry) {
            const remoteFinishMode = config.mode === 'remote_finish';
            const baseStart = options?.startTime || (matchedEntry as any).actualStartTime || matchedEntry.startTime || nowIso;
            const baseFinish = options?.finishTime || nowIso;
            const derivedPunches = options?.cardPunches && options.cardPunches.length > 0
                ? options.cardPunches
                : mergePunch((matchedEntry as any).punches, stationCode, nowIso);
            const nextStatus = remoteFinishMode
                ? normalizeStatusValue(
                    isRedExitStatus(matchedEntry)
                        ? matchedEntry.status
                        : 'finished'
                )
                : normalizeStatusValue(matchedEntry.status === 'registered' ? 'started' : matchedEntry.status);
            const elapsedMs = remoteFinishMode ? calculateElapsedMs(baseStart, baseFinish) : null;
            const updatedEntry = {
                ...(matchedEntry as any),
                status: nextStatus,
                startTime: baseStart,
                finishTime: remoteFinishMode ? baseFinish : matchedEntry.finishTime,
                punches: derivedPunches,
                runningTime: elapsedMs ?? (matchedEntry as any).runningTime,
                resultTime: elapsedMs ? formatElapsedMs(elapsedMs) : (matchedEntry as any).resultTime,
                resultStatus: remoteFinishMode
                    ? (isRedExitStatus(matchedEntry)
                        ? matchedEntry.resultStatus
                        : 'ok')
                    : matchedEntry.resultStatus,
                updatedAt: nowIso,
            };

            await saveEntry(eventId, updatedEntry);

            if (remoteFinishMode) {
                const placement = calculatePlacement(entries, updatedEntry as Entry);
                const needsRedExit = !options?.hasCompleteRead || isRedExitStatus(updatedEntry);

                setFinishFeedback({
                    tone: needsRedExit ? 'red' : 'ok',
                    headline: needsRedExit ? 'Gå till röd utgång' : 'Godkänd målgång',
                    runnerName: `${matchedEntry.firstName} ${matchedEntry.lastName}`.trim(),
                    timeText: elapsedMs ? formatElapsedMs(elapsedMs) : undefined,
                    placementText: !needsRedExit && placement
                        ? `${placement.position}/${placement.total} i ${matchedEntry.className || 'klass'}`
                        : undefined,
                    detail: needsRedExit
                        ? 'Ofullständig eller avvikande utläsning. Kontrollera i sekretariatet.'
                        : `Kontroll ${stationCode} · ${formatDateTime(baseFinish)}`,
                    shownAt: nowIso,
                });

                setStatusMessage(needsRedExit
                    ? `Målgång registrerad: ${matchedEntry.firstName} ${matchedEntry.lastName} behöver röd utgång.`
                    : `Målgång registrerad: ${matchedEntry.firstName} ${matchedEntry.lastName}.`);
            } else {
                setStatusMessage(`Passering registrerad: ${matchedEntry.firstName} ${matchedEntry.lastName} (${stationCode})`);
            }
        } else {
            if (config.mode === 'remote_finish') {
                setFinishFeedback({
                    tone: 'red',
                    headline: 'Gå till röd utgång',
                    runnerName: `Bricka ${cardNumber}`,
                    detail: 'Ingen anmälan kopplad till brickan. Hantera i sekretariatet.',
                    shownAt: nowIso,
                });
            }
            setStatusMessage(`Passering registrerad för bricka ${cardNumber} (${stationCode})`);
        }

        setStatusError('');
    }, [config.masterId, config.mode, config.stationCode, config.stationName, deviceId, entries, eventId]);

    const handleSICardRead = useCallback(async (card: SICard) => {
        try {
            const cardStart = card.startTime ? card.startTime.toISOString() : undefined;
            const cardFinish = card.finishTime ? card.finishTime.toISOString() : undefined;
            const mappedPunches = Array.isArray(card.punches)
                ? card.punches
                    .filter((punch) => punch?.controlCode)
                    .map((punch) => {
                        const punchDate = punch.timestamp instanceof Date
                            ? punch.timestamp
                            : new Date(punch.timestamp as any);
                        const validTime = !Number.isNaN(punchDate.getTime())
                            ? punchDate.toISOString()
                            : new Date().toISOString();
                        return {
                            code: String(punch.controlCode),
                            time: validTime,
                        };
                    })
                : [];

            await registerPassage('si', card.cardNumber, {
                hasCompleteRead: !!cardFinish || mappedPunches.length > 0,
                punchCount: mappedPunches.length,
                startTime: cardStart,
                finishTime: cardFinish,
                cardPunches: mappedPunches,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'SI-passering kunde inte registreras.';
            setStatusError(message);
            setStatusMessage('');
        }
    }, [registerPassage]);

    const releaseWakeLock = useCallback(async () => {
        const active = wakeLockRef.current;
        if (!active) return;

        try {
            await active.release();
        } catch {
            // No-op
        } finally {
            wakeLockRef.current = null;
        }
    }, []);

    const requestWakeLock = useCallback(async () => {
        const nav = navigator as NavigatorBatteryLike;
        if (!nav.wakeLock?.request) return;
        if (wakeLockRef.current && !wakeLockRef.current.released) return;

        try {
            wakeLockRef.current = await nav.wakeLock.request('screen');
            wakeLockRef.current.addEventListener?.('release', () => {
                wakeLockRef.current = null;
            });
        } catch {
            // Browser blocked wake lock, continue without it.
        }
    }, []);

    const pushHeartbeat = useCallback(async (stateOverride?: RadioControlDeviceStatus['state'], lastError?: string) => {
        if (!eventId || !deviceId) return;

        const nextInterval = computeHeartbeatSeconds({
            mode: config.mode,
            lowPowerMode: config.lowPowerMode,
            batteryLevel,
            charging: batteryCharging,
        });
        setHeartbeatSeconds(nextInterval);

        await saveRadioControlDeviceStatus(eventId, {
            deviceId,
            stationCode: config.stationCode.trim() || undefined,
            stationName: config.stationName.trim() || undefined,
            masterId: config.masterId.trim() || undefined,
            mode: config.mode,
            state: stateOverride || (liveMode ? 'live' : 'idle'),
            batteryLevel,
            charging: batteryCharging,
            heartbeatIntervalSec: nextInterval,
            lastSeenAt: new Date().toISOString(),
            lastError: lastError || undefined,
            appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'web',
        });

        setLastHeartbeatAt(new Date().toISOString());
    }, [batteryCharging, batteryLevel, config.lowPowerMode, config.masterId, config.mode, config.stationCode, config.stationName, deviceId, eventId, liveMode]);

    const stopSIReader = useCallback(async () => {
        shouldReadCardsRef.current = false;
        setSiReading(false);

        if (!readerRef.current) return;
        try {
            await readerRef.current.disconnect();
        } catch {
            // no-op
        } finally {
            setSiConnected(false);
            readerRef.current = null;
        }
    }, []);

    useEffect(() => {
        setDeviceId(ensureDeviceId());
    }, []);

    useEffect(() => {
        if (!eventId) return;
        getEvent(eventId).then(setEvent).catch(() => setEvent(null));

        const unsubscribeEntries = subscribeToEntries(eventId, (nextEntries) => {
            setEntries(nextEntries);
        });
        const unsubscribeDevices = subscribeToRadioControlDevices(eventId, (statuses) => {
            setRadioDevices(statuses);
        });
        const unsubscribePassages = subscribeToRadioControlPassages(eventId, (passages) => {
            setRecentPassages(passages.slice(0, 40));
        }, { limit: 200 });

        return () => {
            unsubscribeEntries?.();
            unsubscribeDevices?.();
            unsubscribePassages?.();
        };
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(stationConfigStorageKey(eventId));
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            setConfig({
                stationCode: String(parsed.stationCode || ''),
                stationName: String(parsed.stationName || ''),
                masterId: String(parsed.masterId || ''),
                mode: parsed.mode === 'remote_finish' ? 'remote_finish' : 'radio_control',
                keepAwake: parsed.keepAwake !== false,
                lowPowerMode: !!parsed.lowPowerMode,
            });
        } catch {
            // ignore invalid saved config
        }
    }, [eventId]);

    useEffect(() => {
        if (!eventId || typeof window === 'undefined') return;
        localStorage.setItem(stationConfigStorageKey(eventId), JSON.stringify(config));
    }, [config, eventId]);

    useEffect(() => {
        const nav = navigator as NavigatorBatteryLike;
        if (!nav.getBattery) return;

        let batteryRef: BatteryManagerLike | null = null;
        let mounted = true;

        const updateBatteryState = () => {
            if (!batteryRef || !mounted) return;
            setBatteryLevel(Math.round((batteryRef.level || 0) * 100));
            setBatteryCharging(!!batteryRef.charging);
        };

        nav.getBattery().then((battery) => {
            if (!mounted) return;
            batteryRef = battery;
            updateBatteryState();
            battery.addEventListener('levelchange', updateBatteryState);
            battery.addEventListener('chargingchange', updateBatteryState);
        }).catch(() => {
            // Battery API unsupported or blocked.
        });

        return () => {
            mounted = false;
            if (batteryRef) {
                batteryRef.removeEventListener('levelchange', updateBatteryState);
                batteryRef.removeEventListener('chargingchange', updateBatteryState);
            }
        };
    }, []);

    useEffect(() => {
        setHeartbeatSeconds(computeHeartbeatSeconds({
            mode: config.mode,
            lowPowerMode: config.lowPowerMode,
            batteryLevel,
            charging: batteryCharging,
        }));
    }, [batteryCharging, batteryLevel, config.lowPowerMode, config.mode]);

    useEffect(() => {
        if (config.mode !== 'remote_finish') return;
        if (config.keepAwake) return;
        setConfig((prev) => ({ ...prev, keepAwake: true }));
    }, [config.keepAwake, config.mode]);

    useEffect(() => {
        if (!finishFeedback) return;
        const timer = setTimeout(() => {
            setFinishFeedback((current) => {
                if (!current) return null;
                if (current.shownAt !== finishFeedback.shownAt) return current;
                return null;
            });
        }, 20_000);
        return () => clearTimeout(timer);
    }, [finishFeedback]);

    useEffect(() => {
        if (!liveMode) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const loop = async () => {
            if (cancelled) return;
            try {
                await pushHeartbeat('live');
            } catch (error) {
                console.error('Heartbeat failed:', error);
            } finally {
                if (!cancelled) {
                    timer = setTimeout(loop, heartbeatSeconds * 1000);
                }
            }
        };

        loop();

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && config.keepAwake) {
                void requestWakeLock();
            }
            void pushHeartbeat('live');
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('online', onVisibilityChange);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('online', onVisibilityChange);
        };
    }, [config.keepAwake, heartbeatSeconds, liveMode, pushHeartbeat, requestWakeLock]);

    useEffect(() => {
        if (!liveMode || !config.keepAwake) {
            void releaseWakeLock();
            return;
        }

        void requestWakeLock();
        return () => {
            void releaseWakeLock();
        };
    }, [config.keepAwake, liveMode, releaseWakeLock, requestWakeLock]);

    useEffect(() => {
        return () => {
            void stopSIReader();
            void releaseWakeLock();
        };
    }, [releaseWakeLock, stopSIReader]);

    const handleStartLiveMode = async () => {
        if (!deviceId) return;
        setLiveMode(true);
        setStatusError('');
        setStatusMessage('Radiokontrollläge aktivt. Stationen skickar heartbeat automatiskt.');
        await pushHeartbeat('live');
    };

    const handleStopLiveMode = async () => {
        setLiveMode(false);
        await pushHeartbeat('offline');
        setStatusMessage('Radiokontrollläge stoppat.');
        setStatusError('');
        await stopSIReader();
    };

    const handleConnectSI = async () => {
        setSiError('');

        if (!SportIdentReader.isSupported()) {
            setSiError('Web Serial stöds inte. Använd Chrome/Edge på en enhet med serial/Bluetooth-stöd.');
            return;
        }

        try {
            const reader = new SportIdentReader();
            await reader.connect();
            readerRef.current = reader;
            shouldReadCardsRef.current = true;
            setSiConnected(true);
            setSiReading(true);

            (async () => {
                try {
                    for await (const card of reader.watchCards()) {
                        if (!shouldReadCardsRef.current) break;
                        await handleSICardRead(card);
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'SI-läsning avbröts.';
                    setSiError(message);
                    await pushHeartbeat('error', message);
                } finally {
                    setSiReading(false);
                }
            })();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kunde inte ansluta SI-station.';
            setSiError(message);
            await pushHeartbeat('error', message);
        }
    };

    const handleManualSubmit = async (eventValue: React.FormEvent) => {
        eventValue.preventDefault();
        if (!manualCardNumber.trim()) return;

        try {
            setManualSaving(true);
            await registerPassage('manual', manualCardNumber);
            setManualCardNumber('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kunde inte registrera passering.';
            setStatusError(message);
            setStatusMessage('');
        } finally {
            setManualSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <Link href={`/admin/events/${eventId}`} className="text-xs text-slate-500 hover:text-emerald-400 font-bold uppercase tracking-widest">
                        ← Tillbaka till eventadmin
                    </Link>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">Radiokontrollstation</h1>
                            <p className="text-slate-400 text-sm mt-1">{event?.name || 'Laddar tävling...'} · Event ID {eventId}</p>
                        </div>
                        <div className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${liveMode
                            ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                            {liveMode ? 'Live-läge aktivt' : 'Live-läge av'}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                {config.mode === 'remote_finish' && finishFeedback && (
                    <div className={`rounded-2xl border px-5 py-4 ${finishFeedback.tone === 'ok'
                        ? 'bg-emerald-900/20 border-emerald-700/50'
                        : finishFeedback.tone === 'warn'
                            ? 'bg-amber-900/20 border-amber-700/50'
                            : 'bg-red-900/20 border-red-700/50'
                        }`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-widest font-bold text-slate-300">Målkvitto</p>
                                <h2 className="text-2xl font-black mt-1">{finishFeedback.headline}</h2>
                                {finishFeedback.runnerName && (
                                    <p className="text-sm text-slate-200 mt-1">{finishFeedback.runnerName}</p>
                                )}
                            </div>
                            <div className="text-right">
                                {finishFeedback.timeText && (
                                    <p className="text-xl font-black text-white">{finishFeedback.timeText}</p>
                                )}
                                {finishFeedback.placementText && (
                                    <p className="text-sm text-emerald-200 mt-1">{finishFeedback.placementText}</p>
                                )}
                            </div>
                        </div>
                        {finishFeedback.detail && (
                            <p className="text-xs text-slate-300 mt-3">{finishFeedback.detail}</p>
                        )}
                    </div>
                )}

                <div className="grid md:grid-cols-5 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Enhet</div>
                        <div className="text-xs font-mono text-white mt-2 break-all">{deviceId || 'laddar...'}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Heartbeat</div>
                        <div className="text-lg font-black text-emerald-400 mt-2">{heartbeatSeconds}s</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Batteri</div>
                        <div className="text-lg font-black text-white mt-2">{formatBattery(batteryLevel, batteryCharging)}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live-enheter</div>
                        <div className="text-lg font-black text-emerald-400 mt-2">{liveDevices.length}</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lågt batteri</div>
                        <div className={`text-lg font-black mt-2 ${lowBatteryDevices.length > 0 ? 'text-amber-400' : 'text-white'}`}>
                            {lowBatteryDevices.length}
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
                    <section className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Stationskonfiguration</h2>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <label className={`rounded-lg border px-3 py-2 text-xs ${config.mode === 'radio_control' ? 'border-emerald-600 bg-emerald-900/20' : 'border-slate-700'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-300">Radiokontroll</span>
                                        <input
                                            type="radio"
                                            name="station-mode"
                                            checked={config.mode === 'radio_control'}
                                            onChange={() => setConfig((prev) => ({ ...prev, mode: 'radio_control' }))}
                                            className="w-4 h-4"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Mellanpasseringar och speakerdata.</p>
                                </label>
                                <label className={`rounded-lg border px-3 py-2 text-xs ${config.mode === 'remote_finish' ? 'border-emerald-600 bg-emerald-900/20' : 'border-slate-700'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-300">Skogsmål remote</span>
                                        <input
                                            type="radio"
                                            name="station-mode"
                                            checked={config.mode === 'remote_finish'}
                                            onChange={() => setConfig((prev) => ({ ...prev, mode: 'remote_finish' }))}
                                            className="w-4 h-4"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Visar tid/placering eller röd utgång direkt i mobilen.</p>
                                </label>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <label className="text-xs text-slate-400">
                                    Kontrollkod
                                    <input
                                        value={config.stationCode}
                                        onChange={(eventValue) => setConfig((prev) => ({ ...prev, stationCode: eventValue.target.value }))}
                                        placeholder="t.ex. 67"
                                        className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                                    />
                                </label>
                                <label className="text-xs text-slate-400">
                                    Stationsnamn
                                    <input
                                        value={config.stationName}
                                        onChange={(eventValue) => setConfig((prev) => ({ ...prev, stationName: eventValue.target.value }))}
                                        placeholder="Radio 1 - långsträckan"
                                        className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                                    />
                                </label>
                            </div>
                            <label className="block text-xs text-slate-400">
                                Master-ID (valfritt)
                                <input
                                    value={config.masterId}
                                    onChange={(eventValue) => setConfig((prev) => ({ ...prev, masterId: eventValue.target.value }))}
                                    placeholder="t.ex. MASTER-A"
                                    className="mt-1 w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                                />
                            </label>

                            <div className="grid sm:grid-cols-2 gap-3">
                                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 px-3 py-2 text-xs">
                                    <span className="text-slate-300">Håll skärmen vaken</span>
                                    <input
                                        type="checkbox"
                                        checked={config.keepAwake}
                                        onChange={(eventValue) => setConfig((prev) => ({ ...prev, keepAwake: eventValue.target.checked }))}
                                        disabled={config.mode === 'remote_finish'}
                                        className="w-4 h-4"
                                    />
                                </label>
                                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 px-3 py-2 text-xs">
                                    <span className="text-slate-300">Batterisparläge</span>
                                    <input
                                        type="checkbox"
                                        checked={config.lowPowerMode}
                                        onChange={(eventValue) => setConfig((prev) => ({ ...prev, lowPowerMode: eventValue.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {!liveMode ? (
                                    <button
                                        onClick={handleStartLiveMode}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold uppercase tracking-widest"
                                    >
                                        {config.mode === 'remote_finish' ? 'Starta skogsmål remote' : 'Starta radiokontrollläge'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStopLiveMode}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold uppercase tracking-widest"
                                    >
                                        {config.mode === 'remote_finish' ? 'Stoppa skogsmål remote' : 'Stoppa radiokontrollläge'}
                                    </button>
                                )}
                                <button
                                    onClick={() => void pushHeartbeat(liveMode ? 'live' : 'idle')}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase tracking-widest"
                                >
                                    Skicka heartbeat nu
                                </button>
                            </div>

                            <div className="text-xs text-slate-500">
                                Senaste heartbeat: {formatDateTime(lastHeartbeatAt || thisDeviceStatus?.lastSeenAt)}
                            </div>
                            {config.mode === 'remote_finish' && (
                                <p className="text-[11px] text-emerald-200/90">
                                    Skärmen hålls vaken i detta läge så löparen direkt ser godkänd tid/placering eller röd utgång.
                                </p>
                            )}
                            {statusMessage && <p className="text-xs text-emerald-300">{statusMessage}</p>}
                            {statusError && <p className="text-xs text-red-300">{statusError}</p>}
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">SI-läsning och passeringar</h2>

                            <div className="flex flex-wrap items-center gap-3">
                                {!siConnected ? (
                                    <button
                                        onClick={() => void handleConnectSI()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold uppercase tracking-widest"
                                    >
                                        Anslut SI-station
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => void stopSIReader()}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase tracking-widest"
                                    >
                                        Koppla från SI-station
                                    </button>
                                )}
                                <span className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-widest font-bold ${siConnected
                                    ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}>
                                    {siConnected ? (siReading ? 'SI online' : 'SI ansluten') : 'SI frånkopplad'}
                                </span>
                            </div>
                            {siError && <p className="text-xs text-red-300">{siError}</p>}

                            <form onSubmit={handleManualSubmit} className="flex flex-wrap gap-2">
                                <input
                                    value={manualCardNumber}
                                    onChange={(eventValue) => setManualCardNumber(eventValue.target.value)}
                                    placeholder={config.mode === 'remote_finish'
                                        ? 'Manuell målgång: bricknummer'
                                        : 'Manuell bricka, t.ex. 720123'}
                                    className="flex-1 min-w-[220px] px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={manualSaving || !manualCardNumber.trim()}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                                >
                                    {config.mode === 'remote_finish' ? 'Registrera mål manuellt' : 'Registrera manuellt'}
                                </button>
                            </form>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Live-status radiokontroller</h2>
                            {radioDevices.length === 0 ? (
                                <p className="text-sm text-slate-500">Inga radiokontroller rapporterar ännu.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {radioDevices.map((device) => {
                                        const live = isRadioControlLive(device);
                                        return (
                                            <div key={device.deviceId} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm text-white truncate">{device.stationName || device.stationCode || device.deviceId}</p>
                                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${live
                                                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                        {live ? 'Live' : 'Ej live'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Batteri {formatBattery(device.batteryLevel, device.charging)} · senast {formatDateTime(device.lastSeenAt)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Senaste passeringar</h2>
                            {recentPassages.length === 0 ? (
                                <p className="text-sm text-slate-500">Inga passeringar registrerade ännu.</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                    {recentPassages.slice(0, 30).map((passage) => (
                                        <div key={passage.id} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm text-white">Bricka {passage.cardNumber}</p>
                                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                                                    {passage.source === 'manual' ? 'manuell' : 'si'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {passage.stationCode || 'RADIO'} · {passage.entryName || 'okänd löpare'} · {formatDateTime(passage.readAt)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-200">
                            <p className="font-bold uppercase tracking-widest text-[10px] mb-2">Batteritips för flera timmar drift</p>
                            <ul className="space-y-1 text-blue-200/80">
                                <li>• Aktivera batterisparläge i appen när stationen står länge utan passeringar.</li>
                                <li>• Sänk skärmens ljusstyrka och använd skärmlås-av med extern powerbank.</li>
                                <li>• Kör stationen i denna vy utan tunga kartlager för lägre data- och batteriförbrukning.</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
