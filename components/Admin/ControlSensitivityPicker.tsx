'use client';

import { useState, useEffect } from 'react';
import type { Control } from '@/types/course';
import type { SensitivityLevel, GPSModeSettings } from '@/types/virtual-controls';
import { SENSITIVITY_RADII, getControlRadius } from '@/types/virtual-controls';

interface ControlSensitivityPickerProps {
    /** Current GPS mode settings for the course */
    settings: GPSModeSettings;
    /** Callback when settings change */
    onSettingsChange: (settings: GPSModeSettings) => void;
    /** Controls to configure (optional - for per-control settings) */
    controls?: Control[];
    /** Callback when a control's radius changes */
    onControlRadiusChange?: (controlId: string, radius: number | undefined) => void;
}

const PRESET_OPTIONS: { id: SensitivityLevel; label: string; description: string }[] = [
    { id: 'exact', label: 'Exakt (10m)', description: 'Kräver bra GPS och exakt geo-referering' },
    { id: 'standard', label: 'Standard (20m)', description: 'Balans mellan precision och tolerans' },
    { id: 'relaxed', label: 'Avslappnad (35m)', description: 'För täta skogar eller äldre kartor' },
    { id: 'custom', label: 'Egen radie', description: 'Ställ in valfri radie' },
];

/**
 * Admin component for configuring GPS virtual punch sensitivity
 * Supports both course-wide and per-control settings
 */
export default function ControlSensitivityPicker({
    settings,
    onSettingsChange,
    controls,
    onControlRadiusChange,
}: ControlSensitivityPickerProps) {
    const [showPerControl, setShowPerControl] = useState(false);
    const [customRadius, setCustomRadius] = useState(settings.customRadius || 25);

    // Update custom radius when settings change
    useEffect(() => {
        if (settings.customRadius) {
            setCustomRadius(settings.customRadius);
        }
    }, [settings.customRadius]);

    const handleSensitivityChange = (level: SensitivityLevel) => {
        onSettingsChange({
            ...settings,
            sensitivity: level,
            customRadius: level === 'custom' ? customRadius : undefined,
        });
    };

    const handleCustomRadiusChange = (radius: number) => {
        setCustomRadius(radius);
        if (settings.sensitivity === 'custom') {
            onSettingsChange({
                ...settings,
                customRadius: radius,
            });
        }
    };

    const handleToggleGPSMode = (enabled: boolean) => {
        onSettingsChange({
            ...settings,
            enabled,
        });
    };

    const getCurrentRadius = (): number => {
        if (settings.sensitivity === 'custom') {
            return customRadius;
        }
        return SENSITIVITY_RADII[settings.sensitivity];
    };

    return (
        <div className="space-y-6">
            {/* Enable GPS mode toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                        GPS-läge (virtuella kontroller)
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Låt deltagare stämpla via GPS istället för fysiska kontroller
                    </p>
                </div>
                <button
                    onClick={() => handleToggleGPSMode(!settings.enabled)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${settings.enabled
                            ? 'bg-emerald-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                >
                    <div
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {settings.enabled && (
                <>
                    {/* Sensitivity presets */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Standardkänslighet för banan
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            {PRESET_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSensitivityChange(option.id)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${settings.sensitivity === option.id
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                                        }`}
                                >
                                    <div className="font-semibold text-gray-800 dark:text-gray-100">
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        {option.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom radius slider */}
                    {settings.sensitivity === 'custom' && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Egen radie
                                </span>
                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {customRadius} m
                                </span>
                            </div>
                            <input
                                type="range"
                                min={5}
                                max={50}
                                value={customRadius}
                                onChange={(e) => handleCustomRadiusChange(parseInt(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>5m (exakt)</span>
                                <span>50m (mycket avslappnad)</span>
                            </div>
                        </div>
                    )}

                    {/* Visual radius preview */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {/* Control symbol */}
                                <div className="w-16 h-16 rounded-full border-4 border-orange-500 bg-white dark:bg-gray-800 flex items-center justify-center">
                                    <span className="text-orange-500 text-xl font-bold">31</span>
                                </div>
                                {/* Radius circle */}
                                <div
                                    className="absolute border-2 border-dashed border-emerald-500 rounded-full pointer-events-none"
                                    style={{
                                        width: `${Math.min(getCurrentRadius() * 3, 120)}px`,
                                        height: `${Math.min(getCurrentRadius() * 3, 120)}px`,
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                    }}
                                />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                    Stämplingsradie: {getCurrentRadius()}m
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                    {getCurrentRadius() < 15
                                        ? '⚠️ Kan kräva exakt GPS-position'
                                        : getCurrentRadius() < 25
                                            ? '✓ Bra balans för de flesta terränger'
                                            : '✓ Fungerar även med sämre GPS-signal'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Per-control settings */}
                    {controls && controls.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowPerControl(!showPerControl)}
                                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600"
                            >
                                <span>{showPerControl ? '▼' : '▶'}</span>
                                <span>Justera enskilda kontroller ({controls.length} st)</span>
                            </button>

                            {showPerControl && (
                                <div className="mt-4 space-y-3">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Lämna tomt för att använda standardradien. Justera om kartan har dålig geo-referering för vissa kontroller.
                                    </div>
                                    {controls
                                        .filter((c) => c.type === 'control')
                                        .map((control) => (
                                            <ControlRadiusRow
                                                key={control.id}
                                                control={control}
                                                defaultRadius={getCurrentRadius()}
                                                onChange={(radius) =>
                                                    onControlRadiusChange?.(control.id, radius)
                                                }
                                            />
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info box */}
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2 text-sm">
                            💡 Tips för geo-referering
                        </h4>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                            <li>• Kartor med dålig geo-referering behöver större radie</li>
                            <li>• GPS-noggrannhet i skog är ofta 10-20m</li>
                            <li>• Testa själv innan tävlingen för att hitta rätt inställning</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Row for per-control radius adjustment
 */
function ControlRadiusRow({
    control,
    defaultRadius,
    onChange,
}: {
    control: Control;
    defaultRadius: number;
    onChange: (radius: number | undefined) => void;
}) {
    const [useCustom, setUseCustom] = useState(control.gpsRadius !== undefined);
    const [radius, setRadius] = useState(control.gpsRadius || defaultRadius);

    const handleToggle = () => {
        const newUseCustom = !useCustom;
        setUseCustom(newUseCustom);
        onChange(newUseCustom ? radius : undefined);
    };

    const handleRadiusChange = (value: number) => {
        setRadius(value);
        if (useCustom) {
            onChange(value);
        }
    };

    return (
        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* Control code */}
            <div className="w-12 h-12 rounded-full border-2 border-orange-500 flex items-center justify-center font-bold text-orange-600 dark:text-orange-400 shrink-0">
                {control.code}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    Kontroll {control.code}
                </div>
                {control.description && (
                    <div className="text-xs text-gray-500 truncate">{control.description}</div>
                )}
            </div>

            {/* Custom toggle */}
            <button
                onClick={handleToggle}
                className={`px-3 py-1 text-xs font-semibold rounded-full ${useCustom
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
            >
                {useCustom ? 'Egen' : 'Standard'}
            </button>

            {/* Radius input */}
            {useCustom && (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={5}
                        max={100}
                        value={radius}
                        onChange={(e) => handleRadiusChange(parseInt(e.target.value) || defaultRadius)}
                        className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-500">m</span>
                </div>
            )}
        </div>
    );
}
