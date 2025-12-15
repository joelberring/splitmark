'use client';

import HelpButton from '@/components/HelpButton';
import { EventData } from './shared';

export default function TimingTab({ event }: { event: EventData }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Tidtagning<HelpButton topic="timing" size="sm" /></h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">💳 SI-Brickavläsning<HelpButton topic="si-cards" size="sm" /></h3>
                    <p className="text-slate-500 text-sm mb-4">Anslut SportIdent-station för att läsa av brickor</p>
                    <button className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-500">Anslut station</button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">⏱️ Manuell tidtagning</h3>
                    <p className="text-slate-500 text-sm mb-4">Registrera tider manuellt för backup</p>
                    <button className="w-full px-4 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-700">Öppna manuell tidtagning</button>
                </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                <h3 className="font-bold text-blue-400 text-xs uppercase tracking-widest mb-2">💡 Tips</h3>
                <p className="text-sm text-blue-300/70">Använd Chrome eller Edge för bäst stöd av Web Serial API. För Android-plattor behövs USB OTG-adapter.</p>
            </div>
        </div>
    );
}
