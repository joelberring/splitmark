'use client';

import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import ParticipantSettings from '@/components/Admin/ParticipantSettings';
import type { EventParticipantSettings } from '@/types/race';
import { EventData, saveEvent } from './shared';

interface ParticipantsTabProps {
    event: EventData;
    setEvent: (e: EventData) => void;
}

export default function ParticipantsTab({ event, setEvent }: ParticipantsTabProps) {
    const settings: EventParticipantSettings = (event as any).participantSettings || {
        requireCheckin: false,
        checkinDeadlineMinutes: 30,
        autoMarkDns: false,
        primaryStartMethod: 'startlist',
        allowManualStart: false,
        manualStartWindowMinutes: 5,
        mapReleaseType: 'all_started',
        mapReleasePercentage: 80,
        isMapReleased: false,
        allowGpsUpload: true,
        showGpsBeforeMapRelease: false,
        showClubMates: true,
        showStartLocation: true,
    };

    const handleSettingsChange = (newSettings: EventParticipantSettings) => {
        const updated = { ...event, participantSettings: newSettings };
        setEvent(updated);
        saveEvent(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Deltagarläge<HelpButton topic="results" size="sm" /></h2>
                <Link href={`/race/${event.id}`} target="_blank" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-500">📱 Öppna deltagarvy</Link>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                <p className="text-sm text-blue-300/70">
                    <strong className="text-blue-400">💡 Tips:</strong> Dela länken <code className="bg-blue-900 px-1 rounded text-blue-300">/race/{event.id}</code> med deltagarna.
                </p>
            </div>

            <ParticipantSettings settings={settings} onChange={handleSettingsChange} />
        </div>
    );
}
