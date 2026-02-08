'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AffineMatrix } from '@/lib/geo/affine';
import { getEvent, saveEvent } from '@/lib/firestore/events';
import type { EventData } from './shared';
import {
    DEFAULT_COURSE_GPS_MODE,
    DEFAULT_COURSE_MOBILE_OPTIONS,
    estimateCourseLengthMeters,
    generateControlId,
    generateCourseId,
    getCourseControls,
    isFiniteNumber,
    normalizePlanningControls,
    normalizePlanningCourses,
    type EventCourseGpsMode,
    type EventCourseMobileOptions,
    type EventPlanningControl,
    type EventPlanningCourse,
} from '@/lib/events/course-planning';

interface CourseBuilderTabProps {
    event: EventData;
    eventId: string;
    setEvent: (event: EventData) => void;
}

interface DraftControlState {
    code: string;
    type: 'start' | 'control' | 'finish';
    relX?: number;
    relY?: number;
    lat?: number;
    lng?: number;
    description: string;
    gpsRadius?: number;
}

const EMPTY_DRAFT_CONTROL: DraftControlState = {
    code: '',
    type: 'control',
    description: '',
};

function formatDistance(distanceMeters?: number): string {
    if (!isFiniteNumber(distanceMeters) || distanceMeters <= 0) return 'okänd';
    return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatCoordinate(value?: number): string {
    if (!isFiniteNumber(value)) return '–';
    return value.toFixed(6);
}

function getTypeLabel(type: EventPlanningControl['type']): string {
    if (type === 'start') return 'Start';
    if (type === 'finish') return 'Mål';
    return 'Kontroll';
}

export default function CourseBuilderTab({ event, eventId, setEvent }: CourseBuilderTabProps) {
    const [fullEvent, setFullEvent] = useState<any>(null);
    const [controls, setControls] = useState<EventPlanningControl[]>([]);
    const [courses, setCourses] = useState<EventPlanningCourse[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [imageWidth, setImageWidth] = useState<number>(0);
    const [imageHeight, setImageHeight] = useState<number>(0);

    const [draftControl, setDraftControl] = useState<DraftControlState>(EMPTY_DRAFT_CONTROL);
    const [draftCourseName, setDraftCourseName] = useState('');
    const [draftCourseControlIds, setDraftCourseControlIds] = useState<string[]>([]);
    const [draftCourseLength, setDraftCourseLength] = useState<string>('');
    const [draftCourseClimb, setDraftCourseClimb] = useState<string>('');
    const [draftGpsMode, setDraftGpsMode] = useState<EventCourseGpsMode>(DEFAULT_COURSE_GPS_MODE);
    const [draftMobileOptions, setDraftMobileOptions] = useState<EventCourseMobileOptions>(DEFAULT_COURSE_MOBILE_OPTIONS);

    useEffect(() => {
        const load = async () => {
            const found = await getEvent(eventId);
            if (found) {
                setFullEvent(found);
                setControls(normalizePlanningControls(found.ppenControls));
                setCourses(normalizePlanningCourses(found.ppenCourses));
                return;
            }

            setControls(normalizePlanningControls(event.ppenControls));
            setCourses(normalizePlanningCourses(event.ppenCourses));
        };

        load();
    }, [eventId, event.ppenControls, event.ppenCourses]);

    const mapImageUrl = fullEvent?.map?.imageUrl || event.map?.imageUrl;
    const calibration = (fullEvent?.calibration || (event as any)?.calibration || null) as AffineMatrix | null;

    const draftCourseControls = useMemo(() => {
        const draftCourse: EventPlanningCourse = {
            id: 'draft',
            name: draftCourseName || 'Utkast',
            controlIds: draftCourseControlIds,
            gpsMode: draftGpsMode,
            mobileOptions: draftMobileOptions,
        };
        return getCourseControls(draftCourse, controls);
    }, [controls, draftCourseControlIds, draftCourseName, draftGpsMode, draftMobileOptions]);

    const estimatedLength = useMemo(() => {
        return estimateCourseLengthMeters(draftCourseControls, {
            calibration,
            imageWidth,
            imageHeight,
        });
    }, [draftCourseControls, calibration, imageWidth, imageHeight]);

    const persistPlanningData = async (
        nextControls: EventPlanningControl[],
        nextCourses: EventPlanningCourse[],
        successMessage: string
    ) => {
        setSaving(true);
        setSaveStatus('Sparar...');
        try {
            await saveEvent({
                id: eventId,
                ppenControls: nextControls,
                ppenCourses: nextCourses,
            });

            setControls(nextControls);
            setCourses(nextCourses);
            setSaveStatus(successMessage);

            const nextEvent = {
                ...event,
                ppenControls: nextControls,
                ppenCourses: nextCourses,
            };
            setEvent(nextEvent as EventData);

            if (fullEvent) {
                setFullEvent({
                    ...fullEvent,
                    ppenControls: nextControls,
                    ppenCourses: nextCourses,
                });
            }
        } catch (error) {
            console.error(error);
            setSaveStatus('Kunde inte spara just nu.');
        } finally {
            setSaving(false);
        }
    };

    const clearDraftCourse = () => {
        setDraftCourseName('');
        setDraftCourseControlIds([]);
        setDraftCourseLength('');
        setDraftCourseClimb('');
        setDraftGpsMode(DEFAULT_COURSE_GPS_MODE);
        setDraftMobileOptions(DEFAULT_COURSE_MOBILE_OPTIONS);
    };

    const inferGeoFromCalibration = (relX: number, relY: number): { lat?: number; lng?: number } => {
        if (!calibration || imageWidth <= 0 || imageHeight <= 0) return {};

        const pixelX = relX * imageWidth;
        const pixelY = relY * imageHeight;

        const lng = calibration.a * pixelX + calibration.b * pixelY + calibration.c;
        const lat = calibration.d * pixelX + calibration.e * pixelY + calibration.f;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return {};
        }

        return { lat, lng };
    };

    const onMapClick = (eventObject: React.MouseEvent<HTMLImageElement>) => {
        const rect = eventObject.currentTarget.getBoundingClientRect();
        const relX = (eventObject.clientX - rect.left) / rect.width;
        const relY = (eventObject.clientY - rect.top) / rect.height;

        if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

        const autoGeo = inferGeoFromCalibration(relX, relY);
        setDraftControl((previous) => ({
            ...previous,
            relX: Number(relX.toFixed(5)),
            relY: Number(relY.toFixed(5)),
            lat: autoGeo.lat ?? previous.lat,
            lng: autoGeo.lng ?? previous.lng,
        }));
    };

    const onAddControl = async () => {
        if (!draftControl.code.trim()) {
            alert('Ange kontrollkod först.');
            return;
        }
        if (!isFiniteNumber(draftControl.relX) || !isFiniteNumber(draftControl.relY)) {
            alert('Klicka i kartan för att placera kontrollen.');
            return;
        }

        const createdControl: EventPlanningControl = {
            id: generateControlId(),
            code: draftControl.code.trim(),
            type: draftControl.type,
            relX: draftControl.relX,
            relY: draftControl.relY,
            lat: isFiniteNumber(draftControl.lat) ? draftControl.lat : undefined,
            lng: isFiniteNumber(draftControl.lng) ? draftControl.lng : undefined,
            description: draftControl.description.trim() || undefined,
            gpsRadius: isFiniteNumber(draftControl.gpsRadius) ? draftControl.gpsRadius : undefined,
        };

        const nextControls = [...controls, createdControl];
        await persistPlanningData(nextControls, courses, 'Kontroll sparad.');
        setDraftControl({
            ...EMPTY_DRAFT_CONTROL,
            type: 'control',
        });
    };

    const onDeleteControl = async (controlId: string) => {
        const usedInCourses = courses.filter((course) => course.controlIds.includes(controlId));
        if (usedInCourses.length > 0) {
            const names = usedInCourses.map((course) => course.name).join(', ');
            const proceed = window.confirm(
                `Kontrollen används i ${usedInCourses.length} bana/banor (${names}). Ta bort ändå?`
            );
            if (!proceed) return;
        }

        const nextControls = controls.filter((control) => control.id !== controlId);
        const nextCourses = courses.map((course) => ({
            ...course,
            controlIds: course.controlIds.filter((id) => id !== controlId),
        }));
        await persistPlanningData(nextControls, nextCourses, 'Kontroll borttagen.');
        setDraftCourseControlIds((previous) => previous.filter((id) => id !== controlId));
    };

    const appendDraftCourseControl = (controlId: string) => {
        setDraftCourseControlIds((previous) => [...previous, controlId]);
    };

    const moveDraftCourseControl = (index: number, direction: -1 | 1) => {
        setDraftCourseControlIds((previous) => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= previous.length) {
                return previous;
            }

            const next = [...previous];
            const [removed] = next.splice(index, 1);
            next.splice(targetIndex, 0, removed);
            return next;
        });
    };

    const onCreateCourse = async () => {
        if (!draftCourseName.trim()) {
            alert('Ange bannamn.');
            return;
        }
        if (draftCourseControlIds.length < 2) {
            alert('Lägg till minst två kontroller i banan.');
            return;
        }

        const course: EventPlanningCourse = {
            id: generateCourseId(),
            name: draftCourseName.trim(),
            controlIds: draftCourseControlIds,
            lengthMeters: isFiniteNumber(Number(draftCourseLength)) ? Number(draftCourseLength) : estimatedLength || undefined,
            climbMeters: isFiniteNumber(Number(draftCourseClimb)) ? Number(draftCourseClimb) : undefined,
            gpsMode: draftGpsMode,
            mobileOptions: draftMobileOptions,
        };

        const nextCourses = [...courses, course];
        await persistPlanningData(controls, nextCourses, 'Bana sparad.');
        clearDraftCourse();
    };

    const onDeleteCourse = async (courseId: string) => {
        const proceed = window.confirm('Ta bort den här banan?');
        if (!proceed) return;

        const nextCourses = courses.filter((course) => course.id !== courseId);
        await persistPlanningData(controls, nextCourses, 'Bana borttagen.');
    };

    if (!mapImageUrl) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <div className="text-5xl opacity-30 mb-4">🗺️</div>
                <h3 className="text-lg font-bold text-white mb-2">Ladda upp karta först</h3>
                <p className="text-slate-500 text-sm">
                    Banläggning i appen kräver en kartbild i fliken Karta.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-3">
                    1) Placera kontroll i kartan
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                    Klicka i kartan för att sätta position. Om georeferering finns fylls lat/lng automatiskt.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative">
                    <img
                        src={mapImageUrl}
                        alt="Karta för banläggning"
                        className="w-full h-auto cursor-crosshair"
                        onLoad={(eventObject) => {
                            setImageWidth(eventObject.currentTarget.naturalWidth);
                            setImageHeight(eventObject.currentTarget.naturalHeight);
                        }}
                        onClick={onMapClick}
                    />

                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                        {controls.map((control, index) => (
                            <g key={`existing-${control.id}-${index}`}>
                                {isFiniteNumber(control.relX) && isFiniteNumber(control.relY) && (
                                    <>
                                        <circle
                                            cx={`${control.relX * 100}%`}
                                            cy={`${control.relY * 100}%`}
                                            r={9}
                                            stroke="#d926a9"
                                            strokeWidth={2}
                                            fill="none"
                                        />
                                        <text
                                            x={`${control.relX * 100}%`}
                                            y={`${control.relY * 100}%`}
                                            dx={12}
                                            dy={-8}
                                            fill="#ffffff"
                                            stroke="#000000"
                                            strokeWidth={3}
                                            paintOrder="stroke"
                                            fontSize={12}
                                            fontWeight="bold"
                                        >
                                            {control.code}
                                        </text>
                                    </>
                                )}
                            </g>
                        ))}
                        {isFiniteNumber(draftControl.relX) && isFiniteNumber(draftControl.relY) && (
                            <g>
                                <circle
                                    cx={`${draftControl.relX * 100}%`}
                                    cy={`${draftControl.relY * 100}%`}
                                    r={11}
                                    stroke="#22d3ee"
                                    strokeWidth={3}
                                    fill="none"
                                />
                                <text
                                    x={`${draftControl.relX * 100}%`}
                                    y={`${draftControl.relY * 100}%`}
                                    dx={12}
                                    dy={-8}
                                    fill="#22d3ee"
                                    stroke="#000000"
                                    strokeWidth={3}
                                    paintOrder="stroke"
                                    fontSize={12}
                                    fontWeight="bold"
                                >
                                    {draftControl.code || 'Ny'}
                                </text>
                            </g>
                        )}
                    </svg>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-3">
                        2) Ny kontroll
                    </h3>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Kod
                            </label>
                            <input
                                type="text"
                                value={draftControl.code}
                                onChange={(eventObject) => setDraftControl((previous) => ({ ...previous, code: eventObject.target.value }))}
                                placeholder="31"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Typ
                            </label>
                            <select
                                value={draftControl.type}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        type: eventObject.target.value as DraftControlState['type'],
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                <option value="start">Start</option>
                                <option value="control">Kontroll</option>
                                <option value="finish">Mål</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Rel X
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.0001}
                                value={isFiniteNumber(draftControl.relX) ? draftControl.relX : ''}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        relX: eventObject.target.value ? Number(eventObject.target.value) : undefined,
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Rel Y
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.0001}
                                value={isFiniteNumber(draftControl.relY) ? draftControl.relY : ''}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        relY: eventObject.target.value ? Number(eventObject.target.value) : undefined,
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Lat
                            </label>
                            <input
                                type="number"
                                step={0.000001}
                                value={isFiniteNumber(draftControl.lat) ? draftControl.lat : ''}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        lat: eventObject.target.value ? Number(eventObject.target.value) : undefined,
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Lng
                            </label>
                            <input
                                type="number"
                                step={0.000001}
                                value={isFiniteNumber(draftControl.lng) ? draftControl.lng : ''}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        lng: eventObject.target.value ? Number(eventObject.target.value) : undefined,
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                GPS-radie (m)
                            </label>
                            <input
                                type="number"
                                min={5}
                                max={120}
                                step={1}
                                value={isFiniteNumber(draftControl.gpsRadius) ? draftControl.gpsRadius : ''}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        gpsRadius: eventObject.target.value ? Number(eventObject.target.value) : undefined,
                                    }))
                                }
                                placeholder="t.ex. 20"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Beskrivning
                            </label>
                            <input
                                type="text"
                                value={draftControl.description}
                                onChange={(eventObject) =>
                                    setDraftControl((previous) => ({
                                        ...previous,
                                        description: eventObject.target.value,
                                    }))
                                }
                                placeholder="Sten, nordöstra sidan"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <button
                        onClick={onAddControl}
                        disabled={saving}
                        className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                    >
                        + Lägg till kontroll
                    </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-3">
                        3) Kontroller i eventet ({controls.length})
                    </h3>
                    <div className="space-y-2 max-h-[380px] overflow-auto">
                        {controls.length === 0 && (
                            <p className="text-xs text-slate-500">Inga kontroller ännu.</p>
                        )}
                        {controls.map((control) => (
                            <div key={control.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-white">{control.code}</p>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">
                                            {getTypeLabel(control.type)} · lat {formatCoordinate(control.lat)} · lng {formatCoordinate(control.lng)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => appendDraftCourseControl(control.id)}
                                            className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500"
                                        >
                                            + Bana
                                        </button>
                                        <button
                                            onClick={() => onDeleteControl(control.id)}
                                            className="px-2 py-1 bg-red-600/20 text-red-300 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-red-600/30"
                                        >
                                            Ta bort
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-3">
                    4) Skapa bana för träning
                </h3>

                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Bannamn
                        </label>
                        <input
                            type="text"
                            value={draftCourseName}
                            onChange={(eventObject) => setDraftCourseName(eventObject.target.value)}
                            placeholder="Medel A"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Längd (m)
                        </label>
                        <input
                            type="number"
                            value={draftCourseLength}
                            onChange={(eventObject) => setDraftCourseLength(eventObject.target.value)}
                            placeholder={estimatedLength ? `${estimatedLength}` : 'Auto'}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Stigning (m)
                        </label>
                        <input
                            type="number"
                            value={draftCourseClimb}
                            onChange={(eventObject) => setDraftCourseClimb(eventObject.target.value)}
                            placeholder="120"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        />
                    </div>
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                            GPS-stämpling
                        </h4>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={draftGpsMode.enabled}
                                onChange={(eventObject) =>
                                    setDraftGpsMode((previous) => ({
                                        ...previous,
                                        enabled: eventObject.target.checked,
                                    }))
                                }
                            />
                            Aktivera GPS-stämpling
                        </label>
                        <div className="mt-3">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Känslighet
                            </label>
                            <select
                                value={draftGpsMode.sensitivity}
                                onChange={(eventObject) =>
                                    setDraftGpsMode((previous) => ({
                                        ...previous,
                                        sensitivity: eventObject.target.value as EventCourseGpsMode['sensitivity'],
                                    }))
                                }
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                <option value="exact">Exakt (10 m)</option>
                                <option value="standard">Standard (20 m)</option>
                                <option value="relaxed">Avslappnad (35 m)</option>
                                <option value="custom">Egen radie</option>
                            </select>
                        </div>
                        {draftGpsMode.sensitivity === 'custom' && (
                            <div className="mt-3">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Egen radie (m)
                                </label>
                                <input
                                    type="number"
                                    min={5}
                                    max={120}
                                    step={1}
                                    value={draftGpsMode.customRadius ?? 25}
                                    onChange={(eventObject) =>
                                        setDraftGpsMode((previous) => ({
                                            ...previous,
                                            customRadius: Number(eventObject.target.value),
                                        }))
                                    }
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                            Mobilkarta
                        </h4>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={draftMobileOptions.allowMobileMap}
                                onChange={(eventObject) =>
                                    setDraftMobileOptions((previous) => ({
                                        ...previous,
                                        allowMobileMap: eventObject.target.checked,
                                    }))
                                }
                            />
                            Visa karta i mobil-läge
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 mt-3">
                            <input
                                type="checkbox"
                                checked={draftMobileOptions.hideRunnerDot}
                                onChange={(eventObject) =>
                                    setDraftMobileOptions((previous) => ({
                                        ...previous,
                                        hideRunnerDot: eventObject.target.checked,
                                    }))
                                }
                            />
                            Dölj egen GPS-punkt på kartan
                        </label>
                        <p className="text-xs text-slate-500 mt-3">
                            Träningsläget använder alltid ljud/haptik vid stämpling.
                        </p>
                    </div>
                </div>

                <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Kontrollordning ({draftCourseControlIds.length})
                        </h4>
                        <p className="text-xs text-slate-500">
                            Auto-längd: {formatDistance(estimatedLength || undefined)}
                        </p>
                    </div>

                    <div className="space-y-2 mt-3">
                        {draftCourseControlIds.length === 0 && (
                            <p className="text-xs text-slate-500">Lägg till kontroller från listan ovan.</p>
                        )}
                        {draftCourseControlIds.map((controlId, index) => {
                            const control = controls.find((item) => item.id === controlId);
                            if (!control) return null;

                            return (
                                <div key={`${controlId}-${index}`} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                                    <div>
                                        <span className="text-xs text-slate-500 mr-2">{index + 1}.</span>
                                        <span className="font-bold text-white">{control.code}</span>
                                        <span className="text-xs text-slate-400 ml-2">{getTypeLabel(control.type)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => moveDraftCourseControl(index, -1)}
                                            className="px-2 py-1 bg-slate-700 text-white rounded text-xs"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => moveDraftCourseControl(index, 1)}
                                            className="px-2 py-1 bg-slate-700 text-white rounded text-xs"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() =>
                                                setDraftCourseControlIds((previous) =>
                                                    previous.filter((_, position) => position !== index)
                                                )
                                            }
                                            className="px-2 py-1 bg-red-600/20 text-red-300 rounded text-xs"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button
                        onClick={onCreateCourse}
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                    >
                        + Spara bana
                    </button>
                    <button
                        onClick={clearDraftCourse}
                        className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700"
                    >
                        Rensa utkast
                    </button>
                    {saveStatus && (
                        <p className="text-xs text-emerald-400">{saveStatus}</p>
                    )}
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-3">
                    5) Befintliga banor ({courses.length})
                </h3>
                <div className="space-y-3">
                    {courses.length === 0 && (
                        <p className="text-xs text-slate-500">Inga banor skapade ännu.</p>
                    )}
                    {courses.map((course) => {
                        const courseControls = getCourseControls(course, controls);
                        const courseLength = course.lengthMeters || estimateCourseLengthMeters(courseControls, {
                            calibration,
                            imageWidth,
                            imageHeight,
                        });
                        return (
                            <div key={course.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-white">{course.name}</p>
                                        <p className="text-xs text-slate-400">
                                            {courseControls.length} kontroller · {formatDistance(courseLength || undefined)}
                                            {course.gpsMode.enabled ? ' · GPS aktivt' : ' · GPS av'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <a
                                            href={`/events/${eventId}/training?course=${course.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500"
                                        >
                                            Mobil-läge
                                        </a>
                                        <a
                                            href={`/events/${eventId}/print?course=${course.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500"
                                        >
                                            PDF/Utskrift
                                        </a>
                                        <button
                                            onClick={() => onDeleteCourse(course.id)}
                                            className="px-3 py-2 bg-red-600/20 text-red-300 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-600/30"
                                        >
                                            Ta bort
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
