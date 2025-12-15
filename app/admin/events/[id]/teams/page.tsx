'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import type { Entry } from '@/types/entry';

interface Team {
    id: string;
    name: string;
    clubName: string;
    classId: string;
    className: string;
    members: TeamMember[];
    status: 'registered' | 'started' | 'finished' | 'dnf' | 'dsq';
    finishTime?: string;
}

interface TeamMember {
    id: string;
    legNumber: number;
    firstName: string;
    lastName: string;
    siCard?: string;
    status?: 'waiting' | 'running' | 'finished';
    startTime?: string;
    finishTime?: string;
    runningTime?: number;
}

export default function TeamsPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [teams, setTeams] = useState<Team[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [selectedClass, setSelectedClass] = useState('all');

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setClasses(event.classes || []);
                setTeams(event.teams || []);
            }
        }
        setLoading(false);
    };

    const saveTeams = (newTeams: Team[]) => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const index = events.findIndex((e: any) => e.id === eventId);
            if (index >= 0) {
                events[index].teams = newTeams;
                localStorage.setItem('events', JSON.stringify(events));
            }
        }
        setTeams(newTeams);
    };

    const handleAddTeam = (team: Omit<Team, 'id'>) => {
        const newTeam: Team = {
            ...team,
            id: `team-${Date.now()}`,
        };
        saveTeams([...teams, newTeam]);
        setShowAddModal(false);
    };

    const handleUpdateTeam = (team: Team) => {
        const updated = teams.map(t => t.id === team.id ? team : t);
        saveTeams(updated);
        setEditingTeam(null);
    };

    const handleDeleteTeam = (teamId: string) => {
        if (confirm('Ta bort detta lag?')) {
            saveTeams(teams.filter(t => t.id !== teamId));
        }
    };

    const filteredTeams = selectedClass === 'all'
        ? teams
        : teams.filter(t => t.classId === selectedClass);

    const getClassName = (classId: string): string => {
        return classes.find((c: any) => c.id === classId)?.name || 'Okänd';
    };

    const formatTime = (ms?: number): string => {
        if (!ms) return '-';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block">
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            👥 Lag & Stafett
                            <HelpButton topic="teams" />
                        </h1>
                        <div className="flex gap-3">
                            <button
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
                            >
                                📥 Importera lag
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                            >
                                + Nytt lag
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Filter */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setSelectedClass('all')}
                            className={`px-4 py-2 rounded-lg font-semibold ${selectedClass === 'all'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            Alla klasser
                        </button>
                        {classes.map((cls: any) => (
                            <button
                                key={cls.id}
                                onClick={() => setSelectedClass(cls.id)}
                                className={`px-4 py-2 rounded-lg font-semibold ${selectedClass === cls.id
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Teams */}
                {filteredTeams.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                        <div className="text-6xl mb-4">👥</div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            Inga lag ännu
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Skapa lag manuellt eller importera från fil
                        </p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold"
                        >
                            Skapa första laget
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredTeams.map(team => (
                            <div key={team.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                                            {team.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {team.clubName} · {team.className}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {team.finishTime && (
                                            <span className="text-2xl font-mono font-bold text-emerald-600">
                                                {formatTime(team.members.reduce((acc, m) => acc + (m.runningTime || 0), 0))}
                                            </span>
                                        )}
                                        <StatusBadge status={team.status} />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingTeam(team)}
                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                            >
                                                Redigera
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTeam(team.id)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                Ta bort
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Team Members */}
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Sträcka</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Namn</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">SI-bricka</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Tid</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700 text-sm">
                                        {team.members.map(member => (
                                            <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">
                                                    {member.legNumber}
                                                </td>
                                                <td className="px-4 py-3 text-gray-800 dark:text-gray-100">
                                                    {member.firstName && member.lastName
                                                        ? `${member.firstName} ${member.lastName}`
                                                        : <span className="text-gray-400 italic">Ej tillsatt</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">
                                                    {member.siCard || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <MemberStatusBadge status={member.status} />
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                                                    {formatTime(member.runningTime)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {(showAddModal || editingTeam) && (
                <TeamModal
                    team={editingTeam}
                    classes={classes}
                    onSave={editingTeam ? handleUpdateTeam : handleAddTeam}
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingTeam(null);
                    }}
                />
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: Team['status'] }) {
    const styles: Record<Team['status'], string> = {
        registered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        started: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        finished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        dnf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        dsq: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };

    const labels: Record<Team['status'], string> = {
        registered: 'Anmält',
        started: 'Pågår',
        finished: 'I mål',
        dnf: 'DNF',
        dsq: 'DSQ',
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

function MemberStatusBadge({ status }: { status?: TeamMember['status'] }) {
    if (!status || status === 'waiting') {
        return <span className="text-gray-400 text-xs">Väntar</span>;
    }
    if (status === 'running') {
        return <span className="text-yellow-600 text-xs">Pågår</span>;
    }
    return <span className="text-emerald-600 text-xs">✓ Klar</span>;
}

function TeamModal({
    team,
    classes,
    onSave,
    onClose,
}: {
    team: Team | null;
    classes: any[];
    onSave: (team: any) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(team?.name || '');
    const [clubName, setClubName] = useState(team?.clubName || '');
    const [classId, setClassId] = useState(team?.classId || classes[0]?.id || '');
    const [legCount, setLegCount] = useState(team?.members.length || 3);
    const [members, setMembers] = useState<TeamMember[]>(
        team?.members || Array.from({ length: 3 }, (_, i) => ({
            id: `member-${i}`,
            legNumber: i + 1,
            firstName: '',
            lastName: '',
            siCard: '',
        }))
    );

    const handleLegCountChange = (count: number) => {
        setLegCount(count);
        if (count > members.length) {
            const newMembers = [...members];
            for (let i = members.length; i < count; i++) {
                newMembers.push({
                    id: `member-${i}`,
                    legNumber: i + 1,
                    firstName: '',
                    lastName: '',
                    siCard: '',
                });
            }
            setMembers(newMembers);
        } else {
            setMembers(members.slice(0, count));
        }
    };

    const updateMember = (index: number, field: keyof TeamMember, value: string) => {
        const updated = [...members];
        (updated[index] as any)[field] = value;
        setMembers(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const className = classes.find((c: any) => c.id === classId)?.name || '';

        onSave({
            ...team,
            name,
            clubName,
            classId,
            className,
            members,
            status: team?.status || 'registered',
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8">
                <div className="p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {team ? 'Redigera lag' : 'Skapa lag'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Lagnamn *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="T.ex. OK Linné 1"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Klubb *
                            </label>
                            <input
                                type="text"
                                required
                                value={clubName}
                                onChange={(e) => setClubName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Klass
                            </label>
                            <select
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            >
                                {classes.map((cls: any) => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Antal sträckor
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={legCount}
                                onChange={(e) => handleLegCountChange(parseInt(e.target.value) || 3)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Team Members */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Lagmedlemmar
                        </label>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {members.map((member, index) => (
                                <div key={member.id} className="flex gap-3 items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <span className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-full font-bold text-sm">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Förnamn"
                                        value={member.firstName}
                                        onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Efternamn"
                                        value={member.lastName}
                                        onChange={(e) => updateMember(index, 'lastName', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="SI-bricka"
                                        value={member.siCard || ''}
                                        onChange={(e) => updateMember(index, 'siCard', e.target.value)}
                                        className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white font-mono"
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            💡 Lämna tomt för att skapa anonyma platser som fylls i senare
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            {team ? 'Spara ändringar' : 'Skapa lag'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
