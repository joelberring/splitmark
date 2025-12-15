'use client';

import { useParams } from 'next/navigation';
import SpectatorLiveMap from '@/components/SpectatorLiveMap';
import Link from 'next/link';

export default function LiveRacePage() {
    const params = useParams();
    const raceId = params.raceId as string;

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-lg font-bold tracking-tight text-emerald-500 hover:text-emerald-400 uppercase">
                        Splitmark
                    </Link>
                    <span className="text-slate-700">|</span>
                    <h1 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                        Live: Race {raceId}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1 rounded border border-red-800/50">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Live</span>
                    </div>
                </div>
            </header>

            {/* Main Content - Full Map */}
            <main className="flex-1 relative">
                <div className="absolute inset-0">
                    <SpectatorLiveMap raceId={raceId} />
                </div>
            </main>
        </div>
    );
}
