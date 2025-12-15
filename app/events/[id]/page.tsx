'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Chat from '@/components/Chat';
import Comments from '@/components/Comments';
import ZoomableMap from '@/components/ZoomableMap';
import EntriesTab from '@/components/Events/EntriesTab';
import ResultsTab from '@/components/Events/ResultsTab';
import RegisterModal from '@/components/Events/RegisterModal';
import { StoredEvent } from '@/types/event';

export default function EventDetailsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<StoredEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'classes' | 'entries' | 'results' | 'map' | 'chat'>('info');
    const [showRegisterModal, setShowRegisterModal] = useState(false);

    useEffect(() => {
        loadEvent();
    }, [eventId]);

    const loadEvent = () => {
        const stored = localStorage.getItem('events');
        if (stored) {
            const events = JSON.parse(stored);
            const found = events.find((e: StoredEvent) => e.id === eventId);
            if (found) {
                setEvent(found);
            }
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Event not found
                    </h2>
                    <Link href="/events" className="text-emerald-600 hover:underline">
                        Back to events
                    </Link>
                </div>
            </div>
        );
    }

    const isCompleted = event.status === 'completed';
    const isPastDate = event.date && new Date(event.date) < new Date();
    const hasEntries = event.entries && event.entries.length > 0;
    const hasFinishedEntries = event.entries?.some((e: any) => e.status === 'finished' || e.result);
    const showResults = (isCompleted || isPastDate) && hasFinishedEntries;
    const canRegister = !isCompleted && !isPastDate;
    const hasMap = event.map && event.map.imageUrl;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 shadow-lg border-b border-slate-800 relative z-10">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <Link
                        href="/events"
                        className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-6 inline-block transition-colors group"
                    >
                        <span className="group-hover:-translate-x-1 inline-block transition-transform">←</span> Tillbaka till tävlingar
                    </Link>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                                <h1 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">
                                    {event.name}
                                </h1>
                                {isCompleted && (
                                    <span className="px-3 py-1 rounded bg-emerald-950/30 text-emerald-500 text-[10px] font-bold border border-emerald-900/50 uppercase tracking-widest">
                                        Avslutad
                                    </span>
                                )}
                                {event.classification && (
                                    <span className={`px-3 py-1 rounded text-[10px] font-bold border uppercase tracking-widest ${event.classification === 'National'
                                        ? 'bg-purple-950/20 text-purple-400 border-purple-900/30'
                                        : 'bg-blue-950/20 text-blue-400 border-blue-900/30'
                                        }`}>
                                        {event.classification}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-6 text-slate-400 mt-4 flex-wrap text-sm font-medium">
                                {event.date && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-500">📅</span>
                                        {new Date(event.date).toLocaleDateString('sv-SE', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                        {event.time && ` @ ${event.time}`}
                                    </div>
                                )}
                                {event.organizer && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-500">🏃</span> {event.organizer}
                                    </div>
                                )}
                                {event.location && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-500">📍</span> {event.location}
                                    </div>
                                )}
                            </div>
                        </div>

                        {canRegister && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRegisterModal(true)}
                                    className="px-8 py-4 bg-emerald-600 text-white rounded font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest text-sm"
                                >
                                    Anmäl dig nu
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-6 mt-4">
                    <nav className="flex gap-8 border-slate-800 overflow-x-auto no-scrollbar">
                        <TabButton
                            active={activeTab === 'info'}
                            onClick={() => setActiveTab('info')}
                            label="Info"
                        />
                        <TabButton
                            active={activeTab === 'classes'}
                            onClick={() => setActiveTab('classes')}
                            label="Klasser"
                        />
                        {hasEntries && !showResults && (
                            <TabButton
                                active={activeTab === 'entries'}
                                onClick={() => setActiveTab('entries')}
                                label={`Anmälda (${event.entries?.length || 0})`}
                            />
                        )}
                        {showResults && (
                            <TabButton
                                active={activeTab === 'results'}
                                onClick={() => setActiveTab('results')}
                                label="Resultat"
                            />
                        )}
                        {hasMap && (
                            <TabButton
                                active={activeTab === 'map'}
                                onClick={() => setActiveTab('map')}
                                label="🗺️ Karta"
                            />
                        )}
                        <TabButton
                            active={activeTab === 'chat'}
                            onClick={() => setActiveTab('chat')}
                            label="💬 Chat"
                        />
                    </nav>
                </div>
            </header>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'info' && <InfoTab event={event} />}
                {activeTab === 'classes' && <ClassesTab event={event} />}
                {activeTab === 'entries' && <EntriesTab event={event} />}
                {activeTab === 'results' && <ResultsTab event={event} />}
                {activeTab === 'map' && hasMap && <MapTab event={event} />}
                {activeTab === 'chat' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden h-[600px]">
                            <Chat
                                roomId={`event-${eventId}`}
                                roomName={event.name}
                                roomType="event"
                            />
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
                            <Comments
                                resourceType="event"
                                resourceId={eventId}
                                showQA
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            {showRegisterModal && (
                <RegisterModal
                    event={event}
                    onClose={() => setShowRegisterModal(false)}
                    onSuccess={() => {
                        setShowRegisterModal(false);
                        loadEvent(); // Reload to show updated entries
                    }}
                />
            )}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`pb-4 px-1 border-b-2 transition-all font-bold text-xs uppercase tracking-widest whitespace-nowrap ${active
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-white hover:border-slate-700'
                }`}
        >
            {label}
        </button>
    );
}

