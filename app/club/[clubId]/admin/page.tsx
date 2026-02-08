'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useClubPermissions, useRoleManagement, useUserWithRoles } from '@/lib/auth/usePermissions';
import { getKnownRoleUsers } from '@/lib/auth/event-admins';
import { subscribeToClubMembershipRequests } from '@/lib/firestore/club-membership-requests';
import type { Club, Team } from '@/types/roles';

interface ClubMemberView {
    id: string;
    name: string;
    email: string;
    role: 'club_admin' | 'trainer' | 'member';
}

interface LeaderGroup {
    id: string;
    clubId: string;
    name: string;
    description?: string;
    ageSegment?: 'barn' | 'ungdom' | 'vuxen' | 'mix';
    leaderIds: string[];
    memberIds: string[];
    createdAt: string;
    updatedAt: string;
}

interface LeaderEventEntry {
    id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    className?: string;
    status?: string;
    resultStatus?: string;
    startTime?: string;
    finishTime?: string;
    punches?: Array<{ code?: string; controlCode?: string; time?: string }>;
}

interface LeaderTrainingSession {
    id?: string;
    userId?: string;
    userName?: string;
    elapsedSeconds?: number;
    result?: string;
    finishedAt?: string;
}

interface ClubEventSnapshot {
    id: string;
    name: string;
    entries: LeaderEventEntry[];
    trainingSessions: LeaderTrainingSession[];
}

interface LeaderMemberInsight {
    memberId: string;
    memberName: string;
    role: ClubMemberView['role'];
    live: {
        inForest: boolean;
        label: string;
        eventName?: string;
        className?: string;
        startTime?: string;
    };
    results: {
        starts: number;
        finished: number;
        ok: number;
        mp: number;
        dnf: number;
    };
    training: {
        sessions: number;
        bestSeconds?: number;
        avgSeconds?: number;
        latestAt?: string;
    };
}

const LEADER_GROUPS_STORAGE_PREFIX = 'club-leader-groups-';

function leaderGroupsStorageKey(clubId: string): string {
    return `${LEADER_GROUPS_STORAGE_PREFIX}${clubId}`;
}

function parseIsoTime(value?: string): string | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
}

