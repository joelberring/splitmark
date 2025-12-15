'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from '@/lib/auth/hooks';
import { authManager } from '@/lib/auth/manager';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { CLUBS, DISTRICTS } from '@/types/clubs';

const MALE_CLASSES = ['H10', 'H12', 'H14', 'H16', 'H18', 'H20', 'H21', 'H35', 'H40', 'H45', 'H50', 'H55', 'H60', 'H65', 'H70', 'H75', 'H80', 'H85'];
const FEMALE_CLASSES = ['D10', 'D12', 'D14', 'D16', 'D18', 'D20', 'D21', 'D35', 'D40', 'D45', 'D50', 'D55', 'D60', 'D65', 'D70', 'D75', 'D80', 'D85'];
const OPEN_CLASSES = ['Öppen 1', 'Öppen 2', 'Öppen 3', 'Öppen 4', 'Öppen 5', 'Inskolning'];

interface UserProfile {
    gender: 'male' | 'female' | '';
    birthYear: number | null;
    defaultClass: string;
    siCard: string;
    club: string;
    clubId: string;
    clubless: boolean;
}

function calculateAgeClass(gender: 'male' | 'female', birthYear: number): string {
    const age = new Date().getFullYear() - birthYear;
    const prefix = gender === 'male' ? 'H' : 'D';
    if (age <= 10) return `${prefix}10`;
    if (age <= 12) return `${prefix}12`;
    if (age <= 14) return `${prefix}14`;
    if (age <= 16) return `${prefix}16`;
    if (age <= 18) return `${prefix}18`;
    if (age <= 20) return `${prefix}20`;
    if (age < 35) return `${prefix}21`;
    if (age < 40) return `${prefix}35`;
    if (age < 45) return `${prefix}40`;
    if (age < 50) return `${prefix}45`;
    if (age < 55) return `${prefix}50`;
    if (age < 60) return `${prefix}55`;
    if (age < 65) return `${prefix}60`;
    if (age < 70) return `${prefix}65`;
    if (age < 75) return `${prefix}70`;
    if (age < 80) return `${prefix}75`;
    if (age < 85) return `${prefix}80`;
    return `${prefix}85`;
}

function getAvailableClasses(gender: 'male' | 'female' | '', birthYear: number | null): string[] {
    if (!gender || !birthYear) return [...OPEN_CLASSES];
    const ageClass = calculateAgeClass(gender, birthYear);
    if (gender === 'male') {
        const idx = MALE_CLASSES.indexOf(ageClass);
        return [...MALE_CLASSES.slice(0, idx + 1), ...OPEN_CLASSES];
    } else {
        const idx = FEMALE_CLASSES.indexOf(ageClass);
        const maleIdx = MALE_CLASSES.indexOf(ageClass.replace('D', 'H'));
        return [...FEMALE_CLASSES.slice(0, idx + 1), ...(maleIdx >= 0 ? MALE_CLASSES.slice(0, maleIdx + 1) : []), ...OPEN_CLASSES];
    }
}

