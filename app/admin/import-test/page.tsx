'use client';

import { useState, useEffect } from 'react';
import { parseResultListXML, parseCourseDataXML, importParsedEventToLocalStorage, parsePurplePenXML } from '@/lib/import/iof-xml-parser';
import Link from 'next/link';

export default function ImportTestDataPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [importedEventId, setImportedEventId] = useState<string | null>(null);

    const loadTestData = async () => {
        setStatus('loading');
        setMessage('Laddar testfiler...');

        try {
            // Load the results XML file
            const resultsResponse = await fetch('/api/test-data/results');
            if (!resultsResponse.ok) {
                throw new Error('Kunde inte ladda resultatfil');
            }
            const resultsXml = await resultsResponse.text();

            // Parse results
            setMessage('Tolkar resultat...');
            const parsedEvent = parseResultListXML(resultsXml);

            // Try to load course data for GPS coordinates
            try {
                const coursesResponse = await fetch('/api/test-data/courses');
                if (coursesResponse.ok) {
                    const coursesXml = await coursesResponse.text();
                    const { controls, courses } = parseCourseDataXML(coursesXml);

                    // Merge GPS coordinates into courses
                    parsedEvent.courses = parsedEvent.courses.map(course => {
                        const matchingCourse = courses.find(c =>
                            c.name.toLowerCase() === course.name.toLowerCase()
                        );
                        if (matchingCourse) {
                            return {
                                ...course,
                                controls: matchingCourse.controls.map((ctrl, i) => ({
                                    ...ctrl,
                                    lat: controls.find(c => c.code === ctrl.code)?.lat,
                                    lng: controls.find(c => c.code === ctrl.code)?.lng,
                                })),
                            };
                        }
                        return course;
                    });
                }
            } catch (e) {
                console.log('Course data not available, continuing without GPS coordinates');
            }

            // Try to load map georeferencing data
            let mapData = null;
            try {
                setMessage('Laddar kartdata...');
                const georefResponse = await fetch('/api/test-data/georef');
                if (georefResponse.ok) {
                    mapData = await georefResponse.json();
                }
            } catch (e) {
                console.log('Map georef not available');
            }

            // Try to load Purple Pen data for control positions
            try {
                setMessage('Laddar bandata från Purple Pen...');
                const ppenResponse = await fetch('/api/test-data/purplepen');
                if (ppenResponse.ok) {
                    const ppenXml = await ppenResponse.text();
                    const ppenData = parsePurplePenXML(ppenXml);

                    if (ppenData) {
                        // Create a map of control codes to relative positions
                        const controlPositions = new Map<string, { relX: number; relY: number }>();
                        ppenData.controls.forEach(ctrl => {
                            if (ctrl.relX !== undefined && ctrl.relY !== undefined) {
                                controlPositions.set(ctrl.code, { relX: ctrl.relX, relY: ctrl.relY });
                            }
                        });

                        // Update courses with control positions
                        parsedEvent.courses = parsedEvent.courses.map(course => ({
                            ...course,
                            controls: course.controls.map(ctrl => {
                                const pos = controlPositions.get(ctrl.code);
                                if (pos) {
                                    return { ...ctrl, relX: pos.relX, relY: pos.relY };
                                }
                                return ctrl;
                            }),
                        }));

                        console.log(`Added positions for ${controlPositions.size} controls from Purple Pen`);
                    }
                }
            } catch (e) {
                console.log('Purple Pen data not available, continuing without control positions');
            }

            // Import to localStorage with map data
            setMessage('Sparar till app...');
            const eventId = importParsedEventWithMap(parsedEvent, mapData);
            setImportedEventId(eventId);

            setStatus('success');
            setMessage(`Importerade "${parsedEvent.name}" med ${parsedEvent.results.length} resultat${mapData ? ' och karta!' : '!'}`);

        } catch (error) {
            console.error('Import error:', error);
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Import misslyckades');
        }
    };

    // Updated import function that includes map data
    const importParsedEventWithMap = (event: any, mapData: any): string => {
        const eventId = `event-${Date.now()}`;

        const appEvent = {
            id: eventId,
            name: event.name,
            date: event.date,
            time: '17:30',
            location: 'Älvsjö',
            organizer: 'OK Älvsjö-Örby',
            classification: 'Local',
            description: 'Importerad tävling från ÄNS testfiler',
            status: 'completed',
            // Map data
            map: mapData ? {
                imageUrl: mapData.mapImageUrl,
                bounds: mapData.bounds,
                scale: 4000,
            } : null,
            // Classes
            classes: event.classes.map((c: any) => ({
                id: c.id,
                name: c.name,
                hasPool: c.hasPool,               // NEW: Pool indicator
                poolId: c.poolId,
                courseId: c.courseId,
                courseName: c.courseName,
                courseVariants: c.courseVariants,
                forkKeys: c.forkKeys,             // NEW: Fork keys (AC, AD, BC, BD)
                entryCount: event.results.filter((r: any) => r.classId === c.id).length,
            })),
            // Courses
            courses: event.courses.map((c: any) => ({
                id: c.id,
                eventId,
                name: c.name,
                length: c.length,
                climb: c.climb || 0,
                controls: c.controls.map((ctrl: any) => ({
                    id: ctrl.id,
                    code: ctrl.code,
                    type: ctrl.type,
                    order: ctrl.order,
                    lat: ctrl.lat,
                    lng: ctrl.lng,
                })),
                classIds: event.classes.filter((cls: any) => cls.courseId === c.id).map((cls: any) => cls.id),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })),
            // Entries (from results)
            entries: event.results.map((r: any) => ({
                id: r.personId,
                name: `${r.firstName} ${r.lastName}`,
                firstName: r.firstName,
                lastName: r.lastName,
                club: r.club,
                clubId: r.clubId,
                classId: r.classId,
                siCard: r.siCard,
                startTime: r.startTime,
                finishTime: r.finishTime,
                time: r.time,
                status: r.status === 'OK' ? 'finished' : r.status === 'DNS' ? 'dns' : r.status === 'DNF' ? 'dnf' : 'finished',
                position: r.position,
                splitTimes: r.splitTimes,
            })),
            images: [],
            attachments: [],
            googleMapsUrl: '',
            registrationSettings: {
                deadline: '',
                lateDeadline: '',
                allowLateRegistration: false,
                lateRegistrationFee: 0,
                allowDirectRegistration: false,
                directRegistrationClasses: [],
                directRegistrationAllClasses: true,
            },
            gpsMode: { enabled: false, sensitivity: 'standard' },
            spectatorMode: {
                showOLMapToSpectators: true,
                showCourseToSpectators: true,
                courseVisibleAfterFinish: true,
            },
            createdAt: new Date().toISOString(),
            createdBy: 'import',
        };

        const storedEvents = localStorage.getItem('events');
        const events = storedEvents ? JSON.parse(storedEvents) : [];
        events.push(appEvent);
        localStorage.setItem('events', JSON.stringify(events));

        return eventId;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                    📥 Importera Testdata
                </h1>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Älvsjö Night Sprint - Testdata
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Laddar data från testtävling/äns-mappen:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                        <li>• <strong>Resultat:</strong> resultat äns ver2.xml (IOF XML 3.0)</li>
                        <li>• <strong>Banor:</strong> ÄNS 20251202.xml (Purple Pen export)</li>
                        <li>• <strong>Karta:</strong> karta_bildfil.png (40 MB)</li>
                        <li>• <strong>Georef:</strong> karta_bildfil.pgw (SWEREF99 TM)</li>
                    </ul>

                    {status === 'idle' && (
                        <button
                            onClick={loadTestData}
                            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
                        >
                            Importera testdata
                        </button>
                    )}

                    {status === 'loading' && (
                        <div className="flex items-center justify-center gap-3 py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                            <span className="text-gray-600 dark:text-gray-400">{message}</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                                <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                                    ✅ {message}
                                </p>
                            </div>
                            {importedEventId && (
                                <div className="flex gap-3">
                                    <Link
                                        href={`/admin/events/${importedEventId}`}
                                        className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold text-center"
                                    >
                                        Öppna i Admin
                                    </Link>
                                    <Link
                                        href={`/events/${importedEventId}`}
                                        className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold text-center"
                                    >
                                        Visa tävling
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <p className="text-red-700 dark:text-red-300">
                                ❌ {message}
                            </p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="mt-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                            >
                                Försök igen
                            </button>
                        </div>
                    )}
                </div>

                <Link
                    href="/admin"
                    className="text-emerald-600 hover:underline"
                >
                    ← Tillbaka till Admin
                </Link>
            </div>
        </div>
    );
}
