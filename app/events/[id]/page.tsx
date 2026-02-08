'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Chat from '@/components/Chat';
import Comments from '@/components/Comments';
import ZoomableMap from '@/components/ZoomableMap';
import EntriesTab from '@/components/Events/EntriesTab';
import ResultsTab from '@/components/Events/ResultsTab';
import RegisterModal from '@/components/Events/RegisterModal';
import { StoredEvent } from '@/types/event';
import type { Entry, EntryWithResult } from '@/types/entry';
import { getEvent } from '@/lib/firestore/events';
import { subscribeToEntries } from '@/lib/firestore/entries';
import { subscribeToResults } from '@/lib/firestore/results';
import { useAuthState } from '@/lib/auth/hooks';
import { getEventAccessProfile } from '@/lib/events/competition';
import {
    getCourseControls,
    normalizePlanningControls,
    normalizePlanningCourses,
} from '@/lib/events/course-planning';

export default function EventDetailsPage() {
    const params = useParams();
    const eventId = params.id as string;
    const { user } = useAuthState();

    const [event, setEvent] = useState<StoredEvent | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [results, setResults] = useState<EntryWithResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'classes' | 'entries' | 'results' | 'map' | 'training' | 'chat'>('info');
    const [showRegisterModal, setShowRegisterModal] = useState(false);

    useEffect(() => {
        let unsubscribeEntries = () => { };
        let unsubscribeResults = () => { };

        const loadData = async () => {
            try {
                const fetchedEvent = await getEvent(eventId);
                if (fetchedEvent) {
                    setEvent(fetchedEvent as unknown as StoredEvent);

                    // Subscribe to entries
                    unsubscribeEntries = subscribeToEntries(eventId, (updatedEntries) => {
                        setEntries(updatedEntries);
                    });

                    // Subscribe to results
                    unsubscribeResults = subscribeToResults(eventId, (updatedResults) => {
                        setResults(updatedResults);
                    });
                }
            } catch (err) {
                console.error('Failed to load event data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        return () => {
            unsubscribeEntries();
            unsubscribeResults();
        };
    }, [eventId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">
                        Tävlingen hittades inte
                    </h2>
                    <Link href="/events" className="text-emerald-500 hover:underline">
                        Tillbaka till tävlingar
                    </Link>
                </div>
            </div>
        );
    }

    const eventAccess = getEventAccessProfile(event, user);
    const isCompleted = eventAccess.status === 'completed';
    const isPastDate = event.date && new Date(event.date) < new Date();
    const hasEntriesCount = entries.length > 0;
    const hasResultsCount = results.length > 0;
    const showResults = eventAccess.canViewResults || isPastDate || hasResultsCount;
    const canRegister = eventAccess.canRegister;
    const canRequestRegistration = eventAccess.status === 'upcoming';
    const hasMap = event.map && event.map.imageUrl;
    const hasTrainingCourses = normalizePlanningCourses((event as any).ppenCourses).length > 0;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <style jsx global>{`
                @media print {
                    header, 
                    nav,
                    footer,
                    .no-print,
                    button:not(.print-visible) {
                        display: none !important;
                    }
                    .min-h-screen {
                        background: white !important;
                        color: black !important;
                    }
                    .bg-slate-950, .bg-slate-900, .bg-slate-800 {
                        background: white !important;
                        color: black !important;
                        border-color: #eee !important;
                    }
                    .text-white, .text-slate-200, .text-slate-300, .text-slate-400 {
                        color: black !important;
                    }
                    .text-emerald-400, .text-emerald-500 {
                        color: #10b981 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .max-w-7xl {
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .shadow-lg, .shadow-sm, .shadow-2xl {
                        box-shadow: none !important;
                    }
                    tr, div {
                        page-break-inside: avoid;
                    }
                }
            `}</style>
            <PageHeader
                title={event.name}
                subtitle={`${event.organizer || 'Arrangör'} · ${event.classification || 'Tävling'}`}
                backHref="/events"
                backLabel="Tävlingar"
                showLogo
                rightAction={
                    <div className="flex items-center gap-3">
                        {isCompleted && (
                            <span className="px-3 py-1.5 rounded bg-emerald-900/30 text-emerald-400 text-[10px] font-black border border-emerald-800/50 uppercase tracking-widest">
                                Avslutad
                            </span>
                        )}
                        {canRequestRegistration && (
                            <button
                                onClick={() => {
                                    if (!user) {
                                        window.location.href = `/login?redirect=/events/${event.id}`;
                                        return;
                                    }
                                    setShowRegisterModal(true);
                                }}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded font-black shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all active:scale-95 uppercase tracking-widest text-xs"
                            >
                                {canRegister ? 'Anmäl' : 'Logga in för anmälan'}
                            </button>
                        )}
                    </div>
                }
            />

            {/* Event Info Bar */}
            <div className="bg-slate-900/50 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-500 overflow-x-auto no-scrollbar">
                    {event.date && (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-emerald-500 text-base">📅</span>
                            {new Date(event.date).toLocaleDateString('sv-SE', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                            })}
                            {event.time && ` kl ${event.time}`}
                        </div>
                    )}
                    {event.location && (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-emerald-500 text-base">📍</span> {event.location}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-slate-900 border-b border-slate-800 sticky top-[120px] md:top-[128px] z-30">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex gap-1 overflow-x-auto no-scrollbar">
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
                        {(hasEntriesCount || !showResults) && (
                            <TabButton
                                active={activeTab === 'entries'}
                                onClick={() => setActiveTab('entries')}
                                label={`Anmälda ${entries.length > 0 ? `(${entries.length})` : ''}`}
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
                                label="Karta"
                            />
                        )}
                        {hasTrainingCourses && (
                            <TabButton
                                active={activeTab === 'training'}
                                onClick={() => setActiveTab('training')}
                                label="Träning"
                            />
                        )}
                        <TabButton
                            active={activeTab === 'chat'}
                            onClick={() => setActiveTab('chat')}
                            label="Chat"
                        />
                        <button
                            onClick={() => window.print()}
                            className="ml-auto py-4 px-3 text-slate-500 hover:text-white font-bold text-[10px] uppercase tracking-widest no-print"
                        >
                            🖨️ Skriv ut
                        </button>
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'info' && <InfoTab event={event} />}
                {activeTab === 'classes' && <ClassesTab event={event} />}
                {activeTab === 'entries' && <EntriesTab event={event} entries={entries} />}
                {activeTab === 'results' && <ResultsTab event={event} results={results} />}
                {activeTab === 'map' && hasMap && <MapTab event={event} />}
                {activeTab === 'training' && hasTrainingCourses && <TrainingTab event={event} />}
                {activeTab === 'chat' && (
                    eventAccess.canUseSocialFeatures ? (
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
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
                            <p className="text-slate-300 font-bold">Logga in för att använda chat och kommentarer.</p>
                            <a href={`/login?redirect=/events/${event.id}`} className="inline-block mt-4 text-emerald-400 font-bold hover:underline">
                                Till inloggning
                            </a>
                        </div>
                    )
                )}
            </div>

            {/* Registration Modal */}
            {showRegisterModal && (
                <RegisterModal
                    event={event}
                    onClose={() => setShowRegisterModal(false)}
                    onSuccess={() => {
                        setShowRegisterModal(false);
                        // Subscriptions will handle the update automatically
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
    const visibility = (event.map as any)?.visibility || {};
    const visibilityMode = visibility.mode || 'always';
    const releaseAtDate = visibility.releaseAt ? new Date(visibility.releaseAt) : null;
    const hideAtDate = visibility.hideAt ? new Date(visibility.hideAt) : null;
    const now = new Date();

    let mapIsVisible = true;
    let mapVisibilityMessage = '';

    if (visibilityMode === 'hidden') {
        mapIsVisible = false;
        mapVisibilityMessage = 'Arrangören har dolt orienteringskartan.';
    } else if (visibilityMode === 'scheduled') {
        if (releaseAtDate && now < releaseAtDate) {
            mapIsVisible = false;
            mapVisibilityMessage = `Kartan visas ${releaseAtDate.toLocaleString('sv-SE')}.`;
        } else if (hideAtDate && now >= hideAtDate) {
            mapIsVisible = false;
            mapVisibilityMessage = `Kartan stängdes ${hideAtDate.toLocaleString('sv-SE')}.`;
        }
    }

    const fallbackBaseMap = visibility.fallbackBaseMap || 'osm';
    const osmFallbackUrl = event.location
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}`
        : 'https://www.openstreetmap.org';

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
                {mapIsVisible ? (
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
                ) : (
                    <div className="p-8 text-center bg-slate-950">
                        <div className="text-5xl opacity-20 mb-4">🔒</div>
                        <p className="text-white font-bold mb-2">Kartan är tillfälligt dold</p>
                        <p className="text-sm text-slate-400 mb-4">{mapVisibilityMessage || 'Kartan är inte tillgänglig just nu.'}</p>
                        {fallbackBaseMap === 'osm' && (
                            <a
                                href={osmFallbackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-500"
                            >
                                Öppna OpenStreetMap
                            </a>
                        )}
                    </div>
                )}
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

function TrainingTab({ event }: { event: StoredEvent }) {
    const courses = normalizePlanningCourses((event as any).ppenCourses);
    const controls = normalizePlanningControls((event as any).ppenControls);

    if (courses.length === 0) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-10 text-center">
                <p className="text-slate-500 text-sm uppercase tracking-widest font-bold">
                    Inga träningsbanor publicerade.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white uppercase tracking-wide mb-3">
                    GPS-träning & Utskrift
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                    Kör banan i mobilen med GPS-stämpling och ljudsignal vid kontroller, eller öppna en utskriftsvänlig version för PDF.
                </p>
                <div className="flex gap-3 flex-wrap">
                    <a
                        href={`/events/${event.id}/training`}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500"
                    >
                        Starta träningsläge
                    </a>
                    <a
                        href={`/events/${event.id}/print`}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-500"
                    >
                        Utskrift / PDF
                    </a>
                </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {courses.map((course) => {
                    const courseControls = getCourseControls(course, controls);
                    const hasGpsCoverage = courseControls.every((control) =>
                        typeof control.lat === 'number'
                        && Number.isFinite(control.lat)
                        && typeof control.lng === 'number'
                        && Number.isFinite(control.lng)
                    );

                    return (
                        <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                            <h3 className="font-bold text-white text-lg">{course.name}</h3>
                            <div className="mt-3 text-xs text-slate-400 space-y-1 uppercase tracking-widest font-bold">
                                <p>{courseControls.length} kontroller</p>
                                <p>{course.gpsMode.enabled ? 'GPS-läge aktivt' : 'GPS-läge avstängt'}</p>
                                <p>{hasGpsCoverage ? 'GPS-koordinater kompletta' : 'Saknar vissa GPS-koordinater'}</p>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <a
                                    href={`/events/${event.id}/training?course=${course.id}`}
                                    className="flex-1 px-3 py-2 bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-widest text-center hover:bg-emerald-600"
                                >
                                    Mobil
                                </a>
                                <a
                                    href={`/events/${event.id}/print?course=${course.id}`}
                                    className="flex-1 px-3 py-2 bg-indigo-700 text-white rounded text-[10px] font-bold uppercase tracking-widest text-center hover:bg-indigo-600"
                                >
                                    PDF
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
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
