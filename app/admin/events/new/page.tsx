'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';

export default function NewEventPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '', date: '', time: '10:00', location: '',
        type: 'individual' as 'individual' | 'relay' | 'rogaining',
        classification: 'club' as 'club' | 'district' | 'national',
        description: '', entryDeadline: '', maxParticipants: '',
        siCardRequired: true, visibility: 'public' as 'public' | 'club_only' | 'draft',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.date) { alert('Namn och datum krävs'); return; }
        setSaving(true);
        const newEvent = { id: `event-${Date.now()}`, ...formData, createdAt: new Date().toISOString(), createdBy: 'dev-super-admin', status: 'planned', classes: [], entries: [] };
        const existingEvents = JSON.parse(localStorage.getItem('events') || '[]');
        existingEvents.push(newEvent);
        localStorage.setItem('events', JSON.stringify(existingEvents));
        setTimeout(() => { router.push(`/admin/events/${newEvent.id}`); }, 500);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-400 mb-2 inline-block font-bold uppercase tracking-widest">← Tillbaka</Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold uppercase tracking-tight">Skapa Ny Tävling</h1>
                        <HelpButton topic="create-event" />
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    {/* Basic Info */}
                    <section className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">📋 Grundinformation<HelpButton topic="event-basics" size="sm" /></h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Tävlingsnamn *</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="T.ex. Klubbmästerskap 2024" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Datum *</label>
                                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Första start</label>
                                <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Plats / Arena</label>
                                <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="T.ex. Djurgården, Stockholm" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                            </div>
                        </div>
                    </section>

                    {/* Event Type */}
                    <section className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">🏃 Tävlingstyp<HelpButton topic="event-types" size="sm" /></h2>
                        <div className="grid md:grid-cols-3 gap-3">
                            {[
                                { id: 'individual', label: 'Individuell', icon: '🏃', desc: 'Enskild start' },
                                { id: 'relay', label: 'Stafett', icon: '👥', desc: 'Lagkonkurrens' },
                                { id: 'rogaining', label: 'Rogaining', icon: '🗺️', desc: 'Poängorientering' },
                            ].map((type) => (
                                <button key={type.id} type="button" onClick={() => setFormData({ ...formData, type: type.id as any })}
                                    className={`p-4 rounded-lg border-2 text-left transition-all ${formData.type === type.id ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 hover:border-slate-600'}`}>
                                    <span className="text-2xl">{type.icon}</span>
                                    <div className="font-bold text-white mt-2">{type.label}</div>
                                    <div className="text-xs text-slate-500">{type.desc}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Classification */}
                    <section className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">🏆 Klassificering<HelpButton topic="event-classification" size="sm" /></h2>
                        <div className="flex gap-6">
                            {[
                                { id: 'club', label: 'Klubbtävling' },
                                { id: 'district', label: 'Distriktstävling' },
                                { id: 'national', label: 'Nationell' },
                            ].map((cls) => (
                                <label key={cls.id} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="classification" value={cls.id} checked={formData.classification === cls.id} onChange={() => setFormData({ ...formData, classification: cls.id as any })} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-600" />
                                    <span className="text-slate-300">{cls.label}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Options */}
                    <section className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">⚙️ Inställningar</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Synlighet</label>
                                <select value={formData.visibility} onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white">
                                    <option value="public">Publik - Alla kan se</option>
                                    <option value="club_only">Endast klubb</option>
                                    <option value="draft">Utkast</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="siRequired" checked={formData.siCardRequired} onChange={(e) => setFormData({ ...formData, siCardRequired: e.target.checked })} className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                                <label htmlFor="siRequired" className="text-slate-300">SI-bricka krävs</label>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Sista anmälningsdag</label>
                                    <input type="date" value={formData.entryDeadline} onChange={(e) => setFormData({ ...formData, entryDeadline: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Max antal deltagare</label>
                                    <input type="number" value={formData.maxParticipants} onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })} placeholder="Obegränsat" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Description */}
                    <section className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">📝 Beskrivning</h2>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Beskriv tävlingen..." rows={4} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none" />
                    </section>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4 border-t border-slate-800">
                        <Link href="/admin" className="flex-1 px-6 py-4 bg-slate-800 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-center hover:bg-slate-700 transition-colors">Avbryt</Link>
                        <button type="submit" disabled={saving || !formData.name || !formData.date} className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50">
                            {saving ? 'Sparar...' : '✓ Skapa Tävling'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