function normalizeName(value?: string): string {
    return (value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim();
}

function memberMatchesEntry(member: ClubMemberView, entry: LeaderEventEntry): boolean {
    if (!entry) return false;

    const entryUserId = typeof entry.userId === 'string' ? entry.userId.trim() : '';
    if (entryUserId && entryUserId === member.id) return true;

    const memberName = normalizeName(member.name);
    const fullName = normalizeName(`${entry.firstName || ''} ${entry.lastName || ''}`);
    const fallbackName = normalizeName(entry.name);

    if (memberName && fullName && memberName === fullName) return true;
    if (memberName && fallbackName && memberName === fallbackName) return true;

    return false;
}

function memberMatchesTrainingSession(member: ClubMemberView, session: LeaderTrainingSession): boolean {
    const sessionUserId = typeof session.userId === 'string' ? session.userId.trim() : '';
    if (sessionUserId && sessionUserId === member.id) return true;

    const memberName = normalizeName(member.name);
    const sessionName = normalizeName(session.userName);
    return !!(memberName && sessionName && memberName === sessionName);
}

function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '—';
    const total = Math.floor(seconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(value?: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function readLeaderGroups(clubId: string): LeaderGroup[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(leaderGroupsStorageKey(clubId));
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((group) => group && typeof group === 'object' && group.id)
            .map((group) => ({
                id: String(group.id),
                clubId,
                name: String(group.name || 'Grupp'),
                description: typeof group.description === 'string' ? group.description : '',
                ageSegment: group.ageSegment === 'barn' || group.ageSegment === 'ungdom' || group.ageSegment === 'vuxen'
                    ? group.ageSegment
                    : 'mix',
                leaderIds: Array.isArray(group.leaderIds) ? group.leaderIds.map((id: string) => String(id)) : [],
                memberIds: Array.isArray(group.memberIds) ? group.memberIds.map((id: string) => String(id)) : [],
                createdAt: parseIsoTime(group.createdAt) || new Date().toISOString(),
                updatedAt: parseIsoTime(group.updatedAt) || new Date().toISOString(),
            } as LeaderGroup))
            .sort((left, right) => left.name.localeCompare(right.name, 'sv'));
    } catch {
        return [];
    }
}

function readClubEventSnapshots(clubId: string): ClubEventSnapshot[] {
    if (typeof window === 'undefined') return [];

    try {
        const rawEvents = localStorage.getItem('events');
        if (!rawEvents) return [];

        const parsedEvents = JSON.parse(rawEvents);
        if (!Array.isArray(parsedEvents)) return [];

        return parsedEvents
            .filter((eventItem) => eventItem && eventItem.clubId === clubId)
            .map((eventItem) => {
                const eventId = String(eventItem.id || '');
                const trainingRaw = eventId
                    ? localStorage.getItem(`splitmark:training-sessions:${eventId}`)
                    : null;

                let trainingSessions: LeaderTrainingSession[] = [];
                if (trainingRaw) {
                    try {
                        const parsedTraining = JSON.parse(trainingRaw);
                        if (Array.isArray(parsedTraining)) {
                            trainingSessions = parsedTraining as LeaderTrainingSession[];
                        }
                    } catch {
                        trainingSessions = [];
                    }
                }

                return {
                    id: eventId,
                    name: String(eventItem.name || 'Tävling'),
                    entries: Array.isArray(eventItem.entries) ? eventItem.entries : [],
                    trainingSessions,
                } as ClubEventSnapshot;
            });
    } catch {
        return [];
    }
}

function collectMemberInsight(
    member: ClubMemberView,
    events: ClubEventSnapshot[]
): LeaderMemberInsight {
    const matchingEntries = events.flatMap((eventItem) =>
        eventItem.entries
            .filter((entry) => memberMatchesEntry(member, entry))
            .map((entry) => ({ ...entry, __eventName: eventItem.name }))
    );

    const starts = matchingEntries.filter((entry) => !!entry.startTime).length;
    const finished = matchingEntries.filter((entry) => !!entry.finishTime || entry.status === 'finished').length;
    const ok = matchingEntries.filter((entry) => entry.resultStatus === 'ok').length;
    const mp = matchingEntries.filter((entry) => entry.resultStatus === 'mp').length;
    const dnf = matchingEntries.filter((entry) =>
        entry.resultStatus === 'dnf' || entry.resultStatus === 'dns' || entry.status === 'dnf' || entry.status === 'dns'
    ).length;

    const activeRuns = matchingEntries
        .filter((entry) => {
            const hasStarted = !!entry.startTime;
            const hasFinished = !!entry.finishTime || entry.status === 'finished';
            const isCancelled = entry.status === 'dns' || entry.status === 'dnf' || entry.status === 'cancelled' || entry.status === 'dsq';
            return hasStarted && !hasFinished && !isCancelled;
        })
        .sort((left, right) => (right.startTime || '').localeCompare(left.startTime || ''));

    const activeRun = activeRuns[0];
    const lastPunch = activeRun?.punches && activeRun.punches.length > 0
        ? activeRun.punches[activeRun.punches.length - 1]
        : null;

    const liveLabel = activeRun
        ? (lastPunch?.code || lastPunch?.controlCode
            ? `Senast kontroll ${lastPunch.code || lastPunch.controlCode}`
            : 'Ute i skogen')
        : 'Inte aktiv just nu';

    const matchingSessions = events.flatMap((eventItem) =>
        eventItem.trainingSessions.filter((session) => memberMatchesTrainingSession(member, session))
    );

    const sessionDurations = matchingSessions
        .map((session) => Number(session.elapsedSeconds || 0))
        .filter((value) => Number.isFinite(value) && value > 0);

    const bestSeconds = sessionDurations.length > 0 ? Math.min(...sessionDurations) : undefined;
    const avgSeconds = sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((sum, value) => sum + value, 0) / sessionDurations.length)
        : undefined;
    const latestAt = matchingSessions
        .map((session) => parseIsoTime(session.finishedAt))
        .filter((value): value is string => !!value)
        .sort((left, right) => right.localeCompare(left))[0];

    return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        live: {
            inForest: !!activeRun,
            label: liveLabel,
            eventName: activeRun ? (activeRun as any).__eventName : undefined,
            className: activeRun?.className,
            startTime: parseIsoTime(activeRun?.startTime),
        },
        results: {
            starts,
            finished,
            ok,
            mp,
            dnf,
        },
        training: {
            sessions: matchingSessions.length,
            bestSeconds,
            avgSeconds,
            latestAt,
        },
    };
}

