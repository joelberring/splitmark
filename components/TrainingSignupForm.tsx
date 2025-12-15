'use client';

import { useState } from 'react';
import type { TrainingSignup } from '@/types/social';

interface TrainingSignupFormProps {
    trainingId: string;
    trainingName: string;
    trainingDate: string;
    onSignup?: (signup: TrainingSignup) => void;
}

/**
 * Training signup form that works for both logged-in users and guests
 */
export default function TrainingSignupForm({
    trainingId,
    trainingName,
    trainingDate,
    onSignup,
}: TrainingSignupFormProps) {
    const [mode, setMode] = useState<'guest' | 'login'>('guest');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [comment, setComment] = useState('');
    const [attending, setAttending] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'guest' && !guestName.trim()) {
            alert('Ange ditt namn');
            return;
        }

        const signup: TrainingSignup = {
            id: `signup-${Date.now()}`,
            trainingId,
            guestName: mode === 'guest' ? guestName : undefined,
            guestEmail: mode === 'guest' ? guestEmail : undefined,
            guestPhone: mode === 'guest' ? guestPhone : undefined,
            signupTime: new Date(),
            attending,
            comment: comment || undefined,
        };

        // Save to localStorage (in production, to Firestore)
        const key = `training-signups-${trainingId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(signup);
        localStorage.setItem(key, JSON.stringify(existing));

        onSignup?.(signup);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mb-2">
                    Anmälan registrerad!
                </h3>
                <p className="text-emerald-700 dark:text-emerald-300">
                    {attending ? 'Välkommen till träningen!' : 'Vi noterar att du inte kan delta.'}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                    {trainingName} · {trainingDate}
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                📝 Anmälan till träning
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                {trainingName} · {trainingDate}
            </p>

            {/* Attendance Toggle */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Kan du delta?
                </label>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => setAttending(true)}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${attending
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        ✓ Ja, jag kommer
                    </button>
                    <button
                        type="button"
                        onClick={() => setAttending(false)}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${!attending
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        ✗ Nej, kan inte
                    </button>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg inline-flex">
                <button
                    type="button"
                    onClick={() => setMode('guest')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'guest'
                            ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                >
                    Anmäl som gäst
                </button>
                <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${mode === 'login'
                            ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                >
                    Logga in
                </button>
            </div>

            {mode === 'guest' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Namn *
                        </label>
                        <input
                            type="text"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Ditt namn"
                            required
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            E-post (valfritt)
                        </label>
                        <input
                            type="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="din@email.se"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Telefon (valfritt)
                        </label>
                        <input
                            type="tel"
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            placeholder="07X-XXX XX XX"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Logga in för att anmäla dig med ditt konto
                    </p>
                    <a
                        href={`/login?redirect=/training/${trainingId}`}
                        className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                    >
                        Logga in
                    </a>
                </div>
            )}

            {/* Comment */}
            {mode === 'guest' && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kommentar (valfritt)
                    </label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="T.ex. 'Tar med en kompis' eller 'Kommer lite sent'"
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white resize-none"
                    />
                </div>
            )}

            {/* Submit */}
            {mode === 'guest' && (
                <button
                    type="submit"
                    className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg"
                >
                    {attending ? '✓ Bekräfta anmälan' : 'Skicka avanmälan'}
                </button>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                Dina uppgifter sparas endast för denna träning
            </p>
        </form>
    );
}
