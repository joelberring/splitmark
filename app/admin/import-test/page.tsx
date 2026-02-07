'use client';

import { useState, useEffect } from 'react';
import { parseResultListXML, parseCourseDataXML, parsePurplePenXML } from '@/lib/import/iof-xml-parser';
import { importParsedEventToFirestore } from '@/lib/import/firestore-import';
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

            // Import to Firestore with map data
            setMessage('Sparar till Cloud/Firestore...');
            const eventId = await importParsedEventToFirestore(parsedEvent);
            // TODO: Handle mapData specifically in firestore-import if needed
            setImportedEventId(eventId);

            setStatus('success');
            setMessage(`Importerade "${parsedEvent.name}" med ${parsedEvent.results.length} resultat${mapData ? ' och karta!' : '!'}`);

        } catch (error) {
            console.error('Import error:', error);
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Import misslyckades');
        }
    };


    return (
        <div className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-6">
                    Test Import
                </h1>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
                        Testdata (Älvsjö Night Sprint)
                    </h2>
                    <p className="text-slate-400 font-medium mb-8">
                        Klicka på knappen nedan för att ladda in den fördefinierade testtävlingen (XML-filer i /public/test-tävling).
                    </p>
                    <ul className="text-xs font-black uppercase tracking-widest text-slate-500 space-y-2 mb-8">
                        <li>• Inkluderar resultat (IOF XML 3.0)</li>
                        <li>• Inkluderar banor & kontroller</li>
                        <li>• Inkluderar georefererad karta</li>
                    </ul>

                    <div className="flex items-center justify-between">
                        {status === 'idle' && (
                            <button
                                onClick={loadTestData}
                                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-900/40"
                            >
                                Starta Import
                            </button>
                        )}

                        {status === 'loading' && (
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{message}</span>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="flex gap-4">
                                <Link
                                    href={`/admin/events/${importedEventId}`}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-700"
                                >
                                    Admin
                                </Link>
                                <Link
                                    href={`/events/${importedEventId}`}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-900/40"
                                >
                                    Resultat
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {status === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8 flex items-center justify-between">
                        <p className="text-red-400 text-xs font-bold">{message}</p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Försök igen
                        </button>
                    </div>
                )}

                <Link
                    href="/admin"
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
                >
                    ← Tillbaka till Admin
                </Link>
            </div>
        </div>
    );
}
