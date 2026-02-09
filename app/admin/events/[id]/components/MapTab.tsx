'use client';

import { useState, useEffect, useMemo } from 'react';
import GCPCalibrationTool from '@/components/GCPCalibrationTool';
import type { GCP, AffineMatrix } from '@/lib/geo/affine';
import { EventData, parseCourseFileData } from './shared';
import { getEvent, saveEvent } from '@/lib/firestore/events';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import type {
    EventPlanningControl,
    EventPlanningCourse,
} from '@/lib/events/course-planning';
import {
    getControlCoverageRect,
    processMapImageForUpload,
    remapControlsForCrop,
    type MapUploadOptimizationReport,
} from '@/lib/maps/image-processing';
import {
    deleteMapArchiveEntry,
    markMapArchiveEntryUsed,
    subscribeToMapArchiveEntries,
    upsertMapArchiveEntry,
    type MapArchiveEntry,
} from '@/lib/firestore/map-archive';

interface MapTabProps {
    event: EventData;
    eventId: string;
    setEvent: (e: EventData) => void;
}

interface TestDataFileInfo {
    id: string;
    name: string;
    relativePath: string;
    extension: string;
    kind: string;
    sizeBytes: number;
    url: string;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildUploadSummary(report: MapUploadOptimizationReport): string {
    const savedRatio = Math.max(0, 1 - report.compressionRatio);
    return (
        `${Math.round(savedRatio * 100)}% mindre fil `
        + `(${formatBytes(report.originalBytes)} → ${formatBytes(report.processedBytes)})`
    );
}

type UploadPresetId = 'balanced' | 'mobile' | 'highDetail' | 'custom';

interface UploadPreset {
    id: Exclude<UploadPresetId, 'custom'>;
    name: string;
    maxWidth: number;
    qualityPercent: number;
    format: 'image/webp' | 'image/jpeg';
    cropToControls: boolean;
}

const UPLOAD_PRESETS: UploadPreset[] = [
    {
        id: 'balanced',
        name: 'Balanserad (rekommenderad)',
        maxWidth: 4096,
        qualityPercent: 80,
        format: 'image/webp',
        cropToControls: true,
    },
    {
        id: 'mobile',
        name: 'Mobildata-spar',
        maxWidth: 2800,
        qualityPercent: 70,
        format: 'image/webp',
        cropToControls: true,
    },
    {
        id: 'highDetail',
        name: 'Hög detalj',
        maxWidth: 5200,
        qualityPercent: 88,
        format: 'image/jpeg',
        cropToControls: false,
    },
];

export default function MapTab({ event: _event, eventId, setEvent }: MapTabProps) {
    const { user } = useUserWithRoles();
    const [showCalibration, setShowCalibration] = useState(false);
    const [ppenControls, setPpenControls] = useState<EventPlanningControl[]>([]);
    const [ppenCourses, setPpenCourses] = useState<EventPlanningCourse[]>([]);
    const [loadingPpen, setLoadingPpen] = useState(true);
    const [importingCourseFile, setImportingCourseFile] = useState(false);
    const [selectedPreviewCourseId, setSelectedPreviewCourseId] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [fullEvent, setFullEvent] = useState<any>(null);
    const [uploadPresetId, setUploadPresetId] = useState<UploadPresetId>('balanced');
    const [optimizeOnUpload, setOptimizeOnUpload] = useState(true);
    const [cropToControls, setCropToControls] = useState(true);
    const [maxUploadWidth, setMaxUploadWidth] = useState(4096);
    const [uploadQualityPercent, setUploadQualityPercent] = useState(80);
    const [uploadFormat, setUploadFormat] = useState<'image/webp' | 'image/jpeg'>('image/webp');
    const [lastUploadReport, setLastUploadReport] = useState<MapUploadOptimizationReport | null>(null);
    const [visibilityMode, setVisibilityMode] = useState<'always' | 'scheduled' | 'hidden'>('always');
    const [releaseAt, setReleaseAt] = useState('');
    const [hideAt, setHideAt] = useState('');
    const [fallbackBaseMap, setFallbackBaseMap] = useState<'none' | 'osm'>('osm');
    const [visibilitySaveStatus, setVisibilitySaveStatus] = useState('');

    const [archiveEntries, setArchiveEntries] = useState<MapArchiveEntry[]>([]);
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveStatus, setArchiveStatus] = useState('');
    const [archiveTitle, setArchiveTitle] = useState('');
    const [archiveIncludeCourses, setArchiveIncludeCourses] = useState(true);
    const [archiveIncludeCalibration, setArchiveIncludeCalibration] = useState(true);
    const [archiveShareWithClub, setArchiveShareWithClub] = useState(false);
    const [applyArchiveIncludeCourses, setApplyArchiveIncludeCourses] = useState(false);
    const [applyArchiveIncludeCalibration, setApplyArchiveIncludeCalibration] = useState(true);
    const [applyingArchiveId, setApplyingArchiveId] = useState<string | null>(null);

    const [testFiles, setTestFiles] = useState<TestDataFileInfo[]>([]);
    const [loadingTestFiles, setLoadingTestFiles] = useState(false);
    const [selectedTestMapId, setSelectedTestMapId] = useState('');
    const [selectedTestCourseId, setSelectedTestCourseId] = useState('');
    const [testImportStatus, setTestImportStatus] = useState('');

