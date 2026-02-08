'use client';

import { useState } from 'react';
import { parseIOFResultList, parseIOFCourseData } from '@/lib/import/iofXmlImport';
import { saveEvent, type FirestoreEvent } from '@/lib/firestore/events';
import Link from 'next/link';

export default function MigratePage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [log, setLog] = useState<string[]>([]);
    const [eventId, setEventId] = useState<string>('');

    const addLog = (msg: string) => setLog(prev => [...prev, msg]);

    const runMigration = async () => {
        setStatus('loading');
        setLog([]);
        addLog('Starting migration...');

        try {
            // 1. Fetch data from API
            addLog('Fetching data from /api/test-event...');
            const res = await fetch('/api/test-event');
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch test event');
            }
            addLog('Data fetched successfully');

            // 2. Parse Data
            let eventData: Partial<FirestoreEvent> = {
                id: 'ans-2025',
                name: data.eventName,
                date: data.eventDate,
                type: 'individual',
                classification: 'club',
                status: 'completed',
                location: 'Älvsjö, Stockholm',
                time: '18:00',
                map: {
                    imageUrl: data.mapImagePath || '/api/test-event/map-image',
                    name: `${data.eventName || 'Test competition'} map`,
                },
            };

            // Parse Results
            if (data.data.resultat) {
                addLog('Parsing results XML...');
                const parsedResults = parseIOFResultList(data.data.resultat);
                eventData.classes = parsedResults.classes as any;
                eventData.entries = parsedResults.entries as any;
                eventData.results = parsedResults.results as any;
                addLog(`Parsed ${eventData.entries?.length} entries and ${eventData.results?.length} results`);
            }

            // Parse Courses
            if (data.data.courseData) {
                addLog('Parsing course data XML...');
                const parsedCourses = parseIOFCourseData(data.data.courseData);
                // Map to Firestore structure if needed, or store as is if interface matches
                // Our FirestoreEvent.courses expects a certain structure, ImportedCourse matches generally
                eventData.courses = parsedCourses.courses.map(c => ({
                    ...c,
                    length: c.length || 0,
                    climb: c.climb || 0,
                    controls: c.controls // ID strings
                })) as any;
                // We might want to store controls separately or embedded. 
                // For simplicity, let's just ignore raw controls list for now or store it if we added a field.
                // The current Firestore schema didn't explicitly add 'controls' list to root, but courses references them.
                // We might need to store the control definitions (lat/lng) somewhere.
                // Let's attach them to the event object if we want map display to work without fetching XML again.
                // Actually, let's create a 'mapData' or similar field? 
                // For now, let's assume we just save what fits directly. 
                // WAIT: The map view needs control positions. 
                // Let's cheat and put controls in 'worldFile' or a new field 'controls'.
                // I'll add 'controls' to the event object dynamically for now.
                (eventData as any).controls = parsedCourses.controls;
                addLog(`Parsed ${parsedCourses.courses.length} courses`);
            }

            // Parse WorldFile
            if (data.data.worldFile) {
                addLog('Parsing WorldFile...');
                eventData.worldFile = data.data.worldFile;
            }

            // 3. Save to Firestore
            addLog('Saving to Firestore...');
            await saveEvent(eventData as FirestoreEvent);
            setEventId(eventData.id!);

            addLog('Saved successfully!');
            setStatus('success');

        } catch (error: any) {
            console.error(error);
            addLog(`Error: ${error.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/admin" className="text-slate-500 hover:text-white mb-4 inline-block">← Tillbaka till Admin</Link>
                <h1 className="text-2xl font-bold mb-6">Migrera Testtävling</h1>

                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <p className="mb-4 text-slate-400">
                        Detta verktyg hämtar data från <code>/api/test-event</code> (lokala filer) och sparar det som ett event i Firestore med ID <code>ans-2025</code>.
                    </p>

                    <button
                        onClick={runMigration}
                        disabled={status === 'loading'}
                        className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-wait font-bold"
                    >
                        {status === 'loading' ? 'Kör migrering...' : 'Starta Migrering'}
                    </button>

                    {/* Logs */}
                    <div className="mt-6 bg-black/50 p-4 rounded font-mono text-xs text-slate-300 h-64 overflow-y-auto border border-slate-800">
                        {log.map((l, i) => (
                            <div key={i} className="mb-1">{l}</div>
                        ))}
                        {log.length === 0 && <span className="opacity-30">Loggar visas här...</span>}
                    </div>

                    {status === 'success' && (
                        <div className="mt-4 p-4 bg-emerald-900/30 border border-emerald-800 rounded text-emerald-400">
                            ✅ Migrering klar! Eventet finns nu i databasen.
                            <div className="mt-2 flex gap-4">
                                <Link href={`/spectate/${eventId}`} className="underline hover:text-white">Gå till Spectate</Link>
                                <Link href={`/admin/events/${eventId}`} className="underline hover:text-white">Gå till Admin</Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
