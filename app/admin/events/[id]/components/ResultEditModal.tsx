import { useState, useEffect } from 'react';
import { EventData, Entry, saveEvent, checkMP, calculateResultTime } from './shared';

interface Props {
    event: EventData;
    entryId: string;
    onClose: () => void;
    onSave: (updatedEvent: EventData) => void;
}

export default function ResultEditModal({ event, entryId, onClose, onSave }: Props) {
    const entry = event.entries.find(e => e.id === entryId);
    if (!entry) return null;

    const [formData, setFormData] = useState<Entry>({ ...entry });
    const [punches, setPunches] = useState<{ code: string; time: string }[]>(entry.punches || []);
    const [originalClassId] = useState(entry.classId);

    const handleSave = () => {
        // 1. Determine status
        let finalStatus = formData.status;

        // If status is 'finished' or 'mp', re-evaluate based on punches if class changed or punches changed
        if (formData.status === 'finished' || formData.status === 'mp') {
            const course = event.classes.find(c => c.id === formData.classId);
            const courseControls = event.courses?.find(c => c.id === course?.courseId)?.controlIds || [];

            const isMP = checkMP(courseControls, punches);
            finalStatus = isMP ? 'mp' : 'finished';
        }

        // 2. Updated Entry
        const updatedEntry: Entry = {
            ...formData,
            status: finalStatus,
            punches: punches,
            // Recalculate result time if we have start and finish
            resultTime: (formData.startTime && formData.finishTime)
                ? calculateResultTime(formData.startTime, formData.finishTime)
                : formData.resultTime
        };

        // 3. Update Event
        const updatedEntries = event.entries.map(e => e.id === entryId ? updatedEntry : e);
        const updatedEvent = { ...event, entries: updatedEntries };

        onSave(updatedEvent);
        saveEvent(updatedEvent);
        onClose();
    };

    const addPunch = () => {
        setPunches([...punches, { code: '', time: '' }]);
    };

    const removePunch = (index: number) => {
        setPunches(punches.filter((_, i) => i !== index));
    };

    const updatePunch = (index: number, field: 'code' | 'time', value: string) => {
        const newPunches = [...punches];
        newPunches[index] = { ...newPunches[index], [field]: value };
        setPunches(newPunches);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Röd Utgång: Redigera Resultat</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Surgical Adjustments for {entry.name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Basic Info */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Grunduppgifter</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Namn</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Klubb</label>
                                <input
                                    type="text"
                                    value={formData.club}
                                    onChange={e => setFormData({ ...formData, club: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Bricknummer</label>
                                <input
                                    type="text"
                                    value={formData.siCard || ''}
                                    onChange={e => setFormData({ ...formData, siCard: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Klass</label>
                                <select
                                    value={formData.classId}
                                    onChange={e => {
                                        const cls = event.classes.find(c => c.id === e.target.value);
                                        setFormData({ ...formData, classId: e.target.value, className: cls?.name });
                                    }}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                >
                                    {event.classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Times & Status */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Tider & Status</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Start</label>
                                <input
                                    type="text"
                                    value={formData.startTime || ''}
                                    placeholder="HH:MM:SS"
                                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Mål</label>
                                <input
                                    type="text"
                                    value={formData.finishTime || ''}
                                    placeholder="HH:MM:SS"
                                    onChange={e => setFormData({ ...formData, finishTime: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="finished">Godkänd (OK)</option>
                                    <option value="mp">Felstämplat (MP)</option>
                                    <option value="dnf">Brutit (DNF)</option>
                                    <option value="dns">Ej start (DNS)</option>
                                    <option value="registered">Anmäld</option>
                                    <option value="started">Startat</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Punch Editor */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Stämpellista</h3>
                            <button
                                onClick={addPunch}
                                className="text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400"
                            >
                                + Lägg till stämpel
                            </button>
                        </div>

                        <div className="bg-slate-950/50 rounded-xl border border-slate-800/50 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2">#</th>
                                        <th className="px-4 py-2">Kod</th>
                                        <th className="px-4 py-2">Tid</th>
                                        <th className="px-4 py-2 text-right">Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/30">
                                    {punches.map((p, idx) => (
                                        <tr key={idx} className="group">
                                            <td className="px-4 py-2 text-xs font-mono text-slate-600">{idx + 1}</td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={p.code}
                                                    onChange={e => updatePunch(idx, 'code', e.target.value)}
                                                    className="w-16 bg-transparent border-none focus:ring-1 focus:ring-emerald-500 rounded px-1 transition-all outline-none text-white font-bold"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={p.time}
                                                    onChange={e => updatePunch(idx, 'time', e.target.value)}
                                                    className="w-24 bg-transparent border-none focus:ring-1 focus:ring-emerald-500 rounded px-1 transition-all outline-none text-slate-400 font-mono text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    onClick={() => removePunch(idx)}
                                                    className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    Ta bort
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {punches.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic text-xs">
                                                Inga stämplar registrerade
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 flex gap-4 bg-slate-900/50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-shadow shadow-lg shadow-emerald-900/20"
                    >
                        Spara Justeringar
                    </button>
                </div>
            </div>
        </div>
    );
}
