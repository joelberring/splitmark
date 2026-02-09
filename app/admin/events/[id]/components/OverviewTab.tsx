'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUserWithRoles } from '@/lib/auth/usePermissions';
import { isEventAdmin } from '@/lib/auth/permissions';
import {
    assignEventAdminRole,
    getClubAdminUserIds,
    getKnownRoleUsers,
    persistEventAdminIds,
    removeEventAdminRole,
    resolveEventAdminIds,
    resolveUserIdInput,
} from '@/lib/auth/event-admins';
import { EventData, saveEvent } from './shared';

interface OverviewTabProps {
    event: EventData;
    setEvent?: (event: EventData) => void;
}

export default function OverviewTab({ event, setEvent }: OverviewTabProps) {
    const { user } = useUserWithRoles();
    const [adminInput, setAdminInput] = useState('');
    const [adminError, setAdminError] = useState('');
    const [adminSuccess, setAdminSuccess] = useState('');

    const adminIds = useMemo(
        () => resolveEventAdminIds({
            id: event.id,
            clubId: event.clubId,
            createdBy: event.createdBy,
            eventAdminIds: event.eventAdminIds,
        }),
        [event.id, event.clubId, event.createdBy, event.eventAdminIds]
    );
    const clubAdminIds = useMemo(
        () => new Set(getClubAdminUserIds(event.clubId)),
        [event.clubId, event.eventAdminIds]
    );
    const adminIdsKey = useMemo(() => adminIds.join('|'), [adminIds]);
    const knownUsers = useMemo(() => getKnownRoleUsers(), [adminIdsKey]);
    const knownUsersById = useMemo(
        () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
        [knownUsers]
    );

    const canManageAdmins = !!(user && isEventAdmin(user, event.id, event.clubId, event.createdBy));

    const persistAdmins = (nextAdminIds: string[]) => {
        const dedupedAdminIds = Array.from(new Set(nextAdminIds.map((id) => id.trim()).filter(Boolean)));
        const updatedEvent = { ...event, eventAdminIds: dedupedAdminIds };

        setEvent?.(updatedEvent);
        persistEventAdminIds(event.id, dedupedAdminIds);
        saveEvent(updatedEvent);
    };

    const resetMessages = () => {
        setAdminError('');
        setAdminSuccess('');
    };

    const handleAddAdmin = () => {
        resetMessages();

        if (!canManageAdmins) {
            setAdminError('Du saknar behörighet att lägga till tävlingsadmins.');
            return;
        }

        const targetUserId = resolveUserIdInput(adminInput);
        if (!targetUserId) {
            setAdminError('Ange ett giltigt användar-ID eller en känd e-post.');
            return;
        }

        if (adminIds.includes(targetUserId)) {
            setAdminError('Användaren är redan tävlingsadmin.');
            return;
        }

        const assignedBy = user?.id || 'system';
        const assigned = assignEventAdminRole(targetUserId, event.id, assignedBy);
        if (!assigned) {
            setAdminError('Kunde inte lägga till tävlingsadmin.');
            return;
        }

        persistAdmins([...adminIds, targetUserId]);
        setAdminInput('');
        setAdminSuccess(`Lade till ${targetUserId} som tävlingsadmin.`);
    };

    const handleRemoveAdmin = (targetUserId: string) => {
        resetMessages();

        if (!canManageAdmins) {
            setAdminError('Du saknar behörighet att ta bort tävlingsadmins.');
            return;
        }

        if (event.createdBy && targetUserId === event.createdBy) {
            setAdminError('Skaparen av tävlingen kan inte tas bort som admin.');
            return;
        }

        if (clubAdminIds.has(targetUserId)) {
            setAdminError('Klubbadmins i arrangerande klubb är automatiskt tävlingsadmins.');
            return;
        }

        const removed = removeEventAdminRole(targetUserId, event.id);
        if (!removed) {
            setAdminError('Kunde inte ta bort tävlingsadmin.');
            return;
        }

        persistAdmins(adminIds.filter((adminId) => adminId !== targetUserId));
        setAdminSuccess(`Tog bort ${targetUserId} som tävlingsadmin.`);
    };

    const getUserLabel = (userId: string) => {
        const knownUser = knownUsersById.get(userId);
        return knownUser?.displayName || knownUser?.email || userId;
    };

    return (
        <div className="grid md:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-emerald-400">{event.classes.length}</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">Klasser</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-blue-400">{event.entries.length}</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">Anmälda</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-4xl font-bold text-purple-400">
                    {event.entries.filter(e => e.status === 'finished' || e.resultStatus === 'ok').length}
                </div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-1">I mål</div>
            </div>

            {/* Quick Actions */}
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-4">Snabbåtgärder</h3>
                <div className="grid md:grid-cols-5 gap-3">
                    <Link href={`/admin/events/${event.id}/import`} className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg hover:bg-blue-900/30 transition-colors text-center group">
                        <span className="text-2xl">📥</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-blue-400">Importera Eventor</div>
                    </Link>
                    <button
                        onClick={() => window.location.hash = '#classes'}
                        className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-lg hover:bg-emerald-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">➕</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-emerald-400">Lägg till klasser</div>
                    </button>
                    <button
                        onClick={() => window.location.hash = '#map'}
                        className="p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg hover:bg-purple-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">🗺️</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-purple-400">Definiera banor</div>
                    </button>
                    <button
                        onClick={() => alert('Utskrift kommer snart!')}
                        className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-center group"
                    >
                        <span className="text-2xl">🖨️</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-slate-300">Skriv ut listor</div>
                    </button>
                    <button
                        onClick={() => alert('Ekonomifunktioner kommer snart!')}
                        className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg hover:bg-amber-900/30 transition-colors text-center group"
                    >
                        <span className="text-2xl">💰</span>
                        <div className="font-bold text-white text-xs uppercase tracking-wide mt-2 group-hover:text-amber-400">Ekonomi</div>
                    </button>
                </div>
            </div>

            <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-4">Tävlingsadmins</h3>

                <div className="space-y-3 mb-4">
                    {adminIds.length === 0 && (
                        <p className="text-sm text-slate-500">Inga admins hittades ännu.</p>
                    )}

                    {adminIds.map((adminId) => {
                        const isCreator = !!event.createdBy && adminId === event.createdBy;
                        const isClubAdmin = clubAdminIds.has(adminId);
                        const isRemovable = canManageAdmins && !isCreator && !isClubAdmin;

                        return (
                            <div key={adminId} className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">{getUserLabel(adminId)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {adminId}
                                        {isCreator && ' · Skapare'}
                                        {!isCreator && isClubAdmin && ' · Klubbadmin (auto)'}
                                        {!isCreator && !isClubAdmin && ' · Manuellt tillagd'}
                                    </p>
                                </div>

                                {isRemovable && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAdmin(adminId)}
                                        className="px-3 py-2 bg-red-900/30 border border-red-800/50 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-900/50 transition-colors"
                                    >
                                        Ta bort
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="grid md:grid-cols-[1fr_auto] gap-3">
                    <input
                        type="text"
                        value={adminInput}
                        onChange={(eventValue) => setAdminInput(eventValue.target.value)}
                        placeholder="Användar-ID eller e-post"
                        list={`event-admin-users-${event.id}`}
                        disabled={!canManageAdmins}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 disabled:opacity-50"
                    />
                    <datalist id={`event-admin-users-${event.id}`}>
                        {knownUsers.map((knownUser) => (
                            <option
                                key={knownUser.id}
                                value={knownUser.email || knownUser.id}
                                label={`${knownUser.displayName || knownUser.id} (${knownUser.id})`}
                            />
                        ))}
                    </datalist>
                    <button
                        type="button"
                        onClick={handleAddAdmin}
                        disabled={!canManageAdmins || !adminInput.trim()}
                        className="px-4 py-3 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    >
                        Lägg till admin
                    </button>
                </div>

                {!canManageAdmins && (
                    <p className="text-[10px] text-slate-500 mt-3 uppercase tracking-widest">
                        Du måste vara tävlingsadmin, klubbadmin i arrangörsklubben eller superadmin för att ändra admins.
                    </p>
                )}
                {adminError && <p className="text-xs text-red-400 mt-3">{adminError}</p>}
                {adminSuccess && <p className="text-xs text-emerald-400 mt-3">{adminSuccess}</p>}
            </div>
        </div>
    );
}
