'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import TrainingSignupForm from '@/components/TrainingSignupForm';
import Comments from '@/components/Comments';
import Chat from '@/components/Chat';

interface Training {
    id: string;
    clubId: string;
    title: string;
    description?: string;
    date: string;
    time: string;
    location?: string;
    type: 'running' | 'orienteering' | 'strength' | 'other';
    difficulty: 'easy' | 'medium' | 'hard';
    createdBy: string;
    signups: number;
}

export default function TrainingsPage() {
    const { user } = useUserWithRoles();
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'signups' | 'chat'>('info');
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

    useEffect(() => {
        const stored = localStorage.getItem('trainings');
        if (stored) {
            setTrainings(JSON.parse(stored));
        } else {
            const demoTrainings: Training[] = [
                { id: 'training-1', clubId: 'club-1', title: 'Intervallträning', description: 'Snabb intervallträning i skogen.', date: '2024-12-20', time: '18:00', location: 'Djurgården', type: 'running', difficulty: 'hard', createdBy: 'user-1', signups: 8 },
                { id: 'training-2', clubId: 'club-1', title: 'Teknikpass', description: 'Fokus på kartläsning.', date: '2024-12-22', time: '10:00', location: 'Nacka', type: 'orienteering', difficulty: 'easy', createdBy: 'user-1', signups: 12 },
                { id: 'training-3', clubId: 'club-1', title: 'Styrkepass', description: 'Cirkelträning.', date: '2024-12-18', time: '19:00', location: 'Klubbhuset', type: 'strength', difficulty: 'medium', createdBy: 'user-1', signups: 5 },
            ];
            setTrainings(demoTrainings);
            localStorage.setItem('trainings', JSON.stringify(demoTrainings));
        }
    }, []);

    const getTypeIcon = (type: string) => ({ running: '🏃', orienteering: '🧭', strength: '💪' }[type] || '📍');
    const getDifficultyColor = (d: string) => ({ easy: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50', medium: 'text-amber-400 bg-amber-900/30 border-amber-800/50', hard: 'text-red-400 bg-red-900/30 border-red-800/50' }[d] || 'text-slate-400 bg-slate-800');
    const isUpcoming = (dateStr: string) => new Date(dateStr) >= new Date();
    const filteredTrainings = trainings.filter(t => filter === 'upcoming' ? isUpcoming(t.date) : !isUpcoming(t.date));

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-24">
            <PageHeader title="Träningar" showLogo />

            <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
                {/* Filter */}
                <div className="mb-4 flex gap-2">
                    {['upcoming', 'past'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${filter === f ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {f === 'upcoming' ? 'Kommande' : 'Tidigare'}
                        </button>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* List */}
                    <div className="space-y-3">
                        {filteredTrainings.length === 0 ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                                <div className="text-4xl mb-4 opacity-30">📅</div>
                                <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">{filter === 'upcoming' ? 'Inga kommande träningar' : 'Inga tidigare träningar'}</p>
                            </div>
                        ) : (
                            filteredTrainings.map(training => (
                                <div
                                    key={training.id}
                                    onClick={() => setSelectedTraining(training)}
                                    className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all hover:bg-slate-800 ${selectedTraining?.id === training.id ? 'border-emerald-500' : 'border-slate-800'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-3xl">{getTypeIcon(training.type)}</div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-white">{training.title}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getDifficultyColor(training.difficulty)}`}>
                                                    {training.difficulty === 'easy' ? 'Lätt' : training.difficulty === 'medium' ? 'Medel' : 'Hård'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">📅 {new Date(training.date).toLocaleDateString('sv-SE')} kl {training.time}</p>
                                            {training.location && <p className="text-xs text-slate-500">📍 {training.location}</p>}
                                            <p className="text-xs text-emerald-400 mt-1">👥 {training.signups} anmälda</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Detail */}
                    <div className="lg:sticky lg:top-4 lg:self-start">
                        {selectedTraining ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="border-b border-slate-800 flex">
                                    {['info', 'signups', 'chat'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab as any)}
                                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === tab ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-500'}`}
                                        >
                                            {tab === 'info' ? '📋 Info' : tab === 'signups' ? '✋ Anmälan' : '💬 Chat'}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-4">
                                    {activeTab === 'info' && (
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-bold">{selectedTraining.title}</h2>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-slate-500 text-xs uppercase">Datum</p><p className="font-bold">{new Date(selectedTraining.date).toLocaleDateString('sv-SE')}</p></div>
                                                <div><p className="text-slate-500 text-xs uppercase">Tid</p><p className="font-bold">{selectedTraining.time}</p></div>
                                            </div>
                                            {selectedTraining.location && <div><p className="text-slate-500 text-xs uppercase">Plats</p><p className="font-bold">{selectedTraining.location}</p></div>}
                                            {selectedTraining.description && <div><p className="text-slate-500 text-xs uppercase mb-1">Beskrivning</p><p className="text-slate-300 text-sm">{selectedTraining.description}</p></div>}
                                            <div className="pt-4"><Comments resourceType="training" resourceId={selectedTraining.id} showQA /></div>
                                        </div>
                                    )}
                                    {activeTab === 'signups' && <TrainingSignupForm trainingId={selectedTraining.id} trainingName={selectedTraining.title} trainingDate={`${new Date(selectedTraining.date).toLocaleDateString('sv-SE')} kl ${selectedTraining.time}`} />}
                                    {activeTab === 'chat' && <div className="h-[400px]"><Chat roomId={`training-${selectedTraining.id}`} roomName={selectedTraining.title} roomType="team" /></div>}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                                <div className="text-5xl mb-4 opacity-30">👈</div>
                                <p className="text-slate-500 uppercase tracking-wide text-sm font-bold">Välj en träning</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <BottomNavigation />
        </div>
    );
}
