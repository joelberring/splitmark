'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { OrienteeringMapEngine } from '@/lib/maps/engine';
import type { GeoPoint } from '@/types/maps';

interface Runner {
    id: string;
    name: string;
    class: string;
    position: GeoPoint;
    lastUpdate: Date;
    status: 'running' | 'finished' | 'dnf';
}

export default function LiveTrackingPage() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const [mapEngine, setMapEngine] = useState<OrienteeringMapEngine | null>(null);
    const [runners, setRunners] = useState<Runner[]>([]);
    const [selectedRunner, setSelectedRunner] = useState<string | null>(null);
    const [following, setFollowing] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(false);

    useEffect(() => {
        if (!mapContainer.current) return;

        const engine = new OrienteeringMapEngine({
            container: mapContainer.current,
            center: [18.0686, 59.3293],
            zoom: 14,
        });

        setMapEngine(engine);

        // Mock runners
        const mockRunners: Runner[] = [
            { id: '1', name: 'Anna Svensson', class: 'D21', position: { lat: 59.330, lng: 18.070 }, lastUpdate: new Date(), status: 'running' },
            { id: '2', name: 'Erik Johansson', class: 'H21', position: { lat: 59.331, lng: 18.071 }, lastUpdate: new Date(), status: 'running' },
            { id: '3', name: 'Maria Lindberg', class: 'D35', position: { lat: 59.329, lng: 18.068 }, lastUpdate: new Date(), status: 'running' },
        ];

        setRunners(mockRunners);

        const interval = setInterval(() => {
            setRunners(prev =>
                prev.map(r => ({
                    ...r,
                    position: {
                        lat: r.position.lat + (Math.random() - 0.5) * 0.001,
                        lng: r.position.lng + (Math.random() - 0.5) * 0.001,
                    },
                    lastUpdate: new Date(),
                }))
            );
        }, 3000);

        return () => {
            clearInterval(interval);
            engine.destroy();
        };
    }, []);

    useEffect(() => {
        if (!mapEngine) return;
        runners.forEach(runner => {
            mapEngine.updateGPSPosition(runner.position);
        });

        if (following) {
            const runner = runners.find(r => r.id === following);
            if (runner) {
                mapEngine.getMap().flyTo({
                    center: [runner.position.lng, runner.position.lat],
                    zoom: 16,
                    duration: 1000,
                });
            }
        }
    }, [runners, mapEngine, following]);

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-slate-500 hover:text-emerald-400 transition-colors">
                        ←
                    </Link>
                    <h1 className="text-lg font-bold uppercase tracking-wider">Live Tracking</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-slate-400 uppercase tracking-wider">
                            {runners.filter(r => r.status === 'running').length} aktiva
                        </span>
                    </div>
                    <button
                        onClick={() => setShowControls(!showControls)}
                        className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        ⚙️
                    </button>
                </div>
            </header>

            <div className="flex-1 flex relative">
                {/* Map */}
                <div className="flex-1 relative">
                    <div ref={mapContainer} className="absolute inset-0" />
                </div>

                {/* Runner List Sidebar (mobile: bottom sheet) */}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 max-h-[40vh] overflow-y-auto">
                    <div className="p-3">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                            Löpare ({runners.length})
                        </h2>
                        <div className="space-y-2">
                            {runners.map(runner => (
                                <button
                                    key={runner.id}
                                    onClick={() => {
                                        setSelectedRunner(runner.id);
                                        setFollowing(following === runner.id ? null : runner.id);
                                    }}
                                    className={`w-full p-3 rounded-lg border-l-4 text-left transition-all ${selectedRunner === runner.id
                                        ? 'border-emerald-500 bg-slate-800'
                                        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">{runner.name}</div>
                                            <div className="text-xs text-slate-400">{runner.class}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {following === runner.id && (
                                                <span className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-full uppercase tracking-wider">
                                                    Följer
                                                </span>
                                            )}
                                            {runner.status === 'running' && (
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
