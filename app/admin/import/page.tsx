'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { eventorImporter } from '@/lib/importers/eventor-importer';
import { trailImporter } from '@/lib/importers/trail-importer';
import { ExternalEvent } from '@/lib/importers/base';
import { enrichEventContent } from '@/lib/ai/ai-formatter';
import { createEvent } from '@/lib/firestore/events';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
    const [source, setSource] = useState<'eventor' | 'trail'>('eventor');
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState<ExternalEvent[]>([]);
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});
    const [importing, setImporting] = useState<Record<string, boolean>>({});
    const router = useRouter();

    const handleFetch = async () => {
        setLoading(true);
        try {
            let fetched: ExternalEvent[] = [];
            if (source === 'eventor') {
                fetched = await eventorImporter.fetchEvents({ fromDate, toDate });
            } else {
                // For trail, we call our new API route
                const res = await fetch('/api/scrape/trail');
                fetched = await res.json();
            }
            setEvents(fetched);
        } catch (error) {
            console.error('Fetch failed:', error);
            alert('Misslyckades att hämta tävlingar. Kontrollera API-nyckel.');
        } finally {
            setLoading(false);
        }
    };

    const handleEnrich = async (event: ExternalEvent) => {
        setEnriching(prev => ({ ...prev, [event.externalId]: true }));
        try {
            const enriched = await enrichEventContent(event);
            setEvents(prev => prev.map(e =>
                e.externalId === event.externalId
                    ? { ...e, ...enriched }
                    : e
            ));
        } catch (error) {
            console.error('Enrichment failed:', error);
        } finally {
            setEnriching(prev => ({ ...prev, [event.externalId]: false }));
        }
    };

    const handleImport = async (event: ExternalEvent) => {
        setImporting(prev => ({ ...prev, [event.externalId]: true }));
        try {
            await createEvent({
                name: event.name,
                date: event.date,
                time: event.time || '10:00',
                location: event.location,
                organizer: event.organizer,
                classification: event.classification || (source === 'trail' ? 'Trail' : 'Nivå 3'),
                status: 'draft',
                description: event.description || event.infoSummary,
                externalId: event.externalId,
                source: event.source,
                type: source === 'trail' ? 'Trail' : 'Orientering',
            });
            alert(`Importerat: ${event.name}`);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Misslyckades att spara tävling.');
        } finally {
            setImporting(prev => ({ ...prev, [event.externalId]: false }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <PageHeader
                title="Importera Tävlingar"
                subtitle="Hämta data från Eventor eller Trail-kalendrar"
                showLogo
                backHref="/admin"
            />

            <main className="max-w-6xl mx-auto p-6">
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-8">
                    <div className="grid md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Källa</label>
                            <select
                                value={source}
                                onChange={(e) => setSource(e.target.value as any)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all"
                            >
                                <option value="eventor">Eventor (Orientering)</option>
                                <option value="trail">Trail (Loppkartan.se)</option>
                            </select>
                        </div>

                        {source === 'eventor' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Från</label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Till</label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm"
                                    />
                                </div>
                            </>
                        )}

                        <button
                            onClick={handleFetch}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {loading ? 'Hämtar...' : 'Hämta Tävlingar'}
                        </button>
                    </div>
                </div>

                {events.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold uppercase tracking-tight px-2">Hittade Tävlingar ({events.length})</h2>
                        <div className="grid gap-4">
                            {events.map((event) => (
                                <div key={event.externalId} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all group">
                                    <div className="p-6 flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{event.name}</h3>
                                                <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-400 uppercase">{event.source}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                                                <span>📅 {event.date}</span>
                                                <span>📍 {event.location}</span>
                                                {event.distance && <span>📏 {event.distance}</span>}
                                            </div>

                                            {event.infoSummary && (
                                                <div className="bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-4 mb-4">
                                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-1">AI Sammanfattning</div>
                                                    <p className="text-emerald-300 text-sm leading-relaxed">{event.infoSummary}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2 min-w-[180px]">
                                            <button
                                                onClick={() => handleEnrich(event)}
                                                disabled={enriching[event.externalId]}
                                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                            >
                                                {enriching[event.externalId] ? (
                                                    <span className="animate-spin text-sm">✨</span>
                                                ) : '✨ Berika med AI'}
                                            </button>
                                            <button
                                                onClick={() => handleImport(event)}
                                                disabled={importing[event.externalId]}
                                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
                                            >
                                                {importing[event.externalId] ? 'Importerar...' : 'Spara i Splitmark'}
                                            </button>
                                            <a
                                                href={event.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-center text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-wider mt-1"
                                            >
                                                Visa Original ↗
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
