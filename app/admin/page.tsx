'use client';

import { useRequireAuth } from '@/lib/auth/hooks';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import HelpButton from '@/components/HelpButton';

export default function AdminPage() {
    const { user, loading } = useRequireAuth('/login');
    const [activeTab, setActiveTab] = useState<'events' | 'timing' | 'results' | 'settings'>('events');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (user?.role !== 'admin' && user?.role !== 'organizer') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4 opacity-30">🔒</div>
                    <h2 className="text-xl font-bold text-white mb-4">Åtkomst Nekad</h2>
                    <p className="text-slate-400 mb-6">Du behöver vara administratör eller arrangör för att komma åt denna sida.</p>
                    <Link href="/" className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                        Tillbaka
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Link href="/" className="text-xs text-slate-500 hover:text-emerald-400 mb-2 inline-block font-bold uppercase tracking-widest">← Tillbaka</Link>
                            <h1 className="text-2xl font-bold uppercase tracking-tight">Administration</h1>
                            <p className="text-slate-500 text-sm mt-1">Hantera tävlingar, tidtagning och resultat</p>
                        </div>
                        <div className="px-4 py-2 bg-purple-900/30 text-purple-400 rounded-lg font-bold text-xs uppercase tracking-widest border border-purple-800/50">
                            {user.role === 'admin' ? 'Administratör' : 'Arrangör'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex gap-6">
                        <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon="📅" label="Tävlingar" />
                        <TabButton active={activeTab === 'timing'} onClick={() => setActiveTab('timing')} icon="⏱️" label="Tidtagning" />
                        <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon="🏆" label="Resultat" />
                        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="⚙️" label="Inställningar" />
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'events' && <EventsTab />}
                {activeTab === 'timing' && <TimingTab />}
                {activeTab === 'results' && <ResultsTab />}
                {activeTab === 'settings' && <SettingsTab />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-all font-bold text-xs uppercase tracking-wider ${active ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
            <span className="text-lg">{icon}</span>{label}
        </button>
    );
}

function EventsTab() {
    const [events, setEvents] = useState<any[]>([]);
    useEffect(() => {
        const stored = localStorage.getItem('events');
        if (stored) setEvents(JSON.parse(stored));
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-wide flex items-center gap-2">Mina Tävlingar<HelpButton topic="create-event" size="sm" /></h2>
                <Link href="/admin/events/new" className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">+ Ny Tävling</Link>
            </div>

            {events.length === 0 ? (
                <EmptyState icon="📅" title="Inga tävlingar ännu" description="Skapa din första tävling för att komma igång." />
            ) : (
                <div className="grid gap-4">
                    {events.map((event) => (
                        <Link key={event.id} href={`/admin/events/${event.id}`} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-emerald-500/30 transition-all group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{event.name}</h3>
                                    <p className="text-slate-500 text-sm">{new Date(event.date).toLocaleDateString('sv-SE')} kl {event.time}{event.location && ` · ${event.location}`}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-slate-600"><span>{event.classes?.length || 0} klasser</span><span>{event.entries?.length || 0} anmälda</span></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${event.status === 'active' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                        {event.status === 'active' ? 'Pågår' : 'Planerad'}
                                    </span>
                                    <span className="text-slate-600 group-hover:text-emerald-400 transition-colors">→</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function TimingTab() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-wide">SportIdent Tidtagning</h2>
            <div className="grid md:grid-cols-2 gap-6">
                <FeatureCard icon="💳" title="Avläs SI-Brickor" description="Anslut SportIdent-station via USB" action="Starta Avläsning" href="/admin/timing/read" />
                <FeatureCard icon="📡" title="Live Resultat" description="Realtidsresultat från stationer" action="Aktivera Live" href="/admin/timing/live" />
            </div>
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6">
                <h3 className="font-bold text-blue-400 mb-2 text-xs uppercase tracking-wider">💡 Hårdvarukrav</h3>
                <ul className="text-sm text-blue-300/70 space-y-1">
                    <li>• SportIdent BSM7/BSM8 station</li>
                    <li>• USB-kabel eller Bluetooth-dongel</li>
                    <li>• Chrome/Edge webbläsare</li>
                </ul>
            </div>
        </div>
    );
}

function ResultsTab() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold uppercase tracking-wide">Resultathantering</h2>
            <div className="grid md:grid-cols-2 gap-6">
                <FeatureCard icon="📤" title="Ladda upp till Eventor" description="Exportera resultat till SOF" action="Ladda upp" href="/admin/results/upload" />
                <FeatureCard icon="🖨️" title="Skriv ut Sträcktider" description="Generera och skriv ut" action="Skriv ut" href="/admin/results/print" />
            </div>
        </div>
    );
}

function SettingsTab() {
    const [eventorConfig, setEventorConfig] = useState({ clubName: '', organizationId: '', apiKey: '' });
    const [gokartorConfig, setGokartorConfig] = useState({ username: '', password: '', layer: 'laserkarta' as const });
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        localStorage.setItem('eventor-config', JSON.stringify(eventorConfig));
        localStorage.setItem('gokartor-config', JSON.stringify(gokartorConfig));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold uppercase tracking-wide">Klubbinställningar</h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6"><span className="text-3xl">🏃</span><h3 className="font-bold uppercase tracking-wide">Eventor API</h3></div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Klubbnamn</label>
                        <input type="text" value={eventorConfig.clubName} onChange={(e) => setEventorConfig({ ...eventorConfig, clubName: e.target.value })} placeholder="T.ex. OK Linné" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Organisations-ID</label>
                        <input type="text" value={eventorConfig.organizationId} onChange={(e) => setEventorConfig({ ...eventorConfig, organizationId: e.target.value })} placeholder="Klubb-ID" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">API-nyckel</label>
                        <input type="password" value={eventorConfig.apiKey} onChange={(e) => setEventorConfig({ ...eventorConfig, apiKey: e.target.value })} placeholder="Din API-nyckel" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6"><span className="text-3xl">🗺️</span><h3 className="font-bold uppercase tracking-wide">GoKartor</h3></div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Användarnamn</label>
                        <input type="text" value={gokartorConfig.username} onChange={(e) => setGokartorConfig({ ...gokartorConfig, username: e.target.value })} placeholder="E-post" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Lösenord</label>
                        <input type="password" value={gokartorConfig.password} onChange={(e) => setGokartorConfig({ ...gokartorConfig, password: e.target.value })} placeholder="Lösenord" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Standardlager</label>
                        <select value={gokartorConfig.layer} onChange={(e) => setGokartorConfig({ ...gokartorConfig, layer: e.target.value as any })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white">
                            <option value="laserkarta">🌲 Laserkartan</option>
                            <option value="terrangkarta">🏔️ Terrängkartan</option>
                        </select>
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors">
                {saved ? '✓ Sparade!' : 'Spara Inställningar'}
            </button>
        </div>
    );
}

function FeatureCard({ icon, title, description, action, href }: { icon: string; title: string; description: string; action: string; href: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-emerald-500/30 transition-all">
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-500 mb-4">{description}</p>
            <Link href={href} className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 transition-colors">{action}</Link>
        </div>
    );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4 opacity-30">{icon}</div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-500">{description}</p>
        </div>
    );
}
