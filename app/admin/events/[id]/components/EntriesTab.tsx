'use client';

import HelpButton from '@/components/HelpButton';
import { EventData } from './shared';

export default function EntriesTab({ event, setEvent }: { event: EventData; setEvent: (e: EventData) => void }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Anmälningar<HelpButton topic="entries" size="sm" /></h2>
                <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500">+ Lägg till deltagare</button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4 opacity-30">📝</div>
                <h3 className="text-lg font-bold text-white mb-2">Inga anmälningar ännu</h3>
                <p className="text-slate-500 mb-6 text-sm">Importera anmälningar från Eventor eller lägg till manuellt</p>
                <div className="flex gap-3 justify-center">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-500">📥 Importera från Eventor</button>
                    <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500">+ Manuell anmälan</button>
                </div>
            </div>
        </div>
    );
}
