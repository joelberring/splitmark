'use client';

import Link from 'next/link';

export interface FeedItemData {
    id: string;
    type: 'event' | 'activity' | 'live' | 'result' | 'profile_warning';
    timestamp: Date;
    data: any;
}

export default function FeedItem({ item }: { item: FeedItemData }) {
    switch (item.type) {
        case 'event':
            return (
                <Link href={`/events/${item.data.id}`} className="block group">
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 hover:border-emerald-500/50 transition-all shadow-lg group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-900">
                                        KOMMANDE
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                                        {item.data.date && new Date(item.data.date).toLocaleDateString('sv-SE', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </span>
                                </div>
                                <h3 className="font-bold text-xl text-white group-hover:text-emerald-400 transition-colors mb-1">
                                    {item.data.name}
                                </h3>
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    {item.data.location}
                                </div>
                            </div>
                            <div className="text-slate-600 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                        </div>
                    </div>
                </Link>
            );

        case 'live':
            return (
                <Link href={`/live/${item.data.id}`} className="block group">
                    <div className="relative overflow-hidden bg-slate-900 p-6 rounded-lg border border-red-900/40 hover:border-red-500/50 transition-all shadow-lg">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <span className="text-6xl">🔴</span>
                        </div>
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-red-500">LIVE NU</span>
                                </div>
                                <h3 className="font-bold text-2xl text-white group-hover:text-red-400 transition-colors uppercase italic tracking-wide">{item.data.name}</h3>
                                <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                                    <span>{item.data.location}</span>
                                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                    <span className="text-slate-300 font-semibold">{item.data.runners} löpare</span>
                                </p>
                            </div>
                            <div className="text-red-500/80 group-hover:scale-110 transition-transform bg-red-950/30 p-2 rounded-full border border-red-900/50">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            </div>
                        </div>
                    </div>
                </Link>
            );

        case 'result':
            return (
                <Link href={`/events/${item.data.id}`} className="block group">
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 hover:border-blue-500/50 transition-all shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400 bg-blue-950/30 px-2 py-1 rounded border border-blue-900/50">
                                RESULTAT
                            </span>
                        </div>
                        <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                            {item.data.name}
                        </h3>
                        <div className="text-sm text-slate-400 mt-2 flex items-center gap-3">
                            <span>{item.data.date && new Date(item.data.date).toLocaleDateString('sv-SE')}</span>
                            {item.data.entries?.length > 0 && (
                                <>
                                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                    <span>{item.data.entries.length} deltagare</span>
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            );

        case 'activity':
            return (
                <div className="bg-slate-900 p-5 rounded-lg border border-slate-800/50 shadow-sm flex items-start gap-4">
                    <div className="w-10 h-10 rounded bg-emerald-900/30 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20 text-sm">
                        {item.data.user.charAt(0)}
                    </div>
                    <div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            <span className="font-bold text-white">{item.data.user}</span>
                            {' '}{item.data.action}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {item.data.event}
                            </p>
                            {item.data.time && (
                                <>
                                    <span className="text-[10px] text-slate-700">•</span>
                                    <span className="text-[10px] font-mono text-emerald-400/80">{item.data.time}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );

        default:
            return null;
    }
}