export default function ProfilePage() {
    const { user, loading } = useAuthState();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile>({ gender: '', birthYear: null, defaultClass: '', siCard: '', club: '', clubId: '', clubless: false });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('userProfile');
        if (stored) setProfile(JSON.parse(stored));
    }, []);

    useEffect(() => {
        if (profile.gender && profile.birthYear && !profile.defaultClass) {
            setProfile(prev => ({ ...prev, defaultClass: calculateAgeClass(profile.gender as 'male' | 'female', profile.birthYear!) }));
        }
    }, [profile.gender, profile.birthYear]);

    const handleSave = () => {
        localStorage.setItem('userProfile', JSON.stringify(profile));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const isProfileComplete = () => profile.gender && profile.birthYear && profile.defaultClass && profile.siCard && (profile.clubless || profile.club);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    const handleSignOut = async () => {
        await authManager.signOut();
        router.push('/');
    };

    const availableClasses = getAvailableClasses(profile.gender, profile.birthYear);

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-24">
            <PageHeader title="Min Profil" showLogo />

            <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
                {/* Profile Card */}
                <div className="bg-slate-900 rounded-xl p-5 mb-6 border border-slate-800">
                    <div className="flex items-center gap-4">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-14 h-14 rounded-full border-2 border-emerald-500" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl font-bold">
                                {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                            </div>
                        )}
                        <div className="flex-1">
                            <h2 className="text-lg font-bold">{user.displayName || 'Användare'}</h2>
                            <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                    </div>
                </div>

                {/* Profile Incomplete Warning */}
                {!isProfileComplete() && (
                    <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 mb-6 border-l-4 border-l-amber-500">
                        <p className="text-amber-400 text-sm font-bold uppercase tracking-wider">
                            ⚠️ Fyll i dina uppgifter för att anmäla dig till tävlingar
                        </p>
                    </div>
                )}

                {/* Settings Form */}
                <div className="bg-slate-900 rounded-xl p-5 mb-6 border border-slate-800">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Tävlingsinformation</h3>
                    <div className="space-y-4">
                        {/* Gender */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Kön</label>
                            <div className="flex gap-2">
                                {['male', 'female'].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setProfile({ ...profile, gender: g as 'male' | 'female', defaultClass: '' })}
                                        className={`flex-1 py-3 rounded-lg font-bold uppercase text-sm tracking-wider transition-all ${profile.gender === g ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        {g === 'male' ? '👨 Man' : '👩 Kvinna'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Birth Year */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Födelseår</label>
                            <select
                                value={profile.birthYear || ''}
                                onChange={(e) => setProfile({ ...profile, birthYear: parseInt(e.target.value) || null, defaultClass: '' })}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                            >
                                <option value="">Välj födelseår</option>
                                {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        {/* Default Class */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Förvald klass</label>
                            <select
                                value={profile.defaultClass}
                                onChange={(e) => setProfile({ ...profile, defaultClass: e.target.value })}
                                disabled={!profile.gender || !profile.birthYear}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50"
                            >
                                <option value="">Välj klass</option>
                                {availableClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                            </select>
                        </div>

                        {/* SI Card */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">SI-bricknummer</label>
                            <input
                                type="text"
                                value={profile.siCard}
                                onChange={(e) => setProfile({ ...profile, siCard: e.target.value })}
                                placeholder="T.ex. 1234567"
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                            />
                        </div>

                        {/* Club */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Klubb</label>
                            <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={profile.clubless}
                                    onChange={(e) => setProfile({ ...profile, clubless: e.target.checked, club: '', clubId: '' })}
                                    className="w-5 h-5 rounded accent-emerald-500"
                                />
                                <span className="text-slate-300">Klubblös</span>
                            </label>
                            {!profile.clubless && (
                                <select
                                    value={profile.clubId || ''}
                                    onChange={(e) => {
                                        const club = CLUBS.find(c => c.id === e.target.value);
                                        setProfile({ ...profile, clubId: e.target.value, club: club?.name || '' });
                                    }}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                >
                                    <option value="">Välj klubb...</option>
                                    {DISTRICTS.map(d => (
                                        <optgroup key={d.id} label={d.name}>
                                            {CLUBS.filter(c => c.districtId === d.id).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={!isProfileComplete()}
                            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saved ? '✓ Sparat!' : 'Spara inställningar'}
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                {isProfileComplete() && (
                    <div className="bg-slate-900 rounded-xl p-5 mb-6 border border-slate-800">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-slate-800 rounded-lg text-center">
                                <div className="text-xl font-bold text-emerald-400">{profile.defaultClass}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Klass</div>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg text-center">
                                <div className="text-xl font-bold text-emerald-400">{profile.siCard}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">SI-bricka</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sign Out */}
                <button
                    onClick={handleSignOut}
                    className="w-full py-3 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg font-bold uppercase tracking-widest hover:bg-red-600/30 transition-colors"
                >
                    Logga ut
                </button>
            </main>

            <BottomNavigation />
        </div>
    );
}
