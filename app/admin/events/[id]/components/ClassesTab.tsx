'use client';

import { useState } from 'react';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import { EventData, EventClass, saveEvent } from './shared';

interface ClassesTabProps {
    event: EventData;
    setEvent: (e: EventData) => void;
}

export default function ClassesTab({ event, setEvent }: ClassesTabProps) {
    const [showAddClass, setShowAddClass] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [editingClass, setEditingClass] = useState<EventClass | null>(null);

    const handleUpdateClass = () => {
        if (!editingClass || !newClassName.trim()) return;
        const updated = { ...event, classes: event.classes.map(c => c.id === editingClass.id ? { ...c, name: newClassName } : c) };
        setEvent(updated);
        saveEvent(updated);
        setEditingClass(null);
        setNewClassName('');
    };

    const handleDeleteClass = (classId: string) => {
        if (!confirm('Är du säker på att du vill ta bort klassen?')) return;
        const updated = { ...event, classes: event.classes.filter(c => c.id !== classId) };
        setEvent(updated);
        saveEvent(updated);
    };

    const handleAddClass = () => {
        if (!newClassName.trim()) return;
        const newClass: EventClass = { id: `class-${Date.now()}`, name: newClassName, entryCount: 0 };
        const updated = { ...event, classes: [...event.classes, newClass] };
        setEvent(updated);
        saveEvent(updated);
        setNewClassName('');
        setShowAddClass(false);
    };

    const addStandardClasses = () => {
        const standardClasses = [
            'D10', 'H10', 'D12', 'H12', 'D14', 'H14', 'D16', 'H16', 'D18', 'H18',
            'D20', 'H20', 'D21', 'H21', 'D35', 'H35', 'D40', 'H40', 'D45', 'H45',
            'D50', 'H50', 'D55', 'H55', 'D60', 'H60', 'D65', 'H65', 'D70', 'H70',
            'Öppen 1', 'Öppen 2', 'Öppen 3',
        ].map((name, i) => ({ id: `class-std-${i}`, name, entryCount: 0 }));
        const updated = { ...event, classes: [...event.classes, ...standardClasses] };
        setEvent(updated);
        saveEvent(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Klasser & Banor<HelpButton topic="classes" size="sm" /></h2>
                <div className="flex gap-2">
                    <button onClick={addStandardClasses} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700">+ Standardklasser</button>
                    <button onClick={() => setShowAddClass(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500">+ Ny Klass</button>
                </div>
            </div>

            {event.classes.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4 opacity-30">📋</div>
                    <h3 className="text-lg font-bold text-white mb-2">Inga klasser ännu</h3>
                    <p className="text-slate-500 mb-6 text-sm">Lägg till klasser för att kunna ta emot anmälningar</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={addStandardClasses} className="px-6 py-3 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Lägg till standardklasser</button>
                        <button onClick={() => setShowAddClass(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Skapa egen klass</button>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Klass</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bana</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anmälda</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Åtgärder</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {event.classes.map((cls) => (
                                <tr key={cls.id} className="hover:bg-slate-800/50">
                                    <td className="px-6 py-4 font-bold text-white">{cls.name}</td>
                                    <td className="px-6 py-4">
                                        {cls.courseVariants && cls.courseVariants.length > 1 ? (
                                            <div><span className="text-purple-400 font-bold">Banpool:</span> <span className="text-slate-400">{cls.courseVariants.length} varianter</span></div>
                                        ) : cls.courseName ? (
                                            <span className="text-slate-300">{cls.courseName}</span>
                                        ) : (
                                            <span className="text-amber-400">Ej kopplad</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">{cls.entryCount}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => { setEditingClass(cls); setNewClassName(cls.name); }} className="text-emerald-400 hover:underline text-xs font-bold uppercase tracking-widest">Redigera</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-slate-800 bg-slate-800/50">
                        <Link href={`/admin/events/${event.id}/courses`} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                            🗺️ Hantera banor
                        </Link>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddClass && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Lägg till klass</h2>
                        <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="T.ex. D21, H16, Öppen" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 mb-4" autoFocus />
                        <div className="flex gap-3">
                            <button onClick={() => setShowAddClass(false)} className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Avbryt</button>
                            <button onClick={handleAddClass} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Lägg till</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingClass && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Redigera: {editingClass.name}</h2>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Klassnamn</label>
                        <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white mb-4" autoFocus />
                        {editingClass.courseVariants && editingClass.courseVariants.length > 1 && (
                            <div className="mb-4 p-3 bg-purple-900/20 border border-purple-800/50 rounded-lg">
                                <p className="text-xs font-bold text-purple-400">Banpool ({editingClass.courseVariants.length} varianter):</p>
                                <p className="text-xs text-purple-300 mt-1">{editingClass.courseVariants.join(', ')}</p>
                            </div>
                        )}
                        <div className="flex gap-3 mb-3">
                            <button onClick={() => { setEditingClass(null); setNewClassName(''); }} className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Avbryt</button>
                            <button onClick={handleUpdateClass} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest">Spara</button>
                        </div>
                        <button onClick={() => { handleDeleteClass(editingClass.id); setEditingClass(null); }} className="w-full px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg text-xs font-bold uppercase tracking-widest">Ta bort klass</button>
                    </div>
                </div>
            )}
        </div>
    );
}
