'use client';

import { useState } from 'react';
import type { EventParticipantSettings, MapReleaseType, StartMethod } from '@/types/race';

interface ParticipantSettingsProps {
    settings: EventParticipantSettings;
    onChange: (settings: EventParticipantSettings) => void;
}

export default function ParticipantSettings({ settings, onChange }: ParticipantSettingsProps) {
    const update = (partial: Partial<EventParticipantSettings>) => {
        onChange({ ...settings, ...partial });
    };

    return (
        <div className="space-y-6">
            {/* Check-in Settings */}
            <SettingSection title="📝 Incheckning" description="Kräv att deltagare checkar in innan tävling">
                <ToggleSetting
                    label="Kräv incheckning"
                    description="Deltagare måste bekräfta deltagande innan start"
                    checked={settings.requireCheckin}
                    onChange={(checked) => update({ requireCheckin: checked })}
                />

                {settings.requireCheckin && (
                    <>
                        <NumberSetting
                            label="Deadline (minuter före start)"
                            value={settings.checkinDeadlineMinutes}
                            onChange={(value) => update({ checkinDeadlineMinutes: value })}
                            min={5}
                            max={120}
                        />

                        <ToggleSetting
                            label="Automatisk DNS"
                            description="Markera som DNS om ej incheckat vid deadline"
                            checked={settings.autoMarkDns}
                            onChange={(checked) => update({ autoMarkDns: checked })}
                        />
                    </>
                )}
            </SettingSection>

            {/* Start Settings */}
            <SettingSection title="🏃 Start" description="Hur starttider registreras">
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Primär startmetod
                    </label>
                    <select
                        value={settings.primaryStartMethod}
                        onChange={(e) => update({ primaryStartMethod: e.target.value as StartMethod })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                        <option value="startlist">Startlista (fördefinierade tider)</option>
                        <option value="si_punch">SI-startstämpling</option>
                        <option value="manual">Manuell start</option>
                    </select>
                </div>

                <ToggleSetting
                    label="Tillåt manuell start"
                    description="Deltagare kan starta manuellt via appen"
                    checked={settings.allowManualStart}
                    onChange={(checked) => update({ allowManualStart: checked })}
                />

                {settings.allowManualStart && (
                    <NumberSetting
                        label="Startfönster (±minuter)"
                        description="Hur länge före/efter planerad tid manuell start tillåts"
                        value={settings.manualStartWindowMinutes}
                        onChange={(value) => update({ manualStartWindowMinutes: value })}
                        min={1}
                        max={30}
                    />
                )}
            </SettingSection>

            {/* Map Release Settings */}
            <SettingSection title="🗺️ Kartsläppning" description="När orienteringskartan blir tillgänglig">
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Släpp karta
                    </label>
                    <select
                        value={settings.mapReleaseType}
                        onChange={(e) => update({ mapReleaseType: e.target.value as MapReleaseType })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                        <option value="all_started">När alla i klassen startat</option>
                        <option value="time_based">Tid efter sista start</option>
                        <option value="percentage_finished">När X% gått i mål</option>
                        <option value="manual">Manuellt (tävlingsledare)</option>
                        <option value="immediate">Direkt (träning)</option>
                    </select>
                </div>

                {settings.mapReleaseType === 'time_based' && (
                    <NumberSetting
                        label="Minuter efter sista start"
                        value={settings.mapReleaseMinutes || 60}
                        onChange={(value) => update({ mapReleaseMinutes: value })}
                        min={0}
                        max={240}
                    />
                )}

                {settings.mapReleaseType === 'percentage_finished' && (
                    <NumberSetting
                        label="Procent i mål"
                        value={settings.mapReleasePercentage || 80}
                        onChange={(value) => update({ mapReleasePercentage: value })}
                        min={10}
                        max={100}
                        suffix="%"
                    />
                )}

                {settings.isMapReleased && (
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-700 dark:text-emerald-300 text-sm">
                        ✓ Kartan är släppt
                        {settings.mapReleasedAt && (
                            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                ({new Date(settings.mapReleasedAt).toLocaleTimeString('sv-SE')})
                            </span>
                        )}
                    </div>
                )}

                {!settings.isMapReleased && settings.mapReleaseType === 'manual' && (
                    <button
                        onClick={() => update({
                            isMapReleased: true,
                            mapReleasedAt: new Date().toISOString()
                        })}
                        className="w-full py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                    >
                        Släpp kartan nu
                    </button>
                )}
            </SettingSection>

            {/* GPS Settings */}
            <SettingSection title="📍 GPS & Spår" description="GPS-spårhantering efter tävling">
                <ToggleSetting
                    label="Tillåt GPS-upload"
                    description="Deltagare kan ladda upp GPS-spår efter mål"
                    checked={settings.allowGpsUpload}
                    onChange={(checked) => update({ allowGpsUpload: checked })}
                />

                <ToggleSetting
                    label="Visa GPS före kartsläpp"
                    description="Deltagare kan se sina spår innan kartan släppts"
                    checked={settings.showGpsBeforeMapRelease}
                    onChange={(checked) => update({ showGpsBeforeMapRelease: checked })}
                />
            </SettingSection>

            {/* Display Settings */}
            <SettingSection title="👁️ Visning" description="Vad deltagare ser före start">
                <ToggleSetting
                    label="Visa klubbkompisar"
                    description="Lista andra deltagare från samma klubb"
                    checked={settings.showClubMates}
                    onChange={(checked) => update({ showClubMates: checked })}
                />

                <ToggleSetting
                    label="Visa startplats"
                    description="Visa information om startplatsen"
                    checked={settings.showStartLocation}
                    onChange={(checked) => update({ showStartLocation: checked })}
                />
            </SettingSection>
        </div>
    );
}

// ============ Sub-components ============

function SettingSection({
    title,
    description,
    children
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function ToggleSetting({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex-shrink-0 mt-1">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="w-5 h-5 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                />
            </div>
            <div>
                <div className="font-medium text-gray-800 dark:text-gray-100">{label}</div>
                {description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
                )}
            </div>
        </label>
    );
}

function NumberSetting({
    label,
    description,
    value,
    onChange,
    min = 0,
    max = 999,
    suffix,
}: {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    suffix?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
            </label>
            {description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{description}</p>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value) || min)}
                    min={min}
                    max={max}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
                {suffix && <span className="text-gray-500">{suffix}</span>}
            </div>
        </div>
    );
}
