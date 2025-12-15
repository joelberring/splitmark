'use client';

import { useState } from 'react';
import { useAuthState } from '@/lib/auth/hooks';
import type { StoredEvent } from '@/types/event';

export default function RegisterModal({
    event,
    onClose,
    onSuccess,
}: {
    event: StoredEvent;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { user } = useAuthState();
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Profile check mock (replace with real profile logic)
    const isProfileComplete = true; // Assume true for demo

    const handleRegister = async () => {
        if (!selectedClassId) {
            setError('Välj en klass för att anmäla dig.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            onSuccess();
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-800">
                {/* Header */}
                <div className="bg-emerald-600 p-6 text-white text-center relative shadow-[0_4px_20px_rgba(16,185,129,0.2)]">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                    <h2 className="text-2xl font-bold mb-1 uppercase tracking-wide">Anmälan</h2>
                    <p className="text-emerald-100 font-medium">{event.name}</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* User Info */}
                    <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-emerald-500 font-bold text-lg border border-slate-700">
                            {user?.displayName?.[0] || 'U'}
                        </div>
                        <div>
                            <p className="font-bold text-white">
                                {user?.displayName || 'Anonym Användare'}
                            </p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {!isProfileComplete && (
                        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg text-sm text-amber-500 font-medium">
                            ⚠️ Din profil saknar SI-nummer eller klubb.
                            <a href="/profile" className="font-bold underline ml-1 hover:text-amber-400">
                                Uppdatera profil
                            </a>
                        </div>
                    )}

                    {/* Class Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Välj klass:
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {event.classes?.map((cls: any) => (
                                <button
                                    key={cls.id}
                                    onClick={() => setSelectedClassId(cls.id)}
                                    className={`p-3 rounded-lg text-left transition-all border ${selectedClassId === cls.id
                                        ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/50'
                                        : 'bg-slate-800 border-slate-700 hover:border-emerald-500/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold text-sm ${selectedClassId === cls.id ? 'text-emerald-400' : 'text-slate-300'}`}>
                                            {cls.name}
                                        </span>
                                        {cls.entryCount > 0 && (
                                            <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-500 font-bold uppercase tracking-wider">
                                                {cls.entryCount} anmälda
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center font-bold bg-red-950/30 py-2 rounded border border-red-900/30">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded bg-slate-800 border border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-xs hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleRegister}
                            disabled={isSubmitting || !selectedClassId}
                            className="flex-1 px-4 py-3 rounded bg-emerald-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/50 transition-all hover:scale-105 active:scale-95"
                        >
                            {isSubmitting ? 'Anmäler...' : 'Bekräfta anmälan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