    const applyPreset = (presetId: Exclude<UploadPresetId, 'custom'>) => {
        const preset = UPLOAD_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        setUploadPresetId(presetId);
        setMaxUploadWidth(preset.maxWidth);
        setUploadQualityPercent(preset.qualityPercent);
        setUploadFormat(preset.format);
        setCropToControls(preset.cropToControls);
    };

    useEffect(() => {
        const load = async () => {
            const found = await getEvent(eventId);
            if (found) {
                setFullEvent(found);
                if (found.ppenControls && found.ppenControls.length > 0) setPpenControls(found.ppenControls);
                if (found.ppenCourses && found.ppenCourses.length > 0) setPpenCourses(found.ppenCourses);
                if (found.map?.optimization) {
                    setLastUploadReport({
                        originalWidth: found.map.optimization.originalWidth || 0,
                        originalHeight: found.map.optimization.originalHeight || 0,
                        width: found.map.optimization.width || 0,
                        height: found.map.optimization.height || 0,
                        originalBytes: found.map.optimization.originalBytes || 0,
                        processedBytes: found.map.optimization.processedBytes || 0,
                        format: found.map.optimization.format || 'image/jpeg',
                        cropRect: found.map.optimization.cropRect || { left: 0, top: 0, right: 1, bottom: 1 },
                        cropApplied: !!found.map.optimization.cropApplied,
                        quality: found.map.optimization.quality || 0.8,
                        compressionRatio: found.map.optimization.compressionRatio || 1,
                        usedOriginalFile: false,
                    });

                    const savedPreset = found.map.optimization.preset as UploadPresetId | undefined;
                    if (savedPreset === 'balanced' || savedPreset === 'mobile' || savedPreset === 'highDetail') {
                        applyPreset(savedPreset);
                    }
                }
                if (found.map?.visibility) {
                    setVisibilityMode(found.map.visibility.mode || 'always');
                    setReleaseAt(found.map.visibility.releaseAt || '');
                    setHideAt(found.map.visibility.hideAt || '');
                    setFallbackBaseMap(found.map.visibility.fallbackBaseMap || 'osm');
                }
            }
        };
        load();
    }, [eventId]);

    useEffect(() => {
        if (!user) {
            setArchiveEntries([]);
            setArchiveLoading(false);
            return;
        }

        setArchiveLoading(true);
        const unsubscribe = subscribeToMapArchiveEntries(
            {
                userId: user.id,
                clubIds: Object.keys(user.clubs || {}),
                includeClubShared: true,
            },
            (entries) => {
                setArchiveEntries(entries);
                setArchiveLoading(false);
            }
        );

        return unsubscribe;
    }, [user?.id]);

    useEffect(() => {
        let cancelled = false;

        const loadTestFiles = async () => {
            setLoadingTestFiles(true);
            try {
                const res = await fetch('/api/test-data/files');
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (!cancelled && data?.success && Array.isArray(data.files)) {
                    setTestFiles(data.files as TestDataFileInfo[]);
                }
            } catch (error) {
                console.warn('Could not load test data files:', error);
            } finally {
                if (!cancelled) setLoadingTestFiles(false);
            }
        };

        void loadTestFiles();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (fullEvent?.ppenControls?.length > 0 || ppenControls.length > 0) {
            setLoadingPpen(false);
            return;
        }
        const loadPurplePen = async () => {
            try {
                const response = await fetch('/api/test-data/purplepen');
                if (response.ok) {
                    const xmlText = await response.text();
                    const { controls, courses } = parseCourseFileData(xmlText);
                    setPpenControls(controls);
                    setPpenCourses(courses);
                }
            } catch (e) {
                console.log('Could not load Purple Pen data:', e);
            }
            setLoadingPpen(false);
        };
        loadPurplePen();
    }, [fullEvent, ppenControls.length]);

    const map = fullEvent?.map;
    const calibration = fullEvent?.calibration;
    const courses = ppenCourses;
    const allControls = ppenControls;

    const controlsWithRelativePosition = useMemo(
        () => allControls.filter(
            (control) =>
                typeof control.relX === 'number'
                && Number.isFinite(control.relX)
                && typeof control.relY === 'number'
                && Number.isFinite(control.relY)
        ),
        [allControls]
    );

    const suggestedCropRect = useMemo(
        () => getControlCoverageRect(controlsWithRelativePosition, 0.08),
        [controlsWithRelativePosition]
    );

    const suggestedCropCoverage = useMemo(() => {
        if (!suggestedCropRect) return 100;
        const width = suggestedCropRect.right - suggestedCropRect.left;
        const height = suggestedCropRect.bottom - suggestedCropRect.top;
        return Math.max(0, Math.min(100, width * height * 100));
    }, [suggestedCropRect]);

    const getControlPositionPercent = (ctrl: any) => {
        return {
            x: (ctrl.relX ?? 0.5) * 100,
            y: (ctrl.relY ?? 0.5) * 100,
        };
    };

