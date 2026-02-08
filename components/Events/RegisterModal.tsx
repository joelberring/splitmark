'use client';

import { useMemo, useState } from 'react';
import { useAuthState } from '@/lib/auth/hooks';
import { registerEntry, registerEntriesBatch } from '@/lib/firestore/entries';
import { getEventAccessProfile } from '@/lib/events/competition';
import type { StoredEvent } from '@/types/event';

type RegisterMode = 'individual' | 'club';

interface ClubRunnerDraft {
    id: string;
    firstName: string;
    lastName: string;
    classId: string;
    siCard: string;
}

function createRunnerDraft(defaultClassId = ''): ClubRunnerDraft {
    return {
        id: `runner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: '',
        lastName: '',
        classId: defaultClassId,
        siCard: '',
    };
}

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
    const [mode, setMode] = useState<RegisterMode>('individual');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [teamName, setTeamName] = useState<string>('');
    const [clubRunners, setClubRunners] = useState<ClubRunnerDraft[]>([createRunnerDraft('')]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const access = getEventAccessProfile(event, user);
    const selectedClass = event.classes?.find((cls: any) => cls.id === selectedClassId);

    const profile = useMemo(() => {
        if (typeof window === 'undefined') return {} as any;
        try {
            return JSON.parse(localStorage.getItem('userProfile') || '{}');
        } catch {
            return {};
        }
    }, []);

    const clubName = profile.club || profile.clubName || user?.clubId || 'Okänd klubb';
    const displayName = user?.displayName?.trim() || '';
    const [firstName, ...lastNameParts] = displayName.split(' ');
    const normalizedFirstName = firstName || 'Användare';
    const normalizedLastName = lastNameParts.join(' ') || '-';
    const isProfileComplete = !!clubName && clubName !== 'Okänd klubb';

    const addClubRunner = () => {
        setClubRunners((prev) => [...prev, createRunnerDraft(selectedClassId)]);
    };

    const removeClubRunner = (id: string) => {
        setClubRunners((prev) => prev.length <= 1 ? prev : prev.filter((runner) => runner.id !== id));
    };

    const updateClubRunner = (id: string, patch: Partial<ClubRunnerDraft>) => {
        setClubRunners((prev) => prev.map((runner) => runner.id === id ? { ...runner, ...patch } : runner));
    };

    const handleRegister = async () => {
        if (!user) {
            setError('Du behöver logga in för att anmäla dig.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            if (mode === 'individual') {
                if (!selectedClassId || !selectedClass) {
                    setError('Välj en klass för att anmäla dig.');
                    setIsSubmitting(false);
                    return;
                }

                await registerEntry(event.id, {
                    userId: user.uid,
                    firstName: normalizedFirstName,
                    lastName: normalizedLastName,
                    classId: selectedClass.id,
                    className: selectedClass.name,
                    clubName,
                    siCard: profile.siCard,
                    email: user.email || undefined,
                    phone: profile.phone || undefined,
                    registeredByUserId: user.uid,
                    isClubEntry: false,
                });
            } else {
                const cleaned = clubRunners
                    .map((runner) => ({
                        ...runner,
                        firstName: runner.firstName.trim(),
                        lastName: runner.lastName.trim(),
                        classId: runner.classId.trim(),
                        siCard: runner.siCard.trim(),
                    }))
                    .filter((runner) => runner.firstName && runner.lastName && runner.classId);

                if (cleaned.length === 0) {
                    setError('Lägg till minst en komplett deltagare för klubbanmälan.');
                    setIsSubmitting(false);
                    return;
                }

                const classById = new Map((event.classes || []).map((cls: any) => [cls.id, cls.name]));
                const registrationGroupId = `club-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

                const result = await registerEntriesBatch(event.id, cleaned
                    .filter((runner) => classById.has(runner.classId))
                    .map((runner) => ({
                        firstName: runner.firstName,
                        lastName: runner.lastName,
                        classId: runner.classId,
                        className: classById.get(runner.classId) || runner.classId,
                        clubName,
                        siCard: runner.siCard || undefined,
                        teamName: teamName.trim() || undefined,
                        registrationGroupId,
                        registeredByUserId: user.uid,
                        isClubEntry: true,
                    })));

                if (result.created.length === 0 && result.duplicates.length > 0) {
                    setError('Alla deltagare i listan är redan anmälda.');
                    setIsSubmitting(false);
                    return;
                }

                if (result.skipped > 0) {
                    setError(`${result.created.length} anmälningar sparades, ${result.skipped} rader saknade klass eller namn.`);
                }
            }

            setIsSubmitting(false);
            onSuccess();
        } catch (registrationError: any) {
            setIsSubmitting(false);
            setError(registrationError?.message || 'Kunde inte genomföra anmälan.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-800">
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

                <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                    <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setMode('individual')}
                            className={`flex-1 px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-colors ${mode === 'individual' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Individuell
                        </button>
                        <button
                            onClick={() => setMode('club')}
                            className={`flex-1 px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-colors ${mode === 'club' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            Klubbanmälan
                        </button>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-emerald-500 font-bold text-lg border border-slate-700">
                            {user?.displayName?.[0] || 'U'}
                        </div>
                        <div>
                            <p className="font-bold text-white">
                                {user?.displayName || 'Anonym Användare'}
                            </p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                                {user?.email || 'Logga in för att anmäla dig'}
                            </p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">
                                Klubb: {clubName}
                            </p>
                        </div>
                    </div>

                    {!user && (
                        <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg text-sm text-blue-300 font-medium">
                            För att anmäla dig behöver du vara inloggad.
                            <a href="/login" className="font-bold underline ml-1 hover:text-blue-200">
                                Logga in
                            </a>
                        </div>
                    )}

                    {!isProfileComplete && (
                        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg text-sm text-amber-500 font-medium">
                            Din profil saknar klubb eller SI-nummer.
                            <a href="/profile" className="font-bold underline ml-1 hover:text-amber-400">
                                Uppdatera profil
                            </a>
                        </div>
                    )}

                    {mode === 'individual' ? (
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
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                                    Lag-/gruppnamn (valfritt)
                                </label>
                                <input
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="Ex. IFK Göteborg Lag 1"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        Deltagare
                                    </label>
                                    <button
                                        onClick={addClubRunner}
                                        type="button"
                                        className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700"
                                    >
                                        + Lägg till
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {clubRunners.map((runner, index) => (
                                        <div key={runner.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid grid-cols-12 gap-2 items-center">
                                            <input
                                                value={runner.firstName}
                                                onChange={(e) => updateClubRunner(runner.id, { firstName: e.target.value })}
                                                placeholder="Förnamn"
                                                className="col-span-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 text-sm"
                                            />
                                            <input
                                                value={runner.lastName}
                                                onChange={(e) => updateClubRunner(runner.id, { lastName: e.target.value })}
                                                placeholder="Efternamn"
                                                className="col-span-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 text-sm"
                                            />
                                            <select
                                                value={runner.classId}
                                                onChange={(e) => updateClubRunner(runner.id, { classId: e.target.value })}
                                                className="col-span-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                            >
                                                <option value="">Klass...</option>
                                                {event.classes?.map((cls: any) => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={runner.siCard}
                                                onChange={(e) => updateClubRunner(runner.id, { siCard: e.target.value })}
                                                placeholder="SI"
                                                className="col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeClubRunner(runner.id)}
                                                disabled={clubRunners.length <= 1}
                                                className="col-span-1 text-red-400 hover:text-red-300 disabled:opacity-40"
                                                aria-label={`Ta bort deltagare ${index + 1}`}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="text-red-500 text-sm text-center font-bold bg-red-950/30 py-2 rounded border border-red-900/30">{error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded bg-slate-800 border border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-xs hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleRegister}
                            disabled={isSubmitting || access.registrationRequiresLogin}
                            className="flex-1 px-4 py-3 rounded bg-emerald-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/50 transition-all hover:scale-105 active:scale-95"
                        >
                            {isSubmitting
                                ? 'Anmäler...'
                                : mode === 'club'
                                    ? 'Bekräfta klubbanmälan'
                                    : 'Bekräfta anmälan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
