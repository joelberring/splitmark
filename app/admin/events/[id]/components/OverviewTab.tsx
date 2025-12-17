'use client';

import Link from 'next/link';
import { EventData } from './shared';

export default function OverviewTab({ event }: { event: EventData }) {
    return (
        <div className="grid md:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-emerald-400">{event.classes.length}</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">Klasser</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-blue-400">{event.entries.length}</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">Anmälda</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-purple-400">0</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">I mål</div>
            </div>

            {/* Quick Actions */}
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-4">Snabbåtgärder</h3>
                <div className="grid md:grid-cols-5 gap-3">
                    <Link href={`/admin/events/${event.id}/import`} className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg hover:bg-blue-900/30 transition-colors text-center group">
                        <span className="text-2xl">📥</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-blue-400">Importera Eventor</div>
                    </Link>
                    <button
                        onClick={() => window.location.hash = '#classes'}
                        className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg hover:bg-emerald-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">➕</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-emerald-400">Lägg till klasser</div>
                    </button>
                    <button
                        onClick={() => window.location.hash = '#map'}
                        className="p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg hover:bg-purple-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">🗺️</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-purple-400">Definiera banor</div>
                    </button>
                    <button
                        onClick={() => alert('Utskrift kommer snart!')}
                        className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-center group"
                    >
                        <span className="text-2xl">🖨️</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-slate-300">Skriv ut listor</div>
                    </button>
                    <button
                        onClick={() => alert('Ekonomifunktioner kommer snart!')}
                        className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg hover:bg-amber-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">💰</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-amber-400">Ekonomi</div>
                    </button>
                </div>
            </div>
        </div>
    );
}