    const handleSaveCalibration = async (gcps: GCP[], transform: AffineMatrix) => {
        if (!fullEvent) return;
        const updatedEvent = {
            ...fullEvent,
            calibrationGCPs: gcps,
            calibration: transform,
            ppenControls: ppenControls.length > 0 ? ppenControls : fullEvent.ppenControls,
            ppenCourses: ppenCourses.length > 0 ? ppenCourses : fullEvent.ppenCourses,
        };
        await saveEvent(updatedEvent);
        setFullEvent(updatedEvent);
        setShowCalibration(false);
    };

    const clearCalibration = async () => {
        if (!fullEvent) return;
        const { calibration: _calibration, calibrationGCPs: _calibrationGCPs, ...rest } = fullEvent;
        await saveEvent(rest);
        setFullEvent(rest);
    };

    const persistPlanningData = async (
        controls: EventPlanningControl[],
        courses: EventPlanningCourse[]
    ) => {
        await saveEvent({
            id: eventId,
            ppenControls: controls,
            ppenCourses: courses,
        });

        const nextEventState = {
            ...(fullEvent || {}),
            id: eventId,
            ppenControls: controls,
            ppenCourses: courses,
        };

        setFullEvent(nextEventState);
        setEvent({
            ...(_event || {}),
            ...(fullEvent || {}),
            ppenControls: controls,
            ppenCourses: courses,
        } as EventData);
    };

