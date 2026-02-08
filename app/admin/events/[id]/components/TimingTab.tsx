import { useState, useEffect } from 'react';
import HelpButton from '@/components/HelpButton';
import { EventData, Entry, calculateResultTime } from './shared';
import { saveEntry } from '@/lib/firestore/entries';
import ResultEditModal from './ResultEditModal';

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

export default function TimingTab({ event, setEvent }: { event: EventData; setEvent: (e: EventData) => void }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [manualTime, setManualTime] = useState('');
    type UIStatus = Entry['status'] | 'mp';
    const [selectedStatus, setSelectedStatus] = useState<UIStatus>('finished');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

    // Filter entries based on search
    const searchResults = searchQuery.length > 0
        ? event.entries.filter(e =>
            entryDisplayName(e).toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.siCard?.includes(searchQuery)
        ).slice(0, 5)
        : [];

    const handleRecordFinish = async (entryId: string, time?: string) => {
        const entry = event.entries.find(e => e.id === entryId);
        if (!entry) return;

        const now = new Date();
        const finishTime = time || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const resultTime = entry.startTime ? calculateResultTime(entry.startTime, finishTime) : undefined;

        let status: any = 'finished';
        let resultStatus: any = 'ok';

        if (selectedStatus === 'mp') resultStatus = 'mp';
        else if (selectedStatus === 'dnf') { status = 'dnf'; resultStatus = 'dnf'; }
        else if (selectedStatus === 'dns') { status = 'dns'; resultStatus = 'dns'; }

        const updatedEntry = {
            ...entry,
            finishTime,
            resultTime,
            status,
            resultStatus,
            updatedAt: new Date().toISOString()
        };

        try {
            await saveEntry(event.id, updatedEntry as any);
            // Reset search and selection
            setSearchQuery('');
            setSelectedEntryId(null);
            setManualTime('');
        } catch (err) {
            console.error('Failed to record finish:', err);
            alert('Misslyckades att registrera målgång.');
        }
    };

    const recentFinishes = [...event.entries]
        .filter(e => e.finishTime)
        .sort((a, b) => (b.finishTime || '').localeCompare(a.finishTime || ''))
        .slice(0, 15);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    Målgång & Tidtagning
                    <HelpButton topic="timing" size="sm" />
                </h2>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Manual Punch Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50">Registrera målgång</h3>

                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Sök deltagare (Namn eller Bricka)</label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setSelectedEntryId(null);
                                    }}
                                    placeholder="Skriv för att söka..."
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-all"
                                />

                                {searchResults.length > 0 && !selectedEntryId && (
                                    <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        {searchResults.map(entry => (
                                            <button
                                                key={entry.id}
                                                onClick={() => {
                                                    setSelectedEntryId(entry.id);
                                                    setSearchQuery(entryDisplayName(entry));
                                                }}
                                                className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                                            >
                                                <div className="font-bold text-white">{entryDisplayName(entry)}</div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{entry.className} · {entryDisplayClub(entry)}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Status</label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value as any)}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                                    >
                                        <option value="finished">Godkänd (OK)</option>
                                        <option value="mp">Felstämplat (MP)</option>
                                        <option value="dnf">Brutit (DNF)</option>
                                        <option value="dns">Ej start (DNS)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Manuell tid (valfritt)</label>
                                    <input
                                        type="text"
                                        placeholder="HH:MM:SS"
                                        value={manualTime}
                                        onChange={(e) => setManualTime(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                disabled={!selectedEntryId}
                                onClick={() => selectedEntryId && handleRecordFinish(selectedEntryId, manualTime)}
                                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                            >
                                ⏱️ Registrera Målgång
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm overflow-hidden">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50 flex items-center justify-between">
                            Senaste målgångar (Klicka för att redigera)
                            <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                Live
                            </span>
                        </h3>

                        <div className="space-y-2">
                            {recentFinishes.length === 0 ? (
                                <p className="text-center py-12 text-slate-500 italic text-sm border-2 border-dashed border-slate-800 rounded-xl">Inga målgångar registrerade ännu</p>
                            ) : (
                                recentFinishes.map(entry => (
                                    <button
                                        key={entry.id}
                                        onClick={() => setEditingEntryId(entry.id)}
                                        className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800 rounded-lg transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-8 rounded-full ${(entry.resultStatus === 'ok' || entry.status === 'finished') ? 'bg-emerald-500' :
                                                entry.resultStatus === 'mp' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                                    'bg-amber-500'
                                                }`}></div>
                                            <div>
                                                <div className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">{entryDisplayName(entry)}</div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{entry.className} · {entryDisplayClub(entry)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-white font-bold">{entry.finishTime}</div>
                                            <div className={`text-[10px] font-black uppercase tracking-widest ${(entry.resultStatus === 'ok' || entry.status === 'finished') ? 'text-emerald-500' : 'text-red-400'
                                                }`}>
                                                {(entry.resultStatus === 'ok' || entry.status === 'finished') ? `OK · ${entry.resultTime}` : (entry.resultStatus || entry.status).toUpperCase()}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Info & Status */}
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50">Röd Utgång</h3>
                        <div className="space-y-4">
                            <p className="text-xs text-slate-400 leading-relaxed font-medium italic">
                                Behöver du göra manuella justeringar? Klicka på en löpare i listan till vänster för att öppna den avancerade redigeraren.
                            </p>
                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                <ul className="text-[10px] text-slate-500 space-y-2 uppercase tracking-wider font-bold">
                                    <li className="flex items-center gap-2">✅ Justera namn/klubb</li>
                                    <li className="flex items-center gap-2">✅ Koppla om klasser</li>
                                    <li className="flex items-center gap-2">✅ Editera stämplar</li>
                                    <li className="flex items-center gap-2">✅ Manuellt godkännande</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Backup-tips</h4>
                        <p className="text-xs text-blue-300/60 leading-relaxed">
                            Använd manuell tidtagning som backup även om du kör med SI. Ett bra system gör tävlingen säkrare för alla.
                        </p>
                    </div>
                </div>
            </div>

            {editingEntryId && (
                <ResultEditModal
                    event={event}
                    entryId={editingEntryId}
                    onClose={() => setEditingEntryId(null)}
                    onSave={(updatedEvent: EventData) => {
                        setEvent(updatedEvent);
                        setEditingEntryId(null);
                    }}
                />
            )}
        </div>
    );
}
