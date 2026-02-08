'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    flushOfflineActions,
    getOfflineActionsForEvent,
    getOfflineQueueSummary,
    retryFailedOfflineActions,
    startOfflineQueueAutoFlush,
    subscribeOfflineQueue,
    type OfflineActionRecord,
    type OfflineQueueSummary,
} from '@/lib/offline/action-queue';
import {
    isRadioControlLive,
    subscribeToRadioControlDevices,
    type RadioControlDeviceStatus,
} from '@/lib/firestore/radio-controls';
import type { EventData } from './shared';

interface OperationsTabProps {
    event: EventData;
}

interface StationLink {
    id: string;
    name: string;
    description: string;
    href: string;
    icon: string;
    roles: string;
}

function formatTimestamp(value?: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('sv-SE', { hour12: false });
}

function actionStatusLabel(action: OfflineActionRecord): string {
    if (action.status === 'syncing') return 'Synkar';
    if (action.status === 'failed') return 'Fel';
    if (action.attempts > 0) return `Väntar (försök ${action.attempts})`;
    return 'Köad';
}

function actionStatusClass(action: OfflineActionRecord): string {
    if (action.status === 'syncing') {
        return 'bg-blue-900/30 text-blue-300 border border-blue-700/40';
    }
    if (action.status === 'failed') {
        return 'bg-red-900/30 text-red-300 border border-red-700/40';
    }
    return 'bg-amber-900/20 text-amber-200 border border-amber-700/40';
}

