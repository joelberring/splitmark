'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import {
    OverviewTab,
    ClassesTab,
    EntriesTab,
    LottningTab,
    TimingTab,
    ParticipantsTab,
    MapTab,
    SpeakerTab,
    EventData,
    saveEvent,
} from './components';

type TabId = 'overview' | 'classes' | 'entries' | 'lottning' | 'timing' | 'map' | 'participants' | 'speaker';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Översikt', icon: '📊' },
    { id: 'classes', label: 'Klasser', icon: '🗺️' },
    { id: 'entries', label: 'Anmälningar', icon: '📝' },
    { id: 'lottning', label: 'Lottning', icon: '🎲' },
    { id: 'timing', label: 'Tidtagning', icon: '⏱️' },
    { id: 'map', label: 'Karta', icon: '🎯' },
    { id: 'speaker', label: 'Speaker', icon: '🎙️' },
    { id: 'participants', label: 'Deltagarläge', icon: '📱' },
];

export default function EventManagePage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', date: '', time: '', location: '' });

    useEffect(() => {
        const stored = localStorage.getItem('events');
        if (stored) {
            const events = JSON.parse(stored);
            const found = events.find((e: EventData) => e.id === eventId);
            if (found) {
                setEvent({
                    ...found,
                    classes: found.classes || [],
                    entries: found.entries || [],
                });
                setEditForm({
                    name: found.name || '',
                    date: found.date || '',
                    time: found.time || '',
                    location: found.location || '',
                });
            }
        }
        setLoading(false);
    }, [eventId]);

    const handleToggleStatus = () => {
        if (!event) return;
        const newStatus = event.status === 'active' ? 'draft' : 'active';
        const updatedEvent = { ...event, status: newStatus };
        setEvent(updatedEvent);
        saveEvent(updatedEvent);
    };

    const handleSaveEdit = () => {
        if (!event) return;
        const updatedEvent = {
            ...event,
            name: editForm.name,
            date: editForm.date,
            time: editForm.time,
            location: editForm.location,
        };
        setEvent(updatedEvent);
        saveEvent(updatedEvent);
        setShowEditModal(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="text-6xl mb-4 opacity-30">❌</div>
                    <h2 className="text-xl font-bold text-white mb-4">Tävling hittades inte</h2>
                    <Link href="/admin" className="text-emerald-400 hover:underline">Tillbaka till admin</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-400 mb-2 inline-block font-bold uppercase tracking-widest">
                        ← Tillbaka till admin
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
                                {event.name}
                                <span className={`px-3 py-1 text-[10px] rounded font-bold uppercase tracking-widest border ${event.status === 'active'
                                    ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                    {event.status === 'active' ? '🟢 Publicerad' : '📝 Utkast'}
                                </span>
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {new Date(event.date).toLocaleDateString('sv-SE')} kl {event.time}
                                {event.location && ` · ${event.location}`}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors"
                            >
                                ✏️ Redigera
                            </button>
                            <button
                                onClick={handleToggleStatus}
                                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors ${event.status === 'active'
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                            >
                                {event.status === 'active' ? '⏸️ Avpublicera' : '🚀 Publicera'}
                            </button>
                            <HelpButton topic="timing" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
                    <nav className="flex gap-6">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-4 border-b-2 transition-all text-xs font-bold uppercase tracking-wider whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-emerald-500 text-emerald-400'
                                    : 'border-transparent text-slate-500 hover:text-white'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'overview' && <OverviewTab event={event} />}
                {activeTab === 'classes' && <ClassesTab event={event} setEvent={setEvent} />}
                {activeTab === 'entries' && <EntriesTab event={event} setEvent={setEvent} />}
                {activeTab === 'lottning' && <LottningTab event={event} />}
                {activeTab === 'timing' && <TimingTab event={event} />}
                {activeTab === 'map' && <MapTab event={event} eventId={eventId} setEvent={setEvent} />}
                {activeTab === 'speaker' && <SpeakerTab event={event} />}
                {activeTab === 'participants' && <ParticipantsTab event={event} setEvent={setEvent} />}
            </div>

            {/* Edit Event Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Redigera tävling</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Namn
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        Datum
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        Tid
                                    </label>
                                    <input
                                        type="time"
                                        value={editForm.time}
                                        onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Plats
                                </label>
                                <input
                                    type="text"
                                    value={editForm.location}
                                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    placeholder="Arena, kommun"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500"
                            >
                                Spara
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

