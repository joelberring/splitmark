'use client';

import Link from 'next/link';
import BottomNavigation from '@/components/BottomNavigation';

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white pb-24">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-6">
                <h1 className="text-xl font-bold uppercase tracking-tight">Mer</h1>
                <p className="text-slate-500 text-sm">Inställningar och administration</p>
            </header>

            <main className="p-4 space-y-4">
                {/* Admin Section */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Administration</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        <Link href="/admin" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⚙️</span>
                                <div>
                                    <div className="font-bold text-white">Tävlingsadmin</div>
                                    <div className="text-xs text-slate-500">Skapa och hantera tävlingar</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                        <Link href="/super-admin" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">👑</span>
                                <div>
                                    <div className="font-bold text-white">Super Admin</div>
                                    <div className="text-xs text-slate-500">Plattformsadministration</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                    </div>
                </div>

                {/* Test Data Section */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Testdata</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        <Link href="/test-event" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🏃</span>
                                <div>
                                    <div className="font-bold text-white">Testtävling Älvsjö</div>
                                    <div className="text-xs text-slate-500">Resultat, sträcktider och karta</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                    </div>
                </div>

                {/* Links Section */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Genvägar</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        <Link href="/spectate" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📡</span>
                                <div>
                                    <div className="font-bold text-white">Livebevakning</div>
                                    <div className="text-xs text-slate-500">Följ pågående tävlingar</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                        <Link href="/training" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📊</span>
                                <div>
                                    <div className="font-bold text-white">Träningslogg</div>
                                    <div className="text-xs text-slate-500">Dina aktiviteter</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                    </div>
                </div>

                {/* Account Section */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Konto</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        <Link href="/login" className="flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🔑</span>
                                <div>
                                    <div className="font-bold text-white">Logga in / Registrera</div>
                                    <div className="text-xs text-slate-500">Hantera ditt konto</div>
                                </div>
                            </div>
                            <span className="text-slate-600">→</span>
                        </Link>
                    </div>
                </div>

                {/* Version info */}
                <div className="text-center py-4">
                    <p className="text-slate-600 text-xs">Splitmark v0.1.0</p>
                    <p className="text-slate-700 text-[10px]">© 2025 Splitmark</p>
                </div>
            </main>

            <BottomNavigation />
        </div>
    );
}