export default function ClubAdminPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const { user } = useUserWithRoles();
    const { isClubAdmin, isTrainer, isMember, loading } = useClubPermissions(clubId);
    const { assignClubRole, removeClubRole } = useRoleManagement();

    const [club, setClub] = useState<Club | null>(null);
    const [clubTeams, setClubTeams] = useState<Team[]>([]);
    const [members, setMembers] = useState<ClubMemberView[]>([]);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'teams' | 'leader' | 'settings'>('overview');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showCreateTeam, setShowCreateTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [memberMessage, setMemberMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [leaderGroups, setLeaderGroups] = useState<LeaderGroup[]>([]);
    const [selectedLeaderGroupId, setSelectedLeaderGroupId] = useState<string | null>(null);
    const [leaderMessage, setLeaderMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [newLeaderGroupName, setNewLeaderGroupName] = useState('');
    const [clubEventSnapshots, setClubEventSnapshots] = useState<ClubEventSnapshot[]>([]);
    const [leaderReloadAt, setLeaderReloadAt] = useState<string | null>(null);

    const loadClubMembers = () => {
        const knownUsers = getKnownRoleUsers();
        const knownUsersById = new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser]));
        const nextMembers: ClubMemberView[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith('user-roles-')) continue;

            const userId = key.replace('user-roles-', '');
            const storedRoleData = localStorage.getItem(key);
            if (!storedRoleData) continue;

            try {
                const parsedRoles = JSON.parse(storedRoleData);
                const clubRole = parsedRoles?.clubs?.[clubId]?.role as ClubMemberView['role'] | undefined;
                if (!clubRole) continue;

                const knownUser = knownUsersById.get(userId);
                nextMembers.push({
                    id: userId,
                    name: knownUser?.displayName || `Användare ${userId.slice(-6)}`,
                    email: knownUser?.email || '',
                    role: clubRole,
                });
            } catch {
                continue;
            }
        }

        nextMembers.sort((a, b) => {
            if (a.role === 'club_admin' && b.role !== 'club_admin') return -1;
            if (a.role !== 'club_admin' && b.role === 'club_admin') return 1;
            return a.name.localeCompare(b.name, 'sv');
        });

        setMembers(nextMembers);
    };

    const loadLeaderGroups = () => {
        const groups = readLeaderGroups(clubId);
        setLeaderGroups(groups);
        setSelectedLeaderGroupId((previousSelected) => {
            if (previousSelected && groups.some((group) => group.id === previousSelected)) {
                return previousSelected;
            }
            return groups[0]?.id || null;
        });
    };

    const persistLeaderGroups = (groups: LeaderGroup[]) => {
        const sorted = [...groups].sort((left, right) => left.name.localeCompare(right.name, 'sv'));
        setLeaderGroups(sorted);
        localStorage.setItem(leaderGroupsStorageKey(clubId), JSON.stringify(sorted));
        setSelectedLeaderGroupId((previousSelected) => {
            if (previousSelected && sorted.some((group) => group.id === previousSelected)) {
                return previousSelected;
            }
            return sorted[0]?.id || null;
        });
    };

    const loadLeaderEventSnapshots = () => {
        const snapshots = readClubEventSnapshots(clubId);
        setClubEventSnapshots(snapshots);
        setLeaderReloadAt(new Date().toISOString());
    };

    useEffect(() => {
        // Load club data
        const storedClubs = localStorage.getItem('clubs');
        if (storedClubs) {
            const clubs = JSON.parse(storedClubs);
            const foundClub = clubs.find((c: Club) => c.id === clubId);
            setClub(foundClub);
        }

        // Load teams
        const storedTeams = localStorage.getItem(`teams-${clubId}`);
        if (storedTeams) {
            setClubTeams(JSON.parse(storedTeams));
        }

        // Load members from role storage
        loadClubMembers();
        loadLeaderGroups();
    }, [clubId]);

    useEffect(() => {
        const unsubscribe = subscribeToClubMembershipRequests(clubId, (requests) => {
            setPendingRequestsCount(requests.length);
        }, { status: 'pending' });

        return () => unsubscribe?.();
    }, [clubId]);

    useEffect(() => {
        if (activeTab !== 'leader') return;

        loadLeaderEventSnapshots();

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key && !event.key.startsWith('splitmark:training-sessions:') && event.key !== 'events') {
                return;
            }
            loadLeaderEventSnapshots();
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [activeTab, clubId]);

    const syncClubMemberCount = (memberCount: number) => {
        const storedClubs = localStorage.getItem('clubs');
        if (!storedClubs) return;

        const clubs = JSON.parse(storedClubs);
        const updatedClubs = clubs.map((clubItem: Club) => (
            clubItem.id === clubId
                ? { ...clubItem, memberCount }
                : clubItem
        ));
        localStorage.setItem('clubs', JSON.stringify(updatedClubs));
    };

    const handleMemberRoleChange = (
        memberId: string,
        nextRole: 'club_admin' | 'trainer' | 'member'
    ) => {
        const targetMember = members.find((member) => member.id === memberId);
        if (!targetMember || targetMember.role === nextRole) {
            return;
        }

        const currentClubAdmins = members.filter((member) => member.role === 'club_admin');
        const isDemotingLastAdmin = targetMember.role === 'club_admin'
            && nextRole !== 'club_admin'
            && currentClubAdmins.length <= 1;

        if (isDemotingLastAdmin) {
            setMemberMessage({ type: 'error', text: 'Minst en klubbadmin måste finnas kvar.' });
            return;
        }

        const result = assignClubRole(memberId, clubId, nextRole);
        if (!result.success) {
            setMemberMessage({ type: 'error', text: result.error || 'Kunde inte uppdatera medlemsroll.' });
            return;
        }

        loadClubMembers();
        setMemberMessage({ type: 'success', text: `Uppdaterade roll för ${targetMember.name}.` });
    };

    const handleRemoveMember = (memberId: string) => {
        const targetMember = members.find((member) => member.id === memberId);
        if (!targetMember) return;

        const currentClubAdmins = members.filter((member) => member.role === 'club_admin');
        const isRemovingLastAdmin = targetMember.role === 'club_admin' && currentClubAdmins.length <= 1;
        if (isRemovingLastAdmin) {
            setMemberMessage({ type: 'error', text: 'Minst en klubbadmin måste finnas kvar.' });
            return;
        }

        const result = removeClubRole(memberId, clubId);
        if (!result.success) {
            setMemberMessage({ type: 'error', text: result.error || 'Kunde inte ta bort medlem från klubben.' });
            return;
        }

        const nextCount = Math.max(0, members.length - 1);
        syncClubMemberCount(nextCount);
        loadClubMembers();
        setMemberMessage({ type: 'success', text: `${targetMember.name} togs bort från klubben.` });
    };

    const canAccessLeaderMode = isClubAdmin || isTrainer;
    const canManageLeaderGroups = isClubAdmin;

    const leaderCandidates = useMemo(
        () => members.filter((member) => member.role === 'trainer' || member.role === 'club_admin'),
        [members]
    );

    const visibleLeaderGroups = useMemo(() => {
        if (canManageLeaderGroups) return leaderGroups;
        if (!user) return [];
        return leaderGroups.filter((group) => group.leaderIds.includes(user.id));
    }, [canManageLeaderGroups, leaderGroups, user]);

    const selectedLeaderGroup = useMemo(() => {
        if (visibleLeaderGroups.length === 0) return null;
        const selected = visibleLeaderGroups.find((group) => group.id === selectedLeaderGroupId);
        return selected || visibleLeaderGroups[0];
    }, [visibleLeaderGroups, selectedLeaderGroupId]);

    useEffect(() => {
        if (selectedLeaderGroup && selectedLeaderGroup.id !== selectedLeaderGroupId) {
            setSelectedLeaderGroupId(selectedLeaderGroup.id);
        }
    }, [selectedLeaderGroup, selectedLeaderGroupId]);

    const selectedLeaderInsights = useMemo(() => {
        if (!selectedLeaderGroup) return [];
        const memberById = new Map(members.map((member) => [member.id, member]));

        return selectedLeaderGroup.memberIds
            .map((memberId) => memberById.get(memberId))
            .filter((member): member is ClubMemberView => !!member)
            .map((member) => collectMemberInsight(member, clubEventSnapshots))
            .sort((left, right) => left.memberName.localeCompare(right.memberName, 'sv'));
    }, [selectedLeaderGroup, members, clubEventSnapshots]);

    const selectedLeaderStats = useMemo(() => {
        return selectedLeaderInsights.reduce((stats, insight) => {
            stats.members += 1;
            stats.inForest += insight.live.inForest ? 1 : 0;
            stats.starts += insight.results.starts;
            stats.finished += insight.results.finished;
            stats.ok += insight.results.ok;
            stats.trainingSessions += insight.training.sessions;
            return stats;
        }, {
            members: 0,
            inForest: 0,
            starts: 0,
            finished: 0,
            ok: 0,
            trainingSessions: 0,
        });
    }, [selectedLeaderInsights]);

    const handleCreateLeaderGroup = () => {
        if (!canManageLeaderGroups) {
            setLeaderMessage({ type: 'error', text: 'Endast klubbadmin kan skapa grupper.' });
            return;
        }

        const name = newLeaderGroupName.trim();
        if (!name) return;

        const nowIso = new Date().toISOString();
        const newGroup: LeaderGroup = {
            id: `leader-group-${Date.now()}`,
            clubId,
            name,
            description: '',
            ageSegment: 'mix',
            leaderIds: user?.id ? [user.id] : [],
            memberIds: [],
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        persistLeaderGroups([...leaderGroups, newGroup]);
        setNewLeaderGroupName('');
        setSelectedLeaderGroupId(newGroup.id);
        setLeaderMessage({ type: 'success', text: `Skapade gruppen ${newGroup.name}.` });
    };

    const handleDeleteLeaderGroup = (groupId: string) => {
        if (!canManageLeaderGroups) {
            setLeaderMessage({ type: 'error', text: 'Endast klubbadmin kan ta bort grupper.' });
            return;
        }

        const target = leaderGroups.find((group) => group.id === groupId);
        if (!target) return;

        const next = leaderGroups.filter((group) => group.id !== groupId);
        persistLeaderGroups(next);
        setLeaderMessage({ type: 'success', text: `Tog bort gruppen ${target.name}.` });
    };

    const updateSelectedLeaderGroup = (updater: (group: LeaderGroup) => LeaderGroup) => {
        if (!selectedLeaderGroup) return;
        if (!canManageLeaderGroups) {
            setLeaderMessage({ type: 'error', text: 'Endast klubbadmin kan ändra grupper.' });
            return;
        }

        const nextGroups = leaderGroups.map((group) => (
            group.id === selectedLeaderGroup.id
                ? updater({
                    ...group,
                    updatedAt: new Date().toISOString(),
                })
                : group
        ));
        persistLeaderGroups(nextGroups);
    };

    const toggleLeaderForGroup = (memberId: string) => {
        updateSelectedLeaderGroup((group) => {
            const hasLeader = group.leaderIds.includes(memberId);
            return {
                ...group,
                leaderIds: hasLeader
                    ? group.leaderIds.filter((id) => id !== memberId)
                    : [...group.leaderIds, memberId],
            };
        });
    };

    const toggleMemberForGroup = (memberId: string) => {
        updateSelectedLeaderGroup((group) => {
            const hasMember = group.memberIds.includes(memberId);
            return {
                ...group,
                memberIds: hasMember
                    ? group.memberIds.filter((id) => id !== memberId)
                    : [...group.memberIds, memberId],
            };
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!isClubAdmin && !isMember) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Åtkomst Nekad
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Du är inte medlem i denna klubb.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                    >
                        Tillbaka
                    </Link>
                </div>
            </div>
        );
    }

    const handleInvite = () => {
        alert(`Inbjudan skickad till ${inviteEmail} (demo)`);
        setInviteEmail('');
        setShowInviteModal(false);
    };

    const handleCreateTeam = () => {
        if (!newTeamName.trim()) return;

        const newTeam: Team = {
            id: `team-${Date.now()}`,
            clubId,
            name: newTeamName,
            trainers: [],
            members: [],
            createdAt: new Date(),
        };

        const updatedTeams = [...clubTeams, newTeam];
        setClubTeams(updatedTeams);
        localStorage.setItem(`teams-${clubId}`, JSON.stringify(updatedTeams));
        setNewTeamName('');
        setShowCreateTeam(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b-4 border-emerald-500">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-gray-500 hover:text-emerald-600">
                                ← Hem
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span>🏠</span> {club?.name || 'Klubb'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {isClubAdmin ? 'Klubbadministration' : 'Medlemsvy'}
                                </p>
                            </div>
                        </div>
                        {isClubAdmin && (
                            <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg font-semibold">
                                Klubbadmin
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex gap-8">
                        {[
                            { id: 'overview', label: 'Översikt', icon: '📊' },
                            { id: 'members', label: 'Medlemmar', icon: '👥' },
                            { id: 'teams', label: 'Lag', icon: '🏃‍♂️' },
                            ...(canAccessLeaderMode ? [{ id: 'leader', label: 'Ledarläge', icon: '🧑‍🏫' }] : []),
                            ...(isClubAdmin ? [{ id: 'settings', label: 'Inställningar', icon: '⚙️' }] : []),
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-all ${activeTab === tab.id
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {members.length}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Medlemmar</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                                    {clubTeams.length}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Lag</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                                    0
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">Tävlingar</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                                Snabbåtgärder
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {isClubAdmin && pendingRequestsCount > 0 && (
                                    <Link
                                        href={`/club/${clubId}/requests`}
                                        className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors relative"
                                    >
                                        <span className="text-2xl">📨</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Förfrågningar
                                        </div>
                                        <span className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                            {pendingRequestsCount}
                                        </span>
                                    </Link>
                                )}
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowInviteModal(true)}
                                        className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left"
                                    >
                                        <span className="text-2xl">✉️</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Bjud in medlem
                                        </div>
                                    </button>
                                )}
                                <Link
                                    href={`/admin/events/create?club=${clubId}`}
                                    className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                    <span className="text-2xl">📅</span>
                                    <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                        Skapa tävling
                                    </div>
                                </Link>
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowCreateTeam(true)}
                                        className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
                                    >
                                        <span className="text-2xl">👥</span>
                                        <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                            Skapa lag
                                        </div>
                                    </button>
                                )}
                                <Link
                                    href={`/training`}
                                    className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                >
                                    <span className="text-2xl">📊</span>
                                    <div className="font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                        Träningslogg
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Medlemmar
                            </h2>
                            {isClubAdmin && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    + Bjud in
                                </button>
                            )}
                        </div>
                        {memberMessage && (
                            <div className={`mx-6 mt-4 mb-2 rounded-lg px-4 py-3 text-sm ${memberMessage.type === 'error'
                                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                }`}>
                                {memberMessage.text}
                            </div>
                        )}
                        <div className="divide-y dark:divide-gray-700">
                            {members.map((member) => (
                                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                {member.name}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {member.email || member.id}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isClubAdmin ? (
                                            <>
                                                <select
                                                    value={member.role}
                                                    onChange={(eventValue) => handleMemberRoleChange(
                                                        member.id,
                                                        eventValue.target.value as 'club_admin' | 'trainer' | 'member'
                                                    )}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                                >
                                                    <option value="member">Medlem</option>
                                                    <option value="trainer">Tränare</option>
                                                    <option value="club_admin">Klubbadmin</option>
                                                </select>
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                >
                                                    Ta bort
                                                </button>
                                            </>
                                        ) : (
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${member.role === 'club_admin'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                : member.role === 'trainer'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                }`}>
                                                {member.role === 'club_admin' ? 'Admin' : member.role === 'trainer' ? 'Tränare' : 'Medlem'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && (
                                <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
                                    Inga medlemmar registrerade ännu.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Teams Tab */}
                {activeTab === 'teams' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Lag
                            </h2>
                            {isClubAdmin && (
                                <button
                                    onClick={() => setShowCreateTeam(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    + Nytt Lag
                                </button>
                            )}
                        </div>

                        {clubTeams.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                                <div className="text-6xl mb-4">👥</div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                                    Inga lag ännu
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Skapa lag för att gruppera medlemmar
                                </p>
                                {isClubAdmin && (
                                    <button
                                        onClick={() => setShowCreateTeam(true)}
                                        className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                    >
                                        Skapa Lag
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {clubTeams.map((team) => (
                                    <div key={team.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                                {team.name}
                                            </h3>
                                            <span className="text-sm text-gray-500">
                                                {team.members.length} medlemmar
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                            {team.trainers.length > 0 ? `${team.trainers.length} tränare` : 'Ingen tränare'}
                                        </div>
                                        <Link
                                            href={`/club/${clubId}/teams/${team.id}`}
                                            className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            Hantera →
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Leader Tab */}
                {activeTab === 'leader' && (
                    <div className="space-y-6">
                        {!canAccessLeaderMode ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                                <div className="text-4xl mb-3">🔒</div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Ingen åtkomst</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Ledarläget är tillgängligt för klubbadmin och tränare.
                                </p>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Träningsgrupper</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                            Koppla aktiva till grupper och ansvariga ledare.
                                        </p>

                                        {canManageLeaderGroups && (
                                            <div className="flex gap-2 mb-4">
                                                <input
                                                    type="text"
                                                    value={newLeaderGroupName}
                                                    onChange={(eventValue) => setNewLeaderGroupName(eventValue.target.value)}
                                                    placeholder="Ny grupp, t.ex. Vit grupp"
                                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                                />
                                                <button
                                                    onClick={handleCreateLeaderGroup}
                                                    disabled={!newLeaderGroupName.trim()}
                                                    className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                                >
                                                    + Lägg till
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {visibleLeaderGroups.map((group) => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => setSelectedLeaderGroupId(group.id)}
                                                    className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${selectedLeaderGroup?.id === group.id
                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900/40'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-gray-800 dark:text-gray-100">{group.name}</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {group.memberIds.length} aktiva
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {group.leaderIds.length} ledare
                                                    </p>
                                                </button>
                                            ))}
                                            {visibleLeaderGroups.length === 0 && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Inga grupper ännu.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5">
                                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">Datakällor</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            Visar resultat från klubbens tävlingar och träningspass. Aktiv status i skogen byggs från startade men ej avslutade deltagare.
                                        </p>
                                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            <p>Klubbevent lästa: {clubEventSnapshots.length}</p>
                                            <p>Senast uppdaterad: {formatTime(leaderReloadAt || undefined)}</p>
                                        </div>
                                        <button
                                            onClick={loadLeaderEventSnapshots}
                                            className="mt-3 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600"
                                        >
                                            Uppdatera nu
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {leaderMessage && (
                                        <div className={`rounded-lg px-4 py-3 text-sm ${leaderMessage.type === 'error'
                                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            }`}>
                                            {leaderMessage.text}
                                        </div>
                                    )}

                                    {!selectedLeaderGroup ? (
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
                                            <div className="text-5xl mb-4">🧑‍🏫</div>
                                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Välj en grupp</h3>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Markera en grupp till vänster för att se ledare, aktiva och status i skogen.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 space-y-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        {canManageLeaderGroups ? (
                                                            <input
                                                                type="text"
                                                                value={selectedLeaderGroup.name}
                                                                onChange={(eventValue) => updateSelectedLeaderGroup((group) => ({
                                                                    ...group,
                                                                    name: eventValue.target.value,
                                                                }))}
                                                                className="w-full text-xl font-bold bg-transparent border-b border-gray-200 dark:border-gray-700 pb-1 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-emerald-500"
                                                            />
                                                        ) : (
                                                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{selectedLeaderGroup.name}</h2>
                                                        )}
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                            ID: {selectedLeaderGroup.id}
                                                        </p>
                                                    </div>
                                                    {canManageLeaderGroups && (
                                                        <button
                                                            onClick={() => handleDeleteLeaderGroup(selectedLeaderGroup.id)}
                                                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                                                        >
                                                            Ta bort grupp
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                                            Beskrivning
                                                        </label>
                                                        {canManageLeaderGroups ? (
                                                            <textarea
                                                                value={selectedLeaderGroup.description || ''}
                                                                onChange={(eventValue) => updateSelectedLeaderGroup((group) => ({
                                                                    ...group,
                                                                    description: eventValue.target.value,
                                                                }))}
                                                                rows={3}
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                                                placeholder="T.ex. nybörjare med fokus på säkerhet och vägval."
                                                            />
                                                        ) : (
                                                            <p className="text-sm text-gray-600 dark:text-gray-300">{selectedLeaderGroup.description || 'Ingen beskrivning'}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                                            Ålderssegment
                                                        </label>
                                                        {canManageLeaderGroups ? (
                                                            <select
                                                                value={selectedLeaderGroup.ageSegment || 'mix'}
                                                                onChange={(eventValue) => updateSelectedLeaderGroup((group) => ({
                                                                    ...group,
                                                                    ageSegment: eventValue.target.value as LeaderGroup['ageSegment'],
                                                                }))}
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                                            >
                                                                <option value="barn">Barn</option>
                                                                <option value="ungdom">Ungdom</option>
                                                                <option value="vuxen">Vuxen</option>
                                                                <option value="mix">Mixad grupp</option>
                                                            </select>
                                                        ) : (
                                                            <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{selectedLeaderGroup.ageSegment || 'mix'}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">Ledare</h4>
                                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                                            {leaderCandidates.map((candidate) => {
                                                                const checked = selectedLeaderGroup.leaderIds.includes(candidate.id);
                                                                return (
                                                                    <label key={candidate.id} className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                        <span>{candidate.name}</span>
                                                                        {canManageLeaderGroups ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleLeaderForGroup(candidate.id)}
                                                                                className="w-4 h-4"
                                                                            />
                                                                        ) : (
                                                                            <span className={`text-xs ${checked ? 'text-emerald-500' : 'text-gray-400'}`}>
                                                                                {checked ? 'Aktiv' : 'Ej vald'}
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                );
                                                            })}
                                                            {leaderCandidates.length === 0 && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">Inga tränare/klubbadmins hittades.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">Aktiva i gruppen</h4>
                                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                                            {members.map((member) => {
                                                                const checked = selectedLeaderGroup.memberIds.includes(member.id);
                                                                return (
                                                                    <label key={member.id} className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                        <span>{member.name}</span>
                                                                        {canManageLeaderGroups ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleMemberForGroup(member.id)}
                                                                                className="w-4 h-4"
                                                                            />
                                                                        ) : (
                                                                            <span className={`text-xs ${checked ? 'text-emerald-500' : 'text-gray-400'}`}>
                                                                                {checked ? 'I gruppen' : '—'}
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-5 gap-4">
                                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedLeaderStats.members}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Aktiva i gruppen</div>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                                                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selectedLeaderStats.inForest}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Ute i skogen nu</div>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedLeaderStats.starts}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Starter</div>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedLeaderStats.finished}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">I mål</div>
                                                </div>
                                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                                                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{selectedLeaderStats.trainingSessions}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Träningspass</div>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                                <div className="p-5 border-b dark:border-gray-700">
                                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Ledaröversikt per aktiv</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                        Resultat, prestation och live-status från gruppens medlemmar.
                                                    </p>
                                                </div>

                                                {selectedLeaderInsights.length === 0 ? (
                                                    <div className="p-8 text-sm text-gray-500 dark:text-gray-400">
                                                        Gruppen saknar aktiva medlemmar.
                                                    </div>
                                                ) : (
                                                    <div className="divide-y dark:divide-gray-700">
                                                        {selectedLeaderInsights.map((insight) => (
                                                            <div key={insight.memberId} className="p-4 md:p-5">
                                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                                    <div>
                                                                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">{insight.memberName}</h4>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                            Roll: {insight.role === 'club_admin' ? 'Klubbadmin' : insight.role === 'trainer' ? 'Tränare' : 'Medlem'}
                                                                        </p>
                                                                    </div>
                                                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${insight.live.inForest
                                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                        }`}>
                                                                        {insight.live.inForest ? 'Ute i skogen' : 'Ej aktiv'}
                                                                    </div>
                                                                </div>

                                                                <div className="grid md:grid-cols-3 gap-4 text-sm">
                                                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                                                                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Live-status</div>
                                                                        <p className="font-medium text-gray-800 dark:text-gray-100">{insight.live.label}</p>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            {insight.live.eventName || '—'} · {insight.live.className || '—'} · start {formatTime(insight.live.startTime)}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                                                                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Tävlingsprestation</div>
                                                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                                                            Starter {insight.results.starts} · I mål {insight.results.finished}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            OK {insight.results.ok} · MP {insight.results.mp} · DNF/DNS {insight.results.dnf}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                                                                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Träningsdata</div>
                                                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                                                            Pass {insight.training.sessions}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            Bästa {formatDuration(insight.training.bestSeconds)} · Snitt {formatDuration(insight.training.avgSeconds)} · Senast {formatTime(insight.training.latestAt)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && isClubAdmin && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Klubbinställningar
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Inställningar flyttade till <Link href="/admin" className="text-emerald-600 underline">Admin-panelen</Link>
                        </p>
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Bjud in Medlem
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    E-postadress
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="namn@example.com"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleInvite}
                                    disabled={!inviteEmail.includes('@')}
                                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    Skicka Inbjudan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Team Modal */}
            {showCreateTeam && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Skapa Lag
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Lagnamn
                                </label>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="T.ex. D16, Veteraner, Elit"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowCreateTeam(false)}
                                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleCreateTeam}
                                    disabled={!newTeamName.trim()}
                                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    Skapa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