    const parseCourseFileViaApi = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/import/ocad', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = typeof errorData?.message === 'string'
                ? errorData.message
                : 'Import-API svarade med fel.';
            throw new Error(message);
        }

        const parsed = await response.json();
        if (!parsed?.success || !Array.isArray(parsed.controls) || !Array.isArray(parsed.courses)) {
            throw new Error('Import-API returnerade ogiltigt svar.');
        }

        return {
            controls: parsed.controls as EventPlanningControl[],
            courses: parsed.courses as EventPlanningCourse[],
            format: typeof parsed.format === 'string' ? parsed.format : 'unknown',
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings as string[] : [],
        };
    };

    const saveMapVisibilitySettings = async () => {
        if (!fullEvent?.map) {
            alert('Ladda upp karta först.');
            return;
        }

        setVisibilitySaveStatus('Sparar...');
        try {
            const updatedEvent = {
                ...fullEvent,
                map: {
                    ...fullEvent.map,
                    visibility: {
                        mode: visibilityMode,
                        releaseAt: releaseAt || undefined,
                        hideAt: hideAt || undefined,
                        fallbackBaseMap,
                    },
                },
            };

            await saveEvent(updatedEvent);
            setFullEvent(updatedEvent);
            setEvent(updatedEvent as EventData);
            setVisibilitySaveStatus('Kartvisning sparad.');
        } catch (error) {
            console.error(error);
            setVisibilitySaveStatus('Kunde inte spara kartvisning.');
        }
    };

    const importCourseFile = async (file: File) => {
        setImportingCourseFile(true);
        try {
            const text = await file.text();
            let parsed: {
                controls: EventPlanningControl[];
                courses: EventPlanningCourse[];
                format: string;
                warnings: string[];
            } | null = null;

            try {
                parsed = await parseCourseFileViaApi(file);
            } catch (apiError) {
                console.warn('Import-API misslyckades, använder lokal parser.', apiError);
            }

            if (!parsed) {
                const local = parseCourseFileData(text);
                parsed = {
                    controls: local.controls,
                    courses: local.courses,
                    format: local.format,
                    warnings: local.warnings,
                };
            }

            if (parsed.controls.length === 0 || parsed.courses.length === 0) {
                const warning = parsed.warnings[0] || 'Inga kontroller eller banor hittades i filen.';
                alert(`Importen misslyckades: ${warning}`);
                return;
            }

            setPpenControls(parsed.controls);
            setPpenCourses(parsed.courses);
            await persistPlanningData(parsed.controls, parsed.courses);

            const warningText = parsed.warnings.length > 0
                ? `\nVarningar:\n- ${parsed.warnings.slice(0, 3).join('\n- ')}`
                : '';
            alert(
                `Laddade ${parsed.controls.length} kontroller och ${parsed.courses.length} banor `
                + `(${parsed.format}).${warningText}`
            );
        } catch (error) {
            console.error(error);
            alert('Kunde inte läsa banfilen.');
        } finally {
            setImportingCourseFile(false);
        }
    };

    const handlePurplePenFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;

        try {
            await importCourseFile(file);
        } finally {
            input.value = '';
        }
    };

    const uploadMapImageFile = async (sourceFile: File) => {
        if (!sourceFile.type.startsWith('image/')) {
            alert('Endast bildfiler stöds för kartuppladdning.');
            return;
        }

        setUploading(true);
        setUploadStatus('Förbereder kartbild...');

        let fileToUpload = sourceFile;
        let report: MapUploadOptimizationReport | null = null;
        let nextControls = allControls;
        let shouldClearCalibration = false;

        try {
            if (optimizeOnUpload) {
                setUploadStatus('Optimerar kartbild...');
                const result = await processMapImageForUpload(sourceFile, {
                    enabled: true,
                    maxWidth: maxUploadWidth,
                    quality: uploadQualityPercent / 100,
                    format: uploadFormat,
                    cropToControls: cropToControls && controlsWithRelativePosition.length > 0,
                    cropMargin: 0.08,
                    controls: controlsWithRelativePosition,
                });
                fileToUpload = result.file;
                report = result.report;
                setLastUploadReport(report);

                if (report.cropApplied && controlsWithRelativePosition.length > 0) {
                    nextControls = remapControlsForCrop(allControls, report.cropRect);
                    setPpenControls(nextControls);
                    shouldClearCalibration = true;
                }
            }

            const formData = new FormData();
            formData.append('file', fileToUpload);
            formData.append('raceId', eventId);

            setUploadStatus('Laddar upp...');
            const res = await fetch('/api/upload-map', { method: 'POST', body: formData });
            const data = await res.json();

            if (!data.success) {
                alert(`Uppladdning misslyckades: ${data.message}`);
                return;
            }

            if (fullEvent) {
                const baseEvent = shouldClearCalibration
                    ? (() => {
                        const { calibration: _calibration, calibrationGCPs: _calibrationGCPs, ...rest } = fullEvent;
                        return rest;
                    })()
                    : fullEvent;

                const updatedEvent = {
                    ...baseEvent,
                    map: (() => {
                        const nextMap: any = {
                            ...(baseEvent.map || {}),
                            imageUrl: data.url,
                            name: fileToUpload.name,
                        };

                        if (report) {
                            nextMap.optimization = {
                                originalBytes: report.originalBytes,
                                processedBytes: report.processedBytes,
                                compressionRatio: report.compressionRatio,
                                originalWidth: report.originalWidth,
                                originalHeight: report.originalHeight,
                                width: report.width,
                                height: report.height,
                                cropApplied: report.cropApplied,
                                cropRect: report.cropRect,
                                format: report.format,
                                quality: report.quality,
                                preset: uploadPresetId,
                                updatedAt: new Date().toISOString(),
                            };
                        }

                        return nextMap;
                    })(),
                    ppenControls: nextControls.length > 0 ? nextControls : baseEvent.ppenControls,
                    ppenCourses: ppenCourses.length > 0 ? ppenCourses : baseEvent.ppenCourses,
                };

                await saveEvent(updatedEvent);
                setFullEvent(updatedEvent);
                setEvent(updatedEvent as EventData);
            }

            if (report) {
                const uploadMessage = buildUploadSummary(report);
                if (shouldClearCalibration && calibration) {
                    alert(`${uploadMessage}. Tidigare georeferering nollställdes eftersom kartan beskars.`);
                } else {
                    alert(uploadMessage);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Ett fel uppstod vid uppladdning.');
        } finally {
            setUploadStatus('');
            setUploading(false);
        }
    };

    const handleMapImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputElement = e.target;
        const sourceFile = inputElement.files?.[0];
        if (!sourceFile) return;

        try {
            await uploadMapImageFile(sourceFile);
        } finally {
            inputElement.value = '';
        }
    };

    const fetchTestFile = async (fileId: string): Promise<File> => {
        const info = testFiles.find((file) => file.id === fileId);
        const url = info?.url || `/api/test-data/file?id=${encodeURIComponent(fileId)}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error('Kunde inte hämta testfilen.');
        }
        const blob = await res.blob();
        const filename = info?.name || `test-file-${fileId}`;
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    };

    const importTestMap = async () => {
        if (!selectedTestMapId) return;
        setTestImportStatus('Hämtar kartbild...');
        try {
            const file = await fetchTestFile(selectedTestMapId);
            setTestImportStatus('Optimerar & laddar upp...');
            await uploadMapImageFile(file);
            setTestImportStatus('Kartan är nu kopplad till eventet.');
        } catch (error) {
            console.error(error);
            setTestImportStatus('Kunde inte importera kartbilden.');
        }
    };

    const importTestCourseFile = async () => {
        if (!selectedTestCourseId) return;
        setTestImportStatus('Hämtar banfil...');
        try {
            const file = await fetchTestFile(selectedTestCourseId);
            setTestImportStatus('Importerar banfil...');
            await importCourseFile(file);
            setTestImportStatus('Banfil importerad.');
        } catch (error) {
            console.error(error);
            setTestImportStatus('Kunde inte importera banfilen.');
        }
    };

    const canShareToClub = !!(
        user
        && fullEvent?.clubId
        && (user.systemRole === 'super_admin' || user.clubs?.[fullEvent.clubId]?.role === 'club_admin')
    );

    const saveCurrentMapToArchive = async () => {
        if (!user) {
            alert('Logga in för att använda kartarkivet.');
            return;
        }

        const mapData = fullEvent?.map;
        if (!mapData?.imageUrl) {
            alert('Ladda upp en karta först.');
            return;
        }

        setArchiveStatus('Sparar...');

        try {
            const title = archiveTitle.trim()
                || mapData.name
                || fullEvent?.name
                || 'Karta';

            await upsertMapArchiveEntry({
                ownerUserId: user.id,
                ownerDisplayName: user.displayName,
                clubId: archiveShareWithClub && canShareToClub ? fullEvent.clubId : undefined,
                title,
                imageUrl: mapData.imageUrl,
                sourceFileName: mapData.name,
                sourceFormat: 'image',
                optimization: mapData.optimization,
                bounds: mapData.bounds,
                calibration: archiveIncludeCalibration ? fullEvent?.calibration : undefined,
                calibrationGCPs: archiveIncludeCalibration ? fullEvent?.calibrationGCPs : undefined,
                ppenControls: archiveIncludeCourses ? ppenControls : undefined,
                ppenCourses: archiveIncludeCourses ? ppenCourses : undefined,
            });

            setArchiveStatus('Sparat i kartarkivet.');
        } catch (error) {
            console.error(error);
            setArchiveStatus('Kunde inte spara i kartarkivet.');
        }
    };

    const applyArchiveEntry = async (entry: MapArchiveEntry) => {
        if (!fullEvent) return;

        setApplyingArchiveId(entry.id);
        try {
            const updatedEvent: any = {
                ...fullEvent,
                map: {
                    ...(fullEvent.map || {}),
                    imageUrl: entry.imageUrl,
                    name: entry.sourceFileName || entry.title,
                    optimization: entry.optimization || fullEvent.map?.optimization,
                    bounds: entry.bounds || fullEvent.map?.bounds,
                },
            };

            if (entry.optimization) {
                setLastUploadReport({
                    originalWidth: entry.optimization.originalWidth || 0,
                    originalHeight: entry.optimization.originalHeight || 0,
                    width: entry.optimization.width || 0,
                    height: entry.optimization.height || 0,
                    originalBytes: entry.optimization.originalBytes || 0,
                    processedBytes: entry.optimization.processedBytes || 0,
                    format: entry.optimization.format || 'image/jpeg',
                    cropRect: entry.optimization.cropRect || { left: 0, top: 0, right: 1, bottom: 1 },
                    cropApplied: !!entry.optimization.cropApplied,
                    quality: entry.optimization.quality || 0.8,
                    compressionRatio: entry.optimization.compressionRatio || 1,
                    usedOriginalFile: false,
                });
            }

            if (applyArchiveIncludeCalibration && entry.calibration) {
                updatedEvent.calibration = entry.calibration;
                if (entry.calibrationGCPs) {
                    updatedEvent.calibrationGCPs = entry.calibrationGCPs;
                }
            }

            if (applyArchiveIncludeCourses) {
                if (Array.isArray(entry.ppenControls)) {
                    updatedEvent.ppenControls = entry.ppenControls;
                    setPpenControls(entry.ppenControls);
                }
                if (Array.isArray(entry.ppenCourses)) {
                    updatedEvent.ppenCourses = entry.ppenCourses;
                    setPpenCourses(entry.ppenCourses);
                }
            }

            await saveEvent(updatedEvent);
            setFullEvent(updatedEvent);
            setEvent(updatedEvent as EventData);

            void markMapArchiveEntryUsed(entry);
        } catch (error) {
            console.error(error);
            alert('Kunde inte använda kartan från arkivet.');
        } finally {
            setApplyingArchiveId(null);
        }
    };

    const removeArchiveEntry = async (entry: MapArchiveEntry) => {
        if (!user || entry.ownerUserId !== user.id) return;
        const proceed = window.confirm(`Ta bort "${entry.title}" från kartarkivet?`);
        if (!proceed) return;

        try {
            await deleteMapArchiveEntry(entry.id);
        } catch (error) {
            console.error(error);
            alert('Kunde inte ta bort kartan.');
        }
    };

    const uploadSettingsCard = (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-bold text-white mb-3 text-xs uppercase tracking-widest">Bildoptimering</h3>
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                        type="checkbox"
                        checked={optimizeOnUpload}
                        onChange={(e) => setOptimizeOnUpload(e.target.checked)}
                    />
                    Optimera kartbild före uppladdning
                </label>

                {optimizeOnUpload && (
                    <>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Förinställning
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={uploadPresetId}
                                    onChange={(e) => {
                                        const value = e.target.value as UploadPresetId;
                                        if (value === 'custom') {
                                            setUploadPresetId('custom');
                                            return;
                                        }
                                        applyPreset(value);
                                    }}
                                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                >
                                    {UPLOAD_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                                    ))}
                                    <option value="custom">Egen</option>
                                </select>
                                {uploadPresetId !== 'custom' && (
                                    <button
                                        type="button"
                                        onClick={() => applyPreset(uploadPresetId)}
                                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-700"
                                    >
                                        Återställ preset
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Maxbredd (px)
                                </label>
                                <input
                                    type="number"
                                    min={1200}
                                    max={12000}
                                    step={100}
                                    value={maxUploadWidth}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (!Number.isFinite(value)) return;
                                        setUploadPresetId('custom');
                                        setMaxUploadWidth(Math.max(1200, Math.min(12000, Math.round(value))));
                                    }}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Kvalitet (%)
                                </label>
                                <input
                                    type="number"
                                    min={45}
                                    max={95}
                                    step={1}
                                    value={uploadQualityPercent}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (!Number.isFinite(value)) return;
                                        setUploadPresetId('custom');
                                        setUploadQualityPercent(Math.max(45, Math.min(95, Math.round(value))));
                                    }}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Format
                                </label>
                                <select
                                    value={uploadFormat}
                                    onChange={(e) => {
                                        setUploadPresetId('custom');
                                        setUploadFormat(e.target.value as 'image/webp' | 'image/jpeg');
                                    }}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value="image/webp">WEBP (mindre)</option>
                                    <option value="image/jpeg">JPEG (kompatibel)</option>
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={cropToControls}
                                disabled={controlsWithRelativePosition.length === 0}
                                onChange={(e) => {
                                    setUploadPresetId('custom');
                                    setCropToControls(e.target.checked);
                                }}
                            />
                            Beskär till kontroller (med marginal)
                        </label>

                        {cropToControls && controlsWithRelativePosition.length > 0 && suggestedCropRect && (
                            <p className="text-xs text-emerald-400">
                                Utsnittet täcker ungefär {suggestedCropCoverage.toFixed(1)}% av hela kartan.
                            </p>
                        )}

                        {cropToControls && controlsWithRelativePosition.length === 0 && (
                            <p className="text-xs text-amber-400">
                                Ingen kontrollposition hittad ännu. Ladda IOF/Purple Pen för auto-beskärning.
                            </p>
                        )}
                    </>
                )}

                {loadingPpen && (
                    <p className="text-xs text-slate-500">Läser in kontrollpositioner...</p>
                )}

                {lastUploadReport && (
                    <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-3">
                        <p className="text-white font-bold mb-1">Senaste uppladdning</p>
                        <p>{buildUploadSummary(lastUploadReport)}</p>
                        <p>
                            {lastUploadReport.originalWidth}×{lastUploadReport.originalHeight}
                            {' → '}
                            {lastUploadReport.width}×{lastUploadReport.height}
                            {' · '}
                            {lastUploadReport.format.replace('image/', '').toUpperCase()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    const mapArchiveCard = (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-widest">Kartarkiv</h3>
            {!user ? (
                <p className="text-xs text-slate-400">
                    Logga in för att spara och återanvända kartor.
                </p>
            ) : (
                <>
                    <div className="grid md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Titel (valfritt)
                            </label>
                            <input
                                value={archiveTitle}
                                onChange={(e) => setArchiveTitle(e.target.value)}
                                placeholder={fullEvent?.map?.name || fullEvent?.name || 'Karta'}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={() => void saveCurrentMapToArchive()}
                                disabled={!fullEvent?.map?.imageUrl}
                                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Spara aktuell karta
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={archiveIncludeCourses}
                                onChange={(e) => setArchiveIncludeCourses(e.target.checked)}
                            />
                            Spara även banor/kontroller
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={archiveIncludeCalibration}
                                onChange={(e) => setArchiveIncludeCalibration(e.target.checked)}
                            />
                            Spara även georeferering
                        </label>
                        {canShareToClub && (
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={archiveShareWithClub}
                                    onChange={(e) => setArchiveShareWithClub(e.target.checked)}
                                />
                                Dela med klubb
                            </label>
                        )}
                    </div>

                    <p className="text-[10px] text-slate-500">
                        Tips: Om du sparar banor/kontroller blir detta även en återanvändbar träningsmall.
                    </p>

                    {archiveStatus && (
                        <p className="text-xs text-emerald-400">{archiveStatus}</p>
                    )}

                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                Vid användning:
                            </span>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={applyArchiveIncludeCalibration}
                                    onChange={(e) => setApplyArchiveIncludeCalibration(e.target.checked)}
                                />
                                Ta med georeferering
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={applyArchiveIncludeCourses}
                                    onChange={(e) => setApplyArchiveIncludeCourses(e.target.checked)}
                                />
                                Ta med banor/kontroller
                            </label>
                        </div>

                        {archiveLoading ? (
                            <p className="text-xs text-slate-400">Laddar kartarkiv...</p>
                        ) : archiveEntries.length === 0 ? (
                            <p className="text-xs text-slate-400">Inga sparade kartor ännu.</p>
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-auto pr-1">
                                {archiveEntries.slice(0, 25).map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between gap-3 bg-slate-900/40 border border-slate-700/40 rounded-lg px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-bold truncate">
                                                {entry.title}
                                                {entry.clubId && (
                                                    <span className="ml-2 text-[10px] uppercase tracking-widest text-slate-400">
                                                        (klubb)
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">
                                                {entry.sourceFileName || entry.imageUrl}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => void applyArchiveEntry(entry)}
                                                disabled={!!applyingArchiveId}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50"
                                            >
                                                {applyingArchiveId === entry.id ? 'Byter...' : 'Använd'}
                                            </button>
                                            {user && entry.ownerUserId === user.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => void removeArchiveEntry(entry)}
                                                    className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700"
                                                >
                                                    Ta bort
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {archiveEntries.length > 25 && (
                                    <p className="text-[10px] text-slate-400">
                                        Visar 25 av {archiveEntries.length} sparade kartor.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    const testDataCard = (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-widest">Testtävling</h3>
            {loadingTestFiles ? (
                <p className="text-xs text-slate-400">Laddar testfiler...</p>
            ) : testFiles.length === 0 ? (
                <p className="text-xs text-slate-400">Inga testfiler hittades under `test*`.</p>
            ) : (
                <>
                    <div className="grid md:grid-cols-3 gap-3 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Kartbild (PNG/JPG/WEBP)
                            </label>
                            <select
                                value={selectedTestMapId}
                                onChange={(e) => setSelectedTestMapId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                            >
                                <option value="">Välj kartbild...</option>
                                {testFiles
                                    .filter((file) => file.kind === 'map-image')
                                    .slice(0, 50)
                                    .map((file) => (
                                        <option key={file.id} value={file.id}>
                                            {file.name} ({formatBytes(file.sizeBytes)})
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => void importTestMap()}
                            disabled={!selectedTestMapId || uploading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Optimera & koppla
                        </button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Banfil (PPEN/XML)
                            </label>
                            <select
                                value={selectedTestCourseId}
                                onChange={(e) => setSelectedTestCourseId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                            >
                                <option value="">Välj banfil...</option>
                                {testFiles
                                    .filter((file) => file.kind === 'course-file')
                                    .slice(0, 80)
                                    .map((file) => (
                                        <option key={file.id} value={file.id}>
                                            {file.name} ({formatBytes(file.sizeBytes)})
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => void importTestCourseFile()}
                            disabled={!selectedTestCourseId || importingCourseFile}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Importera banfil
                        </button>
                    </div>

                    {testImportStatus && (
                        <p className="text-xs text-slate-400">{testImportStatus}</p>
                    )}
                </>
            )}
        </div>
    );

    const mapVisibilityCard = (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-bold text-white mb-3 text-xs uppercase tracking-widest">Kartvisning för deltagare/spektatorer</h3>
            <div className="space-y-3">
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                        Synlighet
                    </label>
                    <select
                        value={visibilityMode}
                        onChange={(e) => setVisibilityMode(e.target.value as 'always' | 'scheduled' | 'hidden')}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                        <option value="always">Alltid visa orienteringskarta</option>
                        <option value="scheduled">Visa enligt schema</option>
                        <option value="hidden">Dölj orienteringskarta</option>
                    </select>
                </div>

                {visibilityMode === 'scheduled' && (
                    <div className="grid md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Visa från (lokal tid)
                            </label>
                            <input
                                type="datetime-local"
                                value={releaseAt}
                                onChange={(e) => setReleaseAt(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                Dölj från (valfritt)
                            </label>
                            <input
                                type="datetime-local"
                                value={hideAt}
                                onChange={(e) => setHideAt(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            />
                        </div>
                    </div>
                )}

                {(visibilityMode === 'hidden' || visibilityMode === 'scheduled') && (
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                            Fallback-karta när OL-karta är dold
                        </label>
                        <select
                            value={fallbackBaseMap}
                            onChange={(e) => setFallbackBaseMap(e.target.value as 'none' | 'osm')}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        >
                            <option value="osm">OpenStreetMap-länk</option>
                            <option value="none">Ingen fallback</option>
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => void saveMapVisibilitySettings()}
                        disabled={!map || uploading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Spara kartvisning
                    </button>
                    {visibilitySaveStatus && (
                        <p className="text-xs text-emerald-400">{visibilitySaveStatus}</p>
                    )}
                </div>
            </div>
        </div>
    );

    if (!map) {
        return (
            <div className="space-y-6">
                {uploadSettingsCard}
                {mapVisibilityCard}
                {mapArchiveCard}
                {testDataCard}

                <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4 opacity-30">🗺️</div>
                    <h3 className="text-lg font-bold text-white mb-2">Ingen karta uppladdad</h3>
                    <p className="text-slate-500 mb-6 text-sm">Ladda upp en kartbild (JPEG, PNG eller WEBP)</p>
                    <label className={`px-8 py-4 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                        {uploading ? uploadStatus || 'Laddar upp...' : '📷 Ladda upp kartbild'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleMapImageUpload} disabled={uploading} />
                    </label>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4">📍 Banläggning (valfritt)</h3>
                    <p className="text-slate-500 text-sm mb-4">Ladda upp Purple Pen, IOF CourseData eller OCAD-export (XML)</p>
                    <label className={`px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-500 text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 ${importingCourseFile ? 'opacity-50 cursor-wait' : ''}`}>
                        {importingCourseFile ? 'Importerar banfil...' : '📂 Ladda upp banfil'}
                        <input type="file" accept=".xml,.ppen" className="hidden" onChange={handlePurplePenFiles} disabled={importingCourseFile} />
                    </label>
                    {ppenControls.length > 0 && (
                        <p className="mt-3 text-sm text-emerald-400">
                            ✓ {ppenControls.length} kontroller och {ppenCourses.length} banor laddade
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {uploadSettingsCard}
            {mapVisibilityCard}
            {mapArchiveCard}
            {testDataCard}

            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">🎯 Karta & Georeferering</h2>
                <div className="flex gap-2 items-center">
                    <label className={`px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-500 text-xs font-bold uppercase tracking-widest ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                        {uploading ? uploadStatus || 'Laddar upp...' : '🖼️ Byt kartbild'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleMapImageUpload} disabled={uploading} />
                    </label>
                    <label className={`px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-500 text-xs font-bold uppercase tracking-widest ${importingCourseFile ? 'opacity-50 cursor-wait' : ''}`}>
                        {importingCourseFile ? 'Importerar...' : '📂 Banfil (XML/PPEN)'}
                        <input type="file" accept=".xml,.ppen" className="hidden" onChange={handlePurplePenFiles} disabled={importingCourseFile} />
                    </label>
                    {calibration && (
                        <button onClick={clearCalibration} className="px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg text-xs font-bold uppercase tracking-widest">
                            Rensa kalibrering
                        </button>
                    )}
                    <button onClick={() => setShowCalibration(true)} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500">
                        {calibration ? '✓ Justera Georeferering' : '🌍 Georeferera Karta'}
                    </button>
                </div>
            </div>

            {calibration ? (
                <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-4">
                    <p className="text-emerald-400 flex items-center gap-2">
                        <span className="text-xl">✓</span>
                        <span><strong>Georefererad!</strong> Kartan är kopplad till verkliga koordinater.</span>
                    </p>
                </div>
            ) : (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                    <p className="text-amber-400 font-bold text-sm">⚠️ Kartan saknar georeferens.</p>
                    <p className="text-amber-300/70 text-xs mt-1">Klicka på "Georeferera Karta" för att koppla kartbilden till GPS-koordinater.</p>
                </div>
            )}

            {allControls.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-400">
                        <strong className="text-white">Banläggning:</strong> {allControls.length} kontroller i {courses.length} banor
                    </p>
                </div>
            )}

            {courses.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Förhandsgranska bana:</label>
                    <select value={selectedPreviewCourseId} onChange={(e) => setSelectedPreviewCourseId(e.target.value)} className="w-full md:w-auto px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
                        <option value="">Visa alla kontroller</option>
                        {courses.map((course: any) => <option key={course.id} value={course.id}>{course.name} ({course.controlIds?.length || 0} kontroller)</option>)}
                    </select>
                </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800">
                    <h3 className="font-bold text-white text-xs uppercase tracking-widest">Kartförhandsvisning</h3>
                </div>
                <div className="relative bg-slate-950">
                    <img src={map.imageUrl} alt="Karta" className="w-full h-auto" style={{ maxHeight: '70vh', objectFit: 'contain' }} />
                    {controlsWithRelativePosition.length > 0 && (
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
                            {(() => {
                                const color = '#d926a9';
                                const strokeWidth = 2;
                                const radius = 8;
                                const selectedCourse = courses.find((c: any) => c.id === selectedPreviewCourseId);
                                const courseControlIds: string[] = selectedCourse?.controlIds || [];
                                const coursePositions: { x: number; y: number; ctrl: any; seqNum: number }[] = [];
                                if (selectedCourse) {
                                    courseControlIds.forEach((controlId: string, idx: number) => {
                                        const ctrl = allControls.find((c: any) => c.id === controlId);
                                        if (ctrl && typeof ctrl.relX === 'number' && typeof ctrl.relY === 'number') {
                                            const pos = getControlPositionPercent(ctrl);
                                            coursePositions.push({ x: pos.x, y: pos.y, ctrl, seqNum: idx + 1 });
                                        }
                                    });
                                } else {
                                    controlsWithRelativePosition.forEach((ctrl: any) => {
                                        const pos = getControlPositionPercent(ctrl);
                                        coursePositions.push({ x: pos.x, y: pos.y, ctrl, seqNum: 0 });
                                    });
                                }
                                return (
                                    <>
                                        {selectedCourse && coursePositions.length > 1 && (
                                            <polyline points={coursePositions.map((p) => `${p.x}%,${p.y}%`).join(' ')} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.8} />
                                        )}
                                        {coursePositions.map((pos, idx) => {
                                            const isStart = pos.ctrl.type === 'start';
                                            const isFinish = pos.ctrl.type === 'finish';
                                            const showSeq = selectedCourse && !isStart && !isFinish;
                                            return (
                                                <g key={`course-${pos.ctrl.id}-${idx}`}>
                                                    {isStart ? (
                                                        <polygon points={`${pos.x}%,${pos.y - 1.5}% ${pos.x - 1.2}%,${pos.y + 0.8}% ${pos.x + 1.2}%,${pos.y + 0.8}%`} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                    ) : isFinish ? (
                                                        <g>
                                                            <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={radius + 3} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                            <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                        </g>
                                                    ) : (
                                                        <circle cx={`${pos.x}%`} cy={`${pos.y}%`} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                    )}
                                                    {showSeq && (
                                                        <text x={`${pos.x}%`} y={`${pos.y}%`} dx={radius + 2} dy={-radius} fill={color} fontSize={12} fontWeight="bold" stroke="white" strokeWidth={3} paintOrder="stroke">{pos.seqNum}</text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </svg>
                    )}
                </div>
            </div>

            {showCalibration && map?.imageUrl && (
                <GCPCalibrationTool
                    imageUrl={map.imageUrl}
                    imageName={fullEvent?.name || 'Karta'}
                    initialGCPs={(fullEvent as any)?.calibrationGCPs || []}
                    initialTransform={calibration as AffineMatrix | undefined}
                    onSave={handleSaveCalibration}
                    onCancel={() => setShowCalibration(false)}
                />
            )}
        </div>
    );
}