function InfoTab({ event }: { event: StoredEvent }) {
    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4 uppercase tracking-wide">
                    Tävlingsinformation
                </h2>

                <div className="space-y-4">
                    {event.date && <InfoRow label="Datum" value={event.date} />}
                    {event.time && <InfoRow label="Tid" value={event.time} />}
                    {event.location && <InfoRow label="Plats" value={event.location} />}
                    {event.organizer && <InfoRow label="Arrangör" value={event.organizer} />}
                    {event.classification && <InfoRow label="Typ" value={event.classification} />}
                    {event.status && <InfoRow label="Status" value={event.status === 'completed' ? 'Avslutad' : 'Kommande'} />}
                </div>

                {event.description && (
                    <div className="mt-6 p-4 bg-slate-950/50 rounded border border-slate-800/50">
                        <p className="text-slate-300 leading-relaxed text-sm">{event.description}</p>
                    </div>
                )}

                {event.googleMapsUrl && (
                    <div className="mt-6">
                        <a
                            href={event.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300 hover:underline bg-emerald-950/30 px-4 py-3 rounded transition-colors border border-emerald-900/30 hover:border-emerald-500/50"
                        >
                            <span>📍</span> Öppna i Google Maps
                        </a>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-8">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4 uppercase tracking-wide">
                        Dokument & Länkar
                    </h2>

                    {event.attachments && event.attachments.length > 0 ? (
                        <div className="space-y-3">
                            {event.attachments.map((att) => (
                                <DocumentLink
                                    key={att.id}
                                    icon={att.type === 'pdf' ? '📄' : '🔗'}
                                    label={att.name}
                                    href={att.url}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 italic text-sm">Inga dokument uppladdade.</p>
                    )}
                </div>

                {/* Images */}
                {event.images && event.images.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-8">
                        <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4 uppercase tracking-wide">
                            Galleri
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {event.images.map((img) => (
                                <div key={img.id} className="aspect-square rounded overflow-hidden border border-slate-700 bg-slate-800">
                                    <img src={img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ClassesTab({ event }: { event: StoredEvent }) {
    const classes = event.classes || [];
    const courses = event.courses || [];

    if (classes.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-12 text-center">
                <p className="text-slate-500 text-lg uppercase tracking-wide">Inga klasser definierade.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((cls: any) => {
                    const course = courses.find((c: any) => c.id === cls.courseId);
                    return (
                        <div key={cls.id} className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6 hover:border-emerald-500/30 transition-all group">
                            <h3 className="text-xl font-bold text-white mb-4 group-hover:text-emerald-400 transition-colors">
                                {cls.name}
                            </h3>
                            {course && (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Bana</span>
                                        <span className="font-bold text-slate-300">{course.name}</span>
                                    </div>
                                    {course.length > 0 && (
                                        <div className="flex justify-between border-b border-slate-800 pb-2">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Längd</span>
                                            <span className="font-bold text-slate-300">{(course.length / 1000).toFixed(1)} km</span>
                                        </div>
                                    )}
                                    {course.controls?.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Kontroller</span>
                                            <span className="font-bold text-slate-300">{course.controls.length}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {cls.entryCount > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ANMÄLDA</span>
                                    <span className="text-emerald-400 font-bold bg-emerald-950/30 px-2 py-1 rounded text-xs border border-emerald-900/50">
                                        {cls.entryCount}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MapTab({ event }: { event: StoredEvent }) {
    const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
    const [ppenControls, setPpenControls] = useState<Map<string, { relX: number; relY: number }>>(new Map());
    const courses = (event as any).ppenCourses || event.courses || [];

    // Load Purple Pen data to get control positions
    useEffect(() => {
        // Option 1: Use saved Purple Pen data from event (from Admin save)
        if ((event as any).ppenControls && Array.isArray((event as any).ppenControls)) {
            console.log('Using saved Purple Pen controls from event');
            const map = new Map<string, { relX: number; relY: number }>();
            (event as any).ppenControls.forEach((c: any) => {
                if (c.code && c.relX !== undefined && c.relY !== undefined) {
                    map.set(c.code, { relX: c.relX, relY: c.relY });
                }
            });
            setPpenControls(map);
            return;
        }

        // Option 2: Fallback to test data (only for demo events)
        const loadPurplePen = async () => {
            try {
                const response = await fetch('/api/test-data/purplepen');
                if (!response.ok) return;

                const xmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlText, 'text/xml');

                // Get print area
                const printAreaEl = doc.querySelector('print-area');
                const printArea = {
                    left: parseFloat(printAreaEl?.getAttribute('left') || '0'),
                    top: parseFloat(printAreaEl?.getAttribute('top') || '1000'),
                    right: parseFloat(printAreaEl?.getAttribute('right') || '1000'),
                    bottom: parseFloat(printAreaEl?.getAttribute('bottom') || '0'),
                };

                const mapWidth = printArea.right - printArea.left;
                const mapHeight = printArea.top - printArea.bottom;

                // Build control position map
                const positions = new Map<string, { relX: number; relY: number }>();
                const controlEls = doc.querySelectorAll('control');
                controlEls.forEach((ctrl) => {
                    const kind = ctrl.getAttribute('kind') || 'normal';
                    const code = ctrl.querySelector('code')?.textContent ||
                        (kind === 'start' ? 'S' : kind === 'finish' ? 'M' : ctrl.getAttribute('id') || '');
                    const locationEl = ctrl.querySelector('location');
                    const x = parseFloat(locationEl?.getAttribute('x') || '0');
                    const y = parseFloat(locationEl?.getAttribute('y') || '0');

                    const relX = (x - printArea.left) / mapWidth;
                    const relY = 1 - ((y - printArea.bottom) / mapHeight);

                    positions.set(code, { relX, relY });
                });

                setPpenControls(positions);
            } catch (e) {
                console.log('Could not load Purple Pen data');
            }
        };

        loadPurplePen();
    }, []);

    // Enrich course controls with positions
    const getEnrichedCourse = (course: any) => {
        if (!course) return null;

        // NEW: Handle Purple Pen course format (with controlIds)
        if (course.controlIds && Array.isArray(course.controlIds) && (event as any).ppenControls) {
            const controls = course.controlIds.map((id: string) => {
                const ppenCtrls = (event as any).ppenControls as any[];
                const found = ppenCtrls.find(c => c.id === id);
                // Ensure found control has type/code for ZoomableMap
                return found || { id, code: '?', type: 'control' };
            });
            return { ...course, controls };
        }

        // OLD: Legacy format - enrich via code map
        return {
            ...course,
            controls: course.controls?.map((ctrl: any) => {
                // Check if position already exists
                if (ctrl.relX !== undefined && ctrl.relY !== undefined) {
                    return ctrl;
                }
                // Try to get from Purple Pen data (Map: code -> {relX, relY})
                const pos = ppenControls.get(ctrl.code);
                if (pos) {
                    return { ...ctrl, relX: pos.relX, relY: pos.relY };
                }
                return ctrl;
            }) || [],
        };
    };

    if (!event.map) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-12 text-center">
                <div className="text-6xl mb-6 opacity-20 grayscale">🗺️</div>
                <p className="text-slate-500 text-lg uppercase tracking-wide">Ingen karta uppladdad än.</p>
            </div>
        );
    }

    const selectedCourse = getEnrichedCourse(courses.find((c: any) => c.id === selectedCourseId));

    return (
        <div className="space-y-8">
            {/* Course Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                            Visa bana:
                        </label>
                        <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="px-4 py-2 rounded bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all min-w-[200px] uppercase tracking-wide text-xs font-bold"
                        >
                            <option value="all">Alla banor (Endast karta)</option>
                            {courses.map((course: any) => (
                                <option key={course.id} value={course.id}>
                                    {course.name} ({(course.length / 1000).toFixed(1)} km)
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedCourse && (
                        <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">
                            {selectedCourse.controls?.length || 0} Kontroller
                        </div>
                    )}
                </div>
            </div>

            {/* Map Display */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                            🗺️ {selectedCourse ? selectedCourse.name : 'Orienteringskarta'}
                        </h2>
                        {event.map.bounds && (
                            <p className="text-xs font-mono text-slate-500 mt-1">
                                Skala 1:{(event.map as any).scale || 'Okänd'}
                            </p>
                        )}
                    </div>
                    {selectedCourse && selectedCourse.controls?.length > 0 && (
                        <div className="text-[10px] font-bold uppercase tracking-widest bg-emerald-950/30 text-emerald-400 px-3 py-1 rounded border border-emerald-900/50">
                            {selectedCourse.controls.length} Kontroller • {(selectedCourse.length / 1000).toFixed(1)} km
                        </div>
                    )}
                </div>

                {/* Interactive Map with Zoom/Pan and Course Overlay */}
                <div className="relative">
                    <ZoomableMap
                        imageUrl={event.map.imageUrl}
                        bounds={event.map.bounds}
                        course={selectedCourse}
                        calibration={(event as any).calibration}
                        calibrationAnchors={(event as any).calibrationAnchors}
                        className="rounded-b-lg"
                    />
                </div>
            </div>

            {/* Course Details */}
            {selectedCourse && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2 uppercase tracking-wide">
                        Baninformation: <span className="text-emerald-400">{selectedCourse.name}</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-slate-950/30 rounded border border-slate-800">
                            <div className="text-2xl font-bold font-mono text-emerald-500">
                                {(selectedCourse.length / 1000).toFixed(1)}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">km</div>
                        </div>
                        <div className="text-center p-4 bg-slate-950/30 rounded border border-slate-800">
                            <div className="text-2xl font-bold font-mono text-white">
                                {selectedCourse.climb || '-'}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">m stigning</div>
                        </div>
                        <div className="text-center p-4 bg-slate-950/30 rounded border border-slate-800">
                            <div className="text-2xl font-bold font-mono text-white">
                                {selectedCourse.controls?.filter((c: any) => c.type === 'control').length || 0}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">kontroller</div>
                        </div>
                        <div className="text-center p-4 bg-slate-950/30 rounded border border-slate-800">
                            <div className="text-2xl font-bold font-mono text-white">
                                {event.classes?.filter((c: any) => c.courseId === selectedCourse.id).length || 0}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">klasser</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between py-3 border-b border-slate-800 last:border-0">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">{label}</span>
            <span className="font-bold text-slate-200">{value}</span>
        </div>
    );
}

function DocumentLink({ icon, label, href }: { icon: string; label: string; href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded bg-slate-950 hover:bg-emerald-950/20 border border-slate-800 hover:border-emerald-500/30 transition-colors group"
        >
            <span className="text-2xl opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
            <span className="text-slate-300 font-bold group-hover:text-emerald-400 transition-colors text-sm uppercase tracking-wide">{label}</span>
            <svg className="w-5 h-5 ml-auto text-slate-600 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </a>
    );
}
