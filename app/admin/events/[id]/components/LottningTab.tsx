import { useState } from 'react';
import HelpButton from '@/components/HelpButton';
import { EventData, saveEvent } from './shared';

export default function LottningTab({ event, setEvent }: { event: EventData; setEvent: (e: EventData) => void }) {
    const [interval, setInterval] = useState(1);
    const [firstStart, setFirstStart] = useState(event.time || '10:00');
    const [drawing, setDrawing] = useState(false);
    const [done, setDone] = useState(false);

    const runLottning = () => {
        setDrawing(true);

        // Clone event
        const updatedEvent = { ...event, entries: [...event.entries] };

        // Group entries by class
        const entriesByClass: Record<string, typeof event.entries> = {};
        updatedEvent.entries.forEach(entry => {
            const className = entry.className || 'Övriga';
            if (!entriesByClass[className]) entriesByClass[className] = [];
            entriesByClass[className].push(entry);
        });

        const [startH, startM] = firstStart.split(':').map(Number);

        // Draw for each class
        Object.keys(entriesByClass).forEach(className => {
            const classEntries = entriesByClass[className];

            // Randomize order
            const shuffled = [...classEntries].sort(() => Math.random() - 0.5);

            // Assign times
            shuffled.forEach((entry, idx) => {
                const totalMinutes = (startH * 60) + startM + (idx * interval);
                const h = Math.floor(totalMinutes / 60) % 24;
                const m = totalMinutes % 60;
                const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                // Update the entry in the main list
                const mainIdx = updatedEvent.entries.findIndex(e => e.id === entry.id);
                if (mainIdx >= 0) {
                    updatedEvent.entries[mainIdx] = { ...updatedEvent.entries[mainIdx], startTime: timeString };
                }
            });
        });

        // Save
        setTimeout(() => {
            setEvent(updatedEvent);
            saveEvent(updatedEvent);
            setDrawing(false);
            setDone(true);
            setTimeout(() => setDone(false), 3000);
        }, 1000);
    };

    const hasEntries = event.entries.length > 0;
    const hasAlreadyDrawn = event.entries.some(e => e.startTime);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    Lottning & Startlista
                    <HelpButton topic="lottning" size="sm" />
                </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50">Inställningar</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Första start</label>
                                <input
                                    type="time"
                                    value={firstStart}
                                    onChange={(e) => setFirstStart(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Startintervall (min)</label>
                                <select
                                    value={interval}
                                    onChange={(e) => setInterval(Number(e.target.value))}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value={1}>1 minut</option>
                                    <option value={2}>2 minuter</option>
                                    <option value={3}>3 minuter</option>
                                    <option value={5}>5 minuter</option>
                                </select>
                            </div>
                        </div>

                        {hasAlreadyDrawn && (
                            <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <p className="text-xs text-amber-400 font-bold">
                                    En startlista finns redan. Om du lottar om kommer nuvarande tider att skrivas över.
                                </p>
                            </div>
                        )}

                        <button
                            disabled={!hasEntries || drawing}
                            onClick={runLottning}
                            className={`w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${done ? 'bg-emerald-500 text-white' :
                                    drawing ? 'bg-slate-700 text-slate-400 cursor-wait' :
                                        'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
                                }`}
                        >
                            {done ? '✓ Lottning klar!' : drawing ? 'Lottar...' : '🎲 Slumpa starttider'}
                        </button>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">MeOS Tips</h4>
                        <p className="text-xs text-blue-300/60 leading-relaxed">
                            För "Mindre arrangemang" kan du använda gemensam start för alla i en bana för att förenkla lottningen.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="font-bold text-white mb-4 uppercase tracking-widest text-xs opacity-50">Status</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Antal deltagare</span>
                                <span className="text-white font-bold">{event.entries.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Klasser</span>
                                <span className="text-white font-bold">{event.classes.length}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-800">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Lottade</span>
                                    <span className={`font-bold ${event.entries.filter(e => e.startTime).length === event.entries.length ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {event.entries.filter(e => e.startTime).length} / {event.entries.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
