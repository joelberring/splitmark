'use client';

import HelpButton from '@/components/HelpButton';
import { EventData } from './shared';

export default function LottningTab({ event }: { event: EventData }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Lottning<HelpButton topic="lottning" size="sm" /></h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
                <div className="text-center py-8">
                    <div className="text-6xl mb-4 opacity-30">🎲</div>
                    <h3 className="text-lg font-bold text-white mb-2">Lottning ej genomförd</h3>
                    <p className="text-slate-500 mb-6 text-sm">Lägg till klasser och anmälningar innan du kan lotta startlista</p>
                    <button disabled={event.classes.length === 0 || event.entries.length === 0} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-500">
                        Starta lottning
                    </button>
                </div>
            </div>
        </div>
    );
}
