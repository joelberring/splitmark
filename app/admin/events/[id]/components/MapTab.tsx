'use client';

import { useState, useEffect } from 'react';
import GCPCalibrationTool from '@/components/GCPCalibrationTool';
import type { GCP, AffineMatrix } from '@/lib/geo/affine';
import { EventData, parsePurplePenData } from './shared';
import { getEvent, saveEvent } from '@/lib/firestore/events';

interface MapTabProps {
    event: EventData;
    eventId: string;
    setEvent: (e: EventData) => void;
}

export default function MapTab({ event, eventId, setEvent }: MapTabProps) {
    const [showCalibration, setShowCalibration] = useState(false);
    const [ppenControls, setPpenControls] = useState<any[]>([]);
    const [ppenCourses, setPpenCourses] = useState<{ id: string; name: string; controlIds: string[] }[]>([]);
    const [loadingPpen, setLoadingPpen] = useState(true);
    const [selectedPreviewCourseId, setSelectedPreviewCourseId] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [fullEvent, setFullEvent] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            const found = await getEvent(eventId);
            if (found) {
                setFullEvent(found);
                if (found.ppenControls && found.ppenControls.length > 0) setPpenControls(found.ppenControls);
                if (found.ppenCourses && found.ppenCourses.length > 0) setPpenCourses(found.ppenCourses);
            }
        };
        load();
    }, [eventId]);

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
                    const { controls, courses } = parsePurplePenData(xmlText);
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

    const getCalibratedPosition = (ctrl: any) => {
        if (calibration && ctrl.relX !== undefined && ctrl.relY !== undefined) {
            const matrix = calibration as AffineMatrix;
            const x = matrix.a * ctrl.relX + matrix.b * ctrl.relY + matrix.c;
            const y = matrix.d * ctrl.relX + matrix.e * ctrl.relY + matrix.f;
            return { x: x * 100, y: y * 100 };
        }
        return { x: (ctrl.relX ?? 0.5) * 100, y: (ctrl.relY ?? 0.5) * 100 };
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
        const { calibration, calibrationGCPs, ...rest } = fullEvent;
        await saveEvent(rest);
        setFullEvent(rest);
    };

    const handlePurplePenFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const { controls, courses } = parsePurplePenData(text);
            if (controls.length === 0) { alert('Inga kontroller hittades.'); return; }
            setPpenControls(controls);
            setPpenCourses(courses);
            alert(`Laddade ${controls.length} kontroller och ${courses.length} banor.`);
        };
        reader.readAsText(file);
    };

    const handleMapImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('raceId', eventId);
        try {
            const res = await fetch('/api/upload-map', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                if (fullEvent) {
                    const updatedEvent = {
                        ...fullEvent,
                        map: { imageUrl: data.url, name: file.name }
                    };
                    await saveEvent(updatedEvent);
                    setFullEvent(updatedEvent);
                }
            } else {
                alert('Uppladdning misslyckades: ' + data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Ett fel uppstod vid uppladdning.');
        } finally {
            setUploading(false);
        }
    };

    if (!map) {
        return (
            <div className="space-y-6">
                <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4 opacity-30">🗺️</div>
                    <h3 className="text-lg font-bold text-white mb-2">Ingen karta uppladdad</h3>
                    <p className="text-slate-500 mb-6 text-sm">Ladda upp en kartbild (JPEG, PNG) för att komma igång</p>
                    <label className={`px-8 py-4 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 cursor-pointer inline-flex items-center gap-2 ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                        {uploading ? 'Laddar upp...' : '📷 Ladda upp kartbild'}
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleMapImageUpload} disabled={uploading} />
                    </label>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4">📍 Banläggning (valfritt)</h3>
                    <p className="text-slate-500 text-sm mb-4">Ladda upp Purple Pen eller IOF XML-fil</p>
                    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-500 text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2">
                        📂 Ladda upp Purple Pen
                        <input type="file" accept=".xml,.ppen" className="hidden" onChange={handlePurplePenFiles} />
                    </label>
                    {ppenControls.length > 0 && <p className="mt-3 text-sm text-emerald-400">✓ {ppenControls.length} kontroller och {ppenCourses.length} banor laddade</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">🎯 Karta & Georeferering</h2>
                <div className="flex gap-2 items-center">
                    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-500 text-xs font-bold uppercase tracking-widest">
                        📂 IOF XML
                        <input type="file" accept=".xml,.ppen" className="hidden" onChange={handlePurplePenFiles} />
                    </label>
                    {calibration && (
                        <button onClick={clearCalibration} className="px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg text-xs font-bold uppercase tracking-widest">Rensa kalibrering</button>
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
                    <p className="text-xs text-slate-400"><strong className="text-white">Banläggning:</strong> {allControls.length} kontroller i {courses.length} banor</p>
                </div>
            )}

            {courses.length > 0 && calibration && (
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
                    {calibration && allControls.length > 0 && (
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
                                        if (ctrl) { const pos = getCalibratedPosition(ctrl); coursePositions.push({ x: pos.x, y: pos.y, ctrl, seqNum: idx + 1 }); }
                                    });
                                } else {
                                    allControls.forEach((ctrl: any) => { const pos = getCalibratedPosition(ctrl); coursePositions.push({ x: pos.x, y: pos.y, ctrl, seqNum: 0 }); });
                                }
                                return (
                                    <>
                                        {selectedCourse && coursePositions.length > 1 && (
                                            <polyline points={coursePositions.map(p => `${p.x}%,${p.y}%`).join(' ')} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.8} />
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
                <GCPCalibrationTool imageUrl={map.imageUrl} imageName={fullEvent?.name || 'Karta'} initialGCPs={(fullEvent as any)?.calibrationGCPs || []} initialTransform={calibration as AffineMatrix | undefined} onSave={handleSaveCalibration} onCancel={() => setShowCalibration(false)} />
            )}
        </div>
    );
}
