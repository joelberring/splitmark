'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { parseIOFResultList, parseIOFCourseData, formatTime, formatTimeDiff } from '@/lib/import/iofXmlImport';
import { parseWorldFile, latlngToPixel, type WorldFile } from '@/lib/geo/worldfile';
import type { ImportedResult, ImportedCourse, ImportedControl } from '@/lib/import/iofXmlImport';

interface ParsedEvent {
    name: string;
    date: string;
    classes: { id: string; name: string; entryCount: number }[];
    entries: any[];
    results: ImportedResult[];
}

export default function TestEventPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [event, setEvent] = useState<ParsedEvent | null>(null);
    const [courses, setCourses] = useState<ImportedCourse[]>([]);
    const [controls, setControls] = useState<ImportedControl[]>([]);
    const [worldFile, setWorldFile] = useState<WorldFile | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'results' | 'splits' | 'map'>('results');
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [showAllForks, setShowAllForks] = useState(false);
    const [mapImagePath, setMapImagePath] = useState('/api/test-event/map-image');

    // Zoom/pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => { loadTestEvent(); }, []);

    const loadTestEvent = async () => {
        try {
            const res = await fetch('/api/test-event');
            const data = await res.json();
            if (!data.success) { setError(data.error); setLoading(false); return; }
            setMapImagePath(data.mapImagePath || '/api/test-event/map-image');

            if (data.data.resultat) {
                const parsed = parseIOFResultList(data.data.resultat);
                setEvent({ name: data.eventName, date: data.eventDate, classes: parsed.classes || [], entries: parsed.entries || [], results: parsed.results || [] });
                if (parsed.classes?.length) setSelectedClass(parsed.classes[0].id);
            }
            if (data.data.courseData) {
                const { courses: c, controls: ctrl } = parseIOFCourseData(data.data.courseData);
                setCourses(c);
                setControls(ctrl);
                if (c.length > 0) setSelectedCourse(c[0].id);
            }
            if (data.data.worldFile) {
                const wf = parseWorldFile(data.data.worldFile);
                setWorldFile(wf);
            }
            setLoading(false);
        } catch (err) { console.error(err); setError('Failed to load'); setLoading(false); }
    };

    const handleMapImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    // Zoom handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.5), 5));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);
    const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    const getControlPixelPosition = (control: ImportedControl) => {
        if (!worldFile || imageSize.width === 0 || !control.lat || !control.lng) return null;
        try {
            const pixel = latlngToPixel(worldFile, control.lat, control.lng);
            return { x: pixel.x, y: pixel.y };
        } catch { return null; }
    };

    const getCourseControls = () => {
        const course = courses.find(c => c.id === selectedCourse);
        if (!course) return controls;
        return course.controls.map(cid => controls.find(c => c.id === cid || c.code === cid)).filter(Boolean) as ImportedControl[];
    };

    // Get base course name (e.g., "Mellan" from "Mellan AC")
    const getBaseName = (name: string) => name.replace(/\s*[A-Z]{1,2}$/, '').trim();

    // Get all unique base course names
    const baseCourses = [...new Set(courses.map(c => getBaseName(c.name)))];

    // Get all controls from related courses (for forked courses)
    const getAllForkedControls = () => {
        const course = courses.find(c => c.id === selectedCourse);
        if (!course) return [];

        const baseName = getBaseName(course.name);
        const relatedCourses = courses.filter(c => getBaseName(c.name) === baseName);

        if (relatedCourses.length <= 1) return [];

        // Get all unique controls from all related courses
        const allControlIds = new Set<string>();
        relatedCourses.forEach(c => {
            c.controls.forEach(cid => allControlIds.add(cid));
        });

        return Array.from(allControlIds).map(cid =>
            controls.find(c => c.id === cid || c.code === cid)
        ).filter(Boolean) as ImportedControl[];
    };

    // Get all course lines for forked view
    const getAllForkLines = () => {
        const course = courses.find(c => c.id === selectedCourse);
        if (!course) return [];

        const baseName = getBaseName(course.name);
        const relatedCourses = courses.filter(c => getBaseName(c.name) === baseName);

        return relatedCourses.map(c => ({
            name: c.name,
            positions: c.controls
                .map(cid => controls.find(ctrl => ctrl.id === cid || ctrl.code === cid))
                .filter(Boolean)
                .map(ctrl => getControlPixelPosition(ctrl!))
        }));
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div><p className="text-slate-500 mt-4">Laddar...</p></div>
        </div>
    );

    if (error || !event) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="text-center"><div className="text-6xl mb-4 opacity-30">❌</div><h2 className="text-xl font-bold text-white mb-4">{error}</h2><Link href="/admin" className="text-emerald-400">Tillbaka</Link></div>
        </div>
    );

    const selectedClassResults = event.results?.filter(r => r.classId === selectedClass) || [];
    const selectedClassInfo = event.classes?.find(c => c.id === selectedClass);
    const courseControls = getCourseControls();
    const forkedControls = getAllForkedControls();
    const selectedCourseData = courses.find(c => c.id === selectedCourse);

    // Check if course has forks
    const hasForks = forkedControls.length > courseControls.length;

    // IOF standard: thin lines like Livelox
    const strokeWidth = 1.5;
    const controlRadius = 12;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-400 mb-1 inline-block font-bold uppercase tracking-widest">← Tillbaka</Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-bold uppercase tracking-tight">{event.name}</h1>
                            <p className="text-slate-500 text-xs">{event.date}</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-[10px] font-bold uppercase border border-emerald-800/50">{event.entries?.length} deltagare</span>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex gap-4">
                        {[{ id: 'results', label: 'Resultat', icon: '🏆' }, { id: 'splits', label: 'Sträckor', icon: '⏱️' }, { id: 'map', label: 'Karta', icon: '🗺️' }].map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-3 py-3 border-b-2 text-xs font-bold uppercase tracking-wider ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
                                <span>{tab.icon}</span>{tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* Results Tab */}
                {activeTab === 'results' && (
                    <>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {event.classes?.map((cls) => (
                                <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                                    className={`px-3 py-1.5 rounded font-bold text-xs uppercase tracking-widest ${selectedClass === cls.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                    {cls.name} ({cls.entryCount})
                                </button>
                            ))}
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-800/50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase w-10">Plac</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Namn</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Klubb</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Tid</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Diff</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {selectedClassResults.map((r, i) => (
                                        <tr key={r.entryId} className={`hover:bg-slate-800/50 ${i === 0 ? 'bg-emerald-900/10' : ''}`}>
                                            <td className="px-3 py-2"><span className={`font-bold ${i === 0 ? 'text-emerald-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>{r.status === 'OK' ? r.position : r.status}</span></td>
                                            <td className="px-3 py-2 font-bold text-white">{r.name}</td>
                                            <td className="px-3 py-2 text-slate-400 text-sm">{r.club}</td>
                                            <td className="px-3 py-2 text-right font-mono text-white">{formatTime(r.time)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-500 text-sm">{formatTimeDiff(r.timeBehind)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Splits Tab */}
                {activeTab === 'splits' && (() => {
                    // Calculate best leg times and cumulative rankings for each control
                    const numControls = selectedClassResults[0]?.splits.length || 0;

                    // For each control, calculate leg times for all runners
                    const legRankings: { [controlIdx: number]: { [runnerIdx: number]: { legRank: number; cumRank: number } } } = {};

                    for (let controlIdx = 0; controlIdx < numControls; controlIdx++) {
                        // Get leg times for all runners at this control
                        const legTimes = selectedClassResults.map((r, runnerIdx) => {
                            const split = r.splits[controlIdx];
                            const prevTime = controlIdx > 0 ? r.splits[controlIdx - 1]?.time || 0 : 0;
                            const legTime = split ? split.time - prevTime : 999999;
                            const cumTime = split?.time || 999999;
                            return { runnerIdx, legTime, cumTime };
                        });

                        // Sort by leg time to get leg rankings
                        const sortedByLeg = [...legTimes].sort((a, b) => a.legTime - b.legTime);
                        const legRankMap = new Map<number, number>();
                        sortedByLeg.forEach((item, idx) => {
                            if (item.legTime < 999999) legRankMap.set(item.runnerIdx, idx + 1);
                        });

                        // Sort by cumulative time to get current position
                        const sortedByCum = [...legTimes].sort((a, b) => a.cumTime - b.cumTime);
                        const cumRankMap = new Map<number, number>();
                        sortedByCum.forEach((item, idx) => {
                            if (item.cumTime < 999999) cumRankMap.set(item.runnerIdx, idx + 1);
                        });

                        legRankings[controlIdx] = {};
                        selectedClassResults.forEach((_, runnerIdx) => {
                            legRankings[controlIdx][runnerIdx] = {
                                legRank: legRankMap.get(runnerIdx) || 999,
                                cumRank: cumRankMap.get(runnerIdx) || 999,
                            };
                        });
                    }

                    const getLegColor = (rank: number) => {
                        if (rank === 1) return 'text-amber-400 font-bold'; // Gold
                        if (rank === 2) return 'text-slate-300'; // Silver
                        if (rank === 3) return 'text-amber-600'; // Bronze
                        return 'text-slate-500';
                    };

                    const getCumBg = (rank: number) => {
                        if (rank === 1) return 'bg-emerald-900/40';
                        if (rank === 2) return 'bg-slate-700/30';
                        if (rank === 3) return 'bg-amber-900/20';
                        return '';
                    };

                    return (
                        <>
                            <div className="mb-4 flex flex-wrap gap-2">
                                {event.classes?.map((cls) => (
                                    <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                                        className={`px-3 py-1.5 rounded font-bold text-xs uppercase tracking-widest ${selectedClass === cls.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                        {cls.name}
                                    </button>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="mb-3 flex items-center gap-4 text-xs">
                                <span className="text-slate-500">Sträcktid:</span>
                                <span className="text-amber-400">🥇 1:a</span>
                                <span className="text-slate-300">🥈 2:a</span>
                                <span className="text-amber-600">🥉 3:a</span>
                                <span className="text-slate-600 ml-4">|</span>
                                <span className="text-slate-500 ml-2">Bakgrund = ledande vid kontrollen</span>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-800/50">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-400 sticky left-0 bg-slate-800 z-10">Namn</th>
                                            {selectedClassResults[0]?.splits.map((s, i) => <th key={i} className="px-2 py-2 text-center text-[10px] font-bold text-slate-400 min-w-[60px]">{s.controlCode}</th>)}
                                            <th className="px-2 py-2 text-right text-[10px] font-bold text-slate-400">Mål</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {selectedClassResults.slice(0, 20).map((r, runnerIdx) => {
                                            let prev = 0;
                                            return (
                                                <tr key={r.entryId} className="hover:bg-slate-800/50">
                                                    <td className="px-2 py-1.5 font-bold text-white sticky left-0 bg-slate-900 border-r border-slate-800 z-10 whitespace-nowrap">
                                                        <span className={`mr-1 ${r.position === 1 ? 'text-amber-400' : r.position === 2 ? 'text-slate-400' : r.position === 3 ? 'text-amber-600' : 'text-slate-500'}`}>{r.position}.</span>
                                                        {r.name.split(' ')[0]}
                                                    </td>
                                                    {r.splits.map((s, controlIdx) => {
                                                        const leg = s.time - prev;
                                                        prev = s.time;
                                                        const ranks = legRankings[controlIdx]?.[runnerIdx] || { legRank: 999, cumRank: 999 };
                                                        const legColor = getLegColor(ranks.legRank);
                                                        const cumBg = getCumBg(ranks.cumRank);

                                                        return (
                                                            <td key={controlIdx} className={`px-1 py-1.5 text-center ${cumBg}`}>
                                                                <div className="font-mono text-white text-[11px]">{formatTime(s.time)}</div>
                                                                <div className={`font-mono text-[10px] ${legColor}`}>
                                                                    {formatTime(leg)}
                                                                    {ranks.legRank <= 3 && <span className="ml-0.5">({ranks.legRank})</span>}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1.5 text-right font-mono text-white">{formatTime(r.time)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    );
                })()}

                {/* Map Tab - Livelox style with zoom */}
                {activeTab === 'map' && (
                    <div className="flex gap-4 h-[calc(100vh-180px)]">
                        {/* Sidebar */}
                        <div className="w-56 flex-shrink-0 space-y-3 overflow-y-auto">
                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Bana</h4>
                                <div className="space-y-1">
                                    {courses.map((course) => (
                                        <button key={course.id} onClick={() => setSelectedCourse(course.id)}
                                            className={`w-full text-left px-2 py-1.5 rounded text-xs ${selectedCourse === course.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                                            <div className="font-bold">{course.name}</div>
                                            <div className="opacity-70">{course.length ? `${(course.length / 1000).toFixed(1)} km` : ''}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fork toggle */}
                            {hasForks && (
                                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input type="checkbox" checked={showAllForks} onChange={(e) => setShowAllForks(e.target.checked)}
                                            className="rounded border-slate-600 bg-slate-800 text-purple-500" />
                                        <span className="text-slate-300">Visa alla gafflingar</span>
                                    </label>
                                </div>
                            )}

                            {/* Zoom controls */}
                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Zoom</h4>
                                <div className="flex gap-2">
                                    <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="flex-1 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">+</button>
                                    <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="flex-1 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">−</button>
                                    <button onClick={resetView} className="flex-1 py-1.5 bg-slate-800 text-white rounded text-xs hover:bg-slate-700">Reset</button>
                                </div>
                                <div className="text-center text-slate-500 text-xs mt-2">{Math.round(zoom * 100)}%</div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Deltagare</h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {event.results?.filter(r => r.className === selectedCourseData?.name).slice(0, 10).map((r) => (
                                        <div key={r.entryId} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/50 text-[10px]">
                                            <span className="w-3 text-slate-500">{r.position}</span>
                                            <span className="flex-1 text-white truncate">{r.name}</span>
                                            <span className="font-mono text-slate-400">{formatTime(r.time)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Map with zoom/pan */}
                        <div
                            ref={mapContainerRef}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <div
                                className="relative origin-center transition-transform duration-75"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: 'center center'
                                }}
                            >
                                <img
                                    ref={imgRef}
                                    src={mapImagePath}
                                    alt="Karta"
                                    className="w-full h-auto select-none"
                                    draggable={false}
                                    onLoad={handleMapImageLoad}
                                />

                                {/* SVG overlay - Livelox thin style */}
                                {worldFile && imageSize.width > 0 && (
                                    <svg
                                        className="absolute inset-0 w-full h-full pointer-events-none"
                                        viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                                        preserveAspectRatio="xMidYMid meet"
                                    >
                                        {/* Fork controls (if showing all) */}
                                        {showAllForks && forkedControls.map((control) => {
                                            const pos = getControlPixelPosition(control);
                                            if (!pos) return null;
                                            const isInMain = courseControls.some(c => c.id === control.id);
                                            if (isInMain) return null; // Skip main course controls

                                            return (
                                                <circle key={`fork-${control.id}`} cx={pos.x} cy={pos.y} r={controlRadius}
                                                    stroke="#9333EA" strokeWidth={strokeWidth} fill="none" opacity={0.6} strokeDasharray="4,3" />
                                            );
                                        })}

                                        {/* Course lines - solid with breaks at controls (IOF standard) */}
                                        {courseControls.length > 1 && (() => {
                                            const positions = courseControls.map(c => getControlPixelPosition(c)).filter(Boolean) as { x: number; y: number }[];
                                            if (positions.length < 2) return null;

                                            // Draw individual line segments that stop before each control
                                            const gap = controlRadius + 4; // Gap before circle
                                            return positions.slice(0, -1).map((start, i) => {
                                                const end = positions[i + 1];
                                                const dx = end.x - start.x;
                                                const dy = end.y - start.y;
                                                const len = Math.sqrt(dx * dx + dy * dy);
                                                if (len < gap * 2) return null;

                                                // Shorten line at both ends
                                                const ux = dx / len;
                                                const uy = dy / len;
                                                const x1 = start.x + ux * gap;
                                                const y1 = start.y + uy * gap;
                                                const x2 = end.x - ux * gap;
                                                const y2 = end.y - uy * gap;

                                                return (
                                                    <line
                                                        key={`line-${i}`}
                                                        x1={x1} y1={y1} x2={x2} y2={y2}
                                                        stroke="#D926A9"
                                                        strokeWidth={strokeWidth}
                                                        strokeLinecap="round"
                                                    />
                                                );
                                            });
                                        })()}

                                        {/* Controls - thin IOF style */}
                                        {courseControls.map((control, idx) => {
                                            const pos = getControlPixelPosition(control);
                                            if (!pos) return null;

                                            const isStart = control.type === 'start';
                                            const isFinish = control.type === 'finish';
                                            const color = '#D926A9';

                                            return (
                                                <g key={control.id}>
                                                    {isStart ? (
                                                        <polygon
                                                            points={`${pos.x},${pos.y - controlRadius * 1.1} ${pos.x - controlRadius},${pos.y + controlRadius * 0.55} ${pos.x + controlRadius},${pos.y + controlRadius * 0.55}`}
                                                            stroke={color} strokeWidth={strokeWidth} fill="none"
                                                        />
                                                    ) : isFinish ? (
                                                        <g>
                                                            <circle cx={pos.x} cy={pos.y} r={controlRadius * 1.3} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                            <circle cx={pos.x} cy={pos.y} r={controlRadius * 0.85} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                        </g>
                                                    ) : (
                                                        <circle cx={pos.x} cy={pos.y} r={controlRadius} stroke={color} strokeWidth={strokeWidth} fill="none" />
                                                    )}

                                                    {/* Control number */}
                                                    {!isStart && !isFinish && (
                                                        <text x={pos.x + controlRadius + 4} y={pos.y - controlRadius + 4} fill={color} fontSize="14" fontWeight="bold" fontFamily="Arial" stroke="white" strokeWidth="2.5" paintOrder="stroke">
                                                            {idx}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
