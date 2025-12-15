'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TrainingRunner from '@/components/Training/TrainingRunner';
import type { VirtualControl } from '@/types/virtual-controls';
import type { VirtualTrainingSession } from '@/types/virtual-controls';

// Demo training event with controls
const DEMO_TRAINING = {
    id: 'demo-training-1',
    name: 'Onsdagsträning Lunsen',
    controls: [
        { id: 'start', code: 'S', lat: 59.8095, lng: 17.6305, radius: 20, order: 0, type: 'start' as const },
        { id: 'ctrl-1', code: '31', lat: 59.8102, lng: 17.6318, radius: 20, order: 1, type: 'control' as const, description: 'Sten, sydöst' },
        { id: 'ctrl-2', code: '32', lat: 59.8115, lng: 17.6342, radius: 20, order: 2, type: 'control' as const, description: 'Stig-korsning' },
        { id: 'ctrl-3', code: '33', lat: 59.8098, lng: 17.6365, radius: 20, order: 3, type: 'control' as const, description: 'Grop' },
        { id: 'ctrl-4', code: '34', lat: 59.8085, lng: 17.6338, radius: 20, order: 4, type: 'control' as const, description: 'Bryn, nordväst' },
        { id: 'finish', code: 'M', lat: 59.8092, lng: 17.6310, radius: 25, order: 5, type: 'finish' as const },
    ] as VirtualControl[],
};

export default function TrainingRunPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [training, setTraining] = useState<typeof DEMO_TRAINING | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // In production, fetch event data from Firestore
        // For now, use demo data
        const loadTraining = async () => {
            try {
                setLoading(true);
                // Simulate API call
                await new Promise((resolve) => setTimeout(resolve, 500));

                if (eventId === 'demo' || eventId === 'demo-training-1') {
                    setTraining(DEMO_TRAINING);
                } else {
                    // In production: fetch from Firestore
                    // For now, show demo
                    setTraining({
                        ...DEMO_TRAINING,
                        id: eventId,
                        name: `Träning ${eventId}`,
                    });
                }
            } catch (err) {
                setError('Kunde inte ladda träningen');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadTraining();
    }, [eventId]);

    const handleSessionComplete = (session: VirtualTrainingSession) => {
        console.log('Session complete:', session);
        // In production: save session to Firestore
        // For now, just log it
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="text-4xl mb-4 animate-bounce">🏃</div>
                    <div className="text-lg">Laddar träning...</div>
                </div>
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white p-8">
                    <div className="text-4xl mb-4">❌</div>
                    <div className="text-lg mb-4">{error || 'Träningen hittades inte'}</div>
                    <a
                        href="/training"
                        className="px-6 py-3 bg-gray-700 rounded-xl font-semibold hover:bg-gray-600"
                    >
                        ← Tillbaka
                    </a>
                </div>
            </div>
        );
    }

    return (
        <TrainingRunner
            eventId={training.id}
            eventName={training.name}
            controls={training.controls}
            onSessionComplete={handleSessionComplete}
        />
    );
}
