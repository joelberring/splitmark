import HelpButton from '@/components/HelpButton';
import { EventData, Entry } from './shared';
import { saveEntry } from '@/lib/firestore/entries';

function entryDisplayName(entry: any): string {
    if (typeof entry?.name === 'string' && entry.name.trim()) return entry.name.trim();
    const firstName = typeof entry?.firstName === 'string' ? entry.firstName.trim() : '';
    const lastName = typeof entry?.lastName === 'string' ? entry.lastName.trim() : '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Okänd löpare';
}

function entryDisplayClub(entry: any): string {
    if (typeof entry?.club === 'string' && entry.club.trim()) return entry.club.trim();
    if (typeof entry?.clubName === 'string' && entry.clubName.trim()) return entry.clubName.trim();
    return 'Okänd klubb';
}

export default function SafetyTab({ event, setEvent }: { event: EventData; setEvent: (e: EventData) => void }) {
    // Participants who have started but not finished/dnf/mp
    const outInTerrain = event.entries.filter(e =>
        e.status === 'started' || (e.startTime && !e.finishTime && e.status === 'registered')
    );

    const handleStatusUpdate = async (entryId: string, newStatus: Entry['status']) => {
        const updatedEntries = event.entries.map(e =>
            e.id === entryId ? { ...e, status: newStatus } : e
        );
        const updatedEvent = { ...event, entries: updatedEntries };
        setEvent(updatedEvent);

        const updatedEntry = updatedEntries.find((entry) => entry.id === entryId);
        if (!updatedEntry) return;

        try {
            await saveEntry(event.id, {
                ...(updatedEntry as any),
                status: newStatus,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Failed to update safety status:', error);
        }
    };

    const entriesByClass: Record<string, Entry[]> = {};
    outInTerrain.forEach(entry => {
        const className = entry.className || 'Övriga';
        if (!entriesByClass[className]) entriesByClass[className] = [];
        entriesByClass[className].push(entry);
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    Säkerhet: Kvar i skogen
                    <HelpButton topic="safety" size="sm" />
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Kvar ute:</span>
                    <span className={`px-3 py-1 rounded-full font-black text-sm ${outInTerrain.length > 0 ? 'bg-red-900/30 text-red-500 border border-red-800/50' : 'bg-emerald-900/30 text-emerald-500 border border-emerald-800/50'
                        }`}>
                        {outInTerrain.length}
                    </span>
                </div>
            </div>

            {outInTerrain.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4 opacity-30">🌲</div>
                    <h3 className="text-lg font-bold text-white mb-2">Skogen är tom!</h3>
                    <p className="text-slate-500 text-sm">Alla startade deltagare har kommit i mål eller rapporterats in.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {Object.keys(entriesByClass).map(className => (
                        <div key={className} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="font-bold text-white text-xs uppercase tracking-widest">{className}</h3>
                                <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                    {entriesByClass[className].length} kvar
                                </span>
                            </div>
                            <div className="divide-y divide-slate-800">
                                {entriesByClass[className].map(entry => (
                                    <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                        <div>
                                            <div className="font-bold text-white">{entryDisplayName(entry)}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                <span>{entryDisplayClub(entry)}</span>
                                                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                                <span className="font-mono">Start: {entry.startTime || '--:--'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusUpdate(entry.id, 'finished')}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-900/30 hover:text-emerald-400 text-slate-400 rounded border border-slate-700 hover:border-emerald-800/50 text-[10px] font-bold uppercase tracking-widest transition-all"
                                            >
                                                Hemma (OK)
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(entry.id, 'dnf')}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-amber-900/30 hover:text-amber-400 text-slate-400 rounded border border-slate-700 hover:border-amber-800/50 text-[10px] font-bold uppercase tracking-widest transition-all"
                                            >
                                                Avbrutit
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5">
                <h4 className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    🚩 Viktigt
                </h4>
                <p className="text-xs text-amber-300/70 leading-relaxed font-medium">
                    Kontrollera alltid att alla deltagare är hemma innan ni lämnar arenan. Vid behov, kontakta klubbledaren för den saknade deltagaren.
                </p>
            </div>
        </div>
    );
}