export default function OperationsTab({ event }: OperationsTabProps) {
    const [queueSummary, setQueueSummary] = useState<OfflineQueueSummary>(() =>
        getOfflineQueueSummary(event.id)
    );
    const [queuedActions, setQueuedActions] = useState<OfflineActionRecord[]>(() =>
        getOfflineActionsForEvent(event.id)
    );
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator === 'undefined' ? true : navigator.onLine
    );
    const [syncingNow, setSyncingNow] = useState(false);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string>('');
    const [radioDevices, setRadioDevices] = useState<RadioControlDeviceStatus[]>([]);

    const stations: StationLink[] = useMemo(
        () => [
            {
                id: 'secretariat',
                name: 'Sekretariat',
                description: 'Anmälningar, brickkopplingar, sena ändringar och klubbadministration på arenan.',
                href: `/admin/events/${event.id}/entries`,
                icon: '🗂️',
                roles: 'Sekretariat, tävlingsledning',
            },
            {
                id: 'finish',
                name: 'Målgång & Tidtagning',
                description: 'SI-läsning, manuell backup, målstämpling och justering av resultatstatus.',
                href: `/admin/events/${event.id}?tab=timing`,
                icon: '⏱️',
                roles: 'Målpersonal, tidtagning',
            },
            {
                id: 'speaker',
                name: 'Speaker',
                description: 'Skicka live-kommentarer med kö-stöd om internet går ner tillfälligt.',
                href: `/admin/events/${event.id}/speaker`,
                icon: '🎤',
                roles: 'Speaker, media',
            },
            {
                id: 'red-exit',
                name: 'Röd Utgång / Saknade',
                description: 'Överblick av löpare kvar i skogen, kritiska tider och kontaktuppföljning.',
                href: `/admin/events/${event.id}?tab=safety`,
                icon: '🚩',
                roles: 'Säkerhetsansvarig, tävlingsledning',
            },
            {
                id: 'radio',
                name: 'Radiokontroll',
                description: 'Kör mobiler i radioläge med heartbeat, batteriövervakning och livepasseringar.',
                href: `/admin/events/${event.id}/radio-control`,
                icon: '📡',
                roles: 'Radiokontroller, speakerstöd',
            },
            {
                id: 'results',
                name: 'Resultat & Export',
                description: 'Korrigera resultat, publicera klasser och exportera enligt tävlingsformat.',
                href: `/admin/events/${event.id}/results`,
                icon: '🏆',
                roles: 'Sekretariat, resultatansvarig',
            },
        ],
        [event.id]
    );

    const startedCount = useMemo(
        () => event.entries.filter((entry) => !!entry.startTime && !entry.finishTime).length,
        [event.entries]
    );

    const finishedCount = useMemo(
        () => event.entries.filter((entry) => !!entry.finishTime || entry.status === 'finished').length,
        [event.entries]
    );

    const pendingCount = queueSummary.pending + queueSummary.syncing;
    const liveRadioCount = useMemo(
        () => radioDevices.filter((device) => isRadioControlLive(device)).length,
        [radioDevices]
    );
    const lowBatteryRadioCount = useMemo(
        () => radioDevices.filter((device) => Number(device.batteryLevel || 0) > 0 && Number(device.batteryLevel) <= 20).length,
        [radioDevices]
    );

    useEffect(() => {
        startOfflineQueueAutoFlush();

        const unsubscribe = subscribeOfflineQueue((summary, actions) => {
            setQueueSummary(summary);
            setQueuedActions(actions);
        }, event.id);
        const unsubscribeRadio = subscribeToRadioControlDevices(event.id, (devices) => {
            setRadioDevices(devices);
        });

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsubscribe();
            unsubscribeRadio();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [event.id]);

    const handleSyncNow = async () => {
        setSyncingNow(true);
        setSyncMessage('');

        try {
            const summary = await flushOfflineActions({ eventId: event.id, includeFailed: true });
            setLastSyncAt(new Date().toISOString());

            if (summary.failed > 0) {
                setSyncMessage('Vissa åtgärder kunde inte synkas. Kontrollera fellistan nedan.');
            } else if (summary.pending > 0) {
                setSyncMessage('Synk pågår fortfarande i bakgrunden.');
            } else {
                setSyncMessage('Alla köade åtgärder är synkade.');
            }
        } catch (error) {
            setSyncMessage(error instanceof Error ? error.message : 'Kunde inte starta synk.');
        } finally {
            setSyncingNow(false);
        }
    };

    const handleRetryFailed = async () => {
        retryFailedOfflineActions(event.id);
        await handleSyncNow();
    };

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-5 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Anmälda</div>
                    <div className="text-2xl font-black text-white mt-2">{event.entries.length}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ute i skogen</div>
                    <div className={`text-2xl font-black mt-2 ${startedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {startedCount}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">I mål</div>
                    <div className="text-2xl font-black text-emerald-400 mt-2">{finishedCount}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Köade skrivningar</div>
                    <div className={`text-2xl font-black mt-2 ${pendingCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                        {pendingCount}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Radiokontroller live</div>
                    <div className={`text-2xl font-black mt-2 ${liveRadioCount > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {liveRadioCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                        {lowBatteryRadioCount > 0 ? `${lowBatteryRadioCount} med låg batterinivå` : 'Inga låga batterier'}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Synkstatus & drift</h2>
                        <p className="text-xs text-slate-500 mt-1">Stationerna fortsätter lokalt vid avbrott och synkar när nät finns igen.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${isOnline
                            ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                            : 'bg-amber-900/30 text-amber-300 border-amber-700/40'
                            }`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </div>
                        <button
                            onClick={handleSyncNow}
                            disabled={syncingNow}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {syncingNow ? 'Synkar…' : 'Synka nu'}
                        </button>
                        {queueSummary.failed > 0 && (
                            <button
                                onClick={handleRetryFailed}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-amber-500"
                            >
                                Försök igen
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3 mt-4 text-xs">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">Pending</div>
                        <div className="text-white font-bold mt-1">{queueSummary.pending}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">Syncing</div>
                        <div className="text-white font-bold mt-1">{queueSummary.syncing}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">Failed</div>
                        <div className={`font-bold mt-1 ${queueSummary.failed > 0 ? 'text-red-400' : 'text-white'}`}>{queueSummary.failed}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">Senaste sync</div>
                        <div className="text-white font-bold mt-1">{formatTimestamp(lastSyncAt || undefined)}</div>
                    </div>
                </div>

                {(syncMessage || queueSummary.nextRetryAt) && (
                    <div className="mt-3 text-xs text-slate-400 space-y-1">
                        {syncMessage && <p>{syncMessage}</p>}
                        {queueSummary.nextRetryAt && (
                            <p>Nästa automatiska försök: {formatTimestamp(queueSummary.nextRetryAt)}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Radiokontroller (live/batteri)</h3>
                    <Link
                        href={`/admin/events/${event.id}/radio-control`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white"
                    >
                        Öppna radiostation
                    </Link>
                </div>
                {radioDevices.length === 0 ? (
                    <p className="text-sm text-slate-500">Inga radiokontroller rapporterar ännu.</p>
                ) : (
                    <div className="space-y-2">
                        {radioDevices.slice(0, 8).map((device) => {
                            const isLive = isRadioControlLive(device);
                            return (
                                <div key={device.deviceId} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{device.stationName || device.stationCode || device.deviceId}</p>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            Batteri {Number.isFinite(Number(device.batteryLevel))
                                                ? `${Math.round(Number(device.batteryLevel))}%${device.charging ? ' (laddar)' : ''}`
                                                : 'okänt'} · senast {formatTimestamp(device.lastSeenAt)}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${isLive
                                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                        {isLive ? 'Live' : 'Offline'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {stations.map((station) => (
                    <Link
                        key={station.id}
                        href={station.href}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-700/50 hover:bg-slate-900/80 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">{station.icon}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Öppna station</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mt-3">{station.name}</h3>
                        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{station.description}</p>
                        <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-bold">{station.roles}</p>
                    </Link>
                ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Köade åtgärder för detta event</h3>
                {queuedActions.length === 0 ? (
                    <p className="text-sm text-slate-500">Inga köade skrivningar just nu.</p>
                ) : (
                    <div className="space-y-2">
                        {queuedActions.slice(0, 12).map((action) => (
                            <div key={action.id} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-white truncate">{action.context?.label || action.type}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {action.type} · skapad {formatTimestamp(action.createdAt)}
                                        {action.lastError ? ` · fel: ${action.lastError}` : ''}
                                    </p>
                                </div>
                                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${actionStatusClass(action)}`}>
                                    {actionStatusLabel(action)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
