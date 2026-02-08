import { describe, expect, it, beforeEach } from '@jest/globals';
import {
    getTrainingSessions,
    saveTrainingSession,
    subscribeToTrainingSessions,
} from '@/lib/firestore/training-sessions';

function buildSession(id: string, courseId: string, elapsedSeconds: number) {
    return {
        id,
        eventId: 'event-1',
        courseId,
        courseName: `Bana ${courseId}`,
        userId: 'user-1',
        userName: 'Testlöpare',
        finishedAt: new Date(2026, 0, 1, 10, 0, elapsedSeconds).toISOString(),
        elapsedSeconds,
        punchedCount: 10,
        expectedCount: 10,
        result: 'ok' as const,
        missingControls: [],
        createdAt: new Date(2026, 0, 1, 10, 0, elapsedSeconds).toISOString(),
        updatedAt: new Date(2026, 0, 1, 10, 0, elapsedSeconds).toISOString(),
    };
}

describe('training sessions service (local mode)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('saves and reads training sessions in descending finish order', async () => {
        await saveTrainingSession('event-1', buildSession('s1', 'A', 120));
        await saveTrainingSession('event-1', buildSession('s2', 'A', 90));

        const sessions = await getTrainingSessions('event-1');

        expect(sessions).toHaveLength(2);
        expect(sessions[0].id).toBe('s1');
        expect(sessions[1].id).toBe('s2');
    });

    it('applies course filter in subscriptions', async () => {
        await saveTrainingSession('event-1', buildSession('s1', 'A', 100));
        await saveTrainingSession('event-1', buildSession('s2', 'B', 110));

        const snapshots: string[][] = [];
        const unsubscribe = subscribeToTrainingSessions(
            'event-1',
            (sessions) => snapshots.push(sessions.map((session) => session.id)),
            { courseId: 'A' }
        );

        await saveTrainingSession('event-1', buildSession('s3', 'A', 95));

        const latest = snapshots[snapshots.length - 1] || [];
        expect(latest).toContain('s3');
        expect(latest).not.toContain('s2');

        unsubscribe?.();
    });
});
