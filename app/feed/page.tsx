'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import BottomNavigation from '@/components/BottomNavigation';
import ActivityFeed, { Activity, generateDemoActivities } from '@/components/Feed/ActivityFeed';
import { useAuthState } from '@/lib/auth/hooks';

interface FeedEvent {
    id: string;
    name: string;
    date: string;
    location: string;
    imageUrl?: string;
    type: 'new_event' | 'results_published' | 'registration_open';
}

const DEMO_FEED_EVENTS: FeedEvent[] = [
    {
        id: 'ans-2025',
        name: 'Älvsjö Night Sprint',
        date: '2025-12-02',
        location: 'Älvsjö, Stockholm',
        type: 'results_published',
    },
    {
        id: 'demo-event-1',
        name: 'Vårsprånget 2025',
        date: '2025-03-15',
        location: 'Lunsen, Uppsala',
        type: 'registration_open',
    },
];

export default function FeedPage() {
    const { user } = useAuthState();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [filter, setFilter] = useState<'all' | 'friends' | 'mine'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load demo activities + generate from test event
        const loadActivities = async () => {
            try {
                // Start with demo activities
                const demoActivities = generateDemoActivities();
                
                // Fetch test event results and create activity entries
                const res = await fetch('/api/test-event');
                const data = await res.json();
                
                if (data.success && data.data.resultat) {
                    // Parse a few results to show as activities
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(data.data.resultat, 'text/xml');
                    const results = doc.querySelectorAll('PersonResult');
                    
                    const eventActivities: Activity[] = [];
                    const topResults = Array.from(results).slice(0, 5);
                    
                    topResults.forEach((result, idx) => {
                        const personName = result.querySelector('Person Name Given')?.textContent + ' ' + 
                                         result.querySelector('Person Name Family')?.textContent;
                        const org = result.querySelector('Organisation Name')?.textContent || 'Okänd klubb';
                        const time = result.querySelector('Result Time')?.textContent;
                        const timeSeconds = time ? parseTimeToSeconds(time) : 0;
                        const className = result.closest('ClassResult')?.querySelector('Class Name')?.textContent || '';
                        
                        eventActivities.push({
                            id: `ans-activity-${idx}`,
                            userId: `user-ans-${idx}`,
                            userName: personName?.trim() || 'Okänd',
                            eventName: 'Älvsjö Night Sprint',
                            eventId: 'ans-2025',
                            courseName: className,
                            date: new Date('2025-12-02'),
                            duration: timeSeconds,
                            distance: 3200 + Math.random() * 1000,
                            resultStatus: 'ok',
                            position: idx + 1,
                            totalInClass: 20,
                            className,
                            kudos: Math.floor(Math.random() * 20),
                            comments: Math.floor(Math.random() * 5),
                        });
                    });
                    
                    setActivities([...eventActivities, ...demoActivities]);
                } else {
                    setActivities(demoActivities);
                }
            } catch (error) {
                console.error('Failed to load activities:', error);
                setActivities(generateDemoActivities());
            }
            setLoading(false);
        };
        
        loadActivities();
    }, []);

    const handleKudos = (activityId: string) => {
        setActivities(prev => prev.map(a => 
            a.id === activityId 
                ? { ...a, kudos: a.hasKudoed ? a.kudos - 1 : a.kudos + 1, hasKudoed: !a.hasKudoed }
                : a
        ));
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white pb-20">
            <PageHeader title="Flöde" showLogo />

            {/* New Events Section */}
            <section className="px-4 py-4 border-b border-slate-800">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    Senaste nyheter
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {DEMO_FEED_EVENTS.map(event => (
                        <Link
                            key={event.id}
                            href={event.id === 'ans-2025' ? '/test-event' : `/events/${event.id}`}
                            className="flex-shrink-0 w-64 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-all group"
                        >
                            <div className="h-24 bg-gradient-to-br from-emerald-900/50 to-slate-900 flex items-center justify-center">
                                <span className="text-4xl opacity-50">
                                    {event.type === 'results_published' ? '🏆' : '📅'}
                                </span>
                            </div>
                            <div className="p-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 ${
                                    event.type === 'results_published' 
                                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                                        : 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
                                }`}>
                                    {event.type === 'results_published' ? 'Resultat' : 'Anmälan öppen'}
                                </span>
                                <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                    {event.name}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    📍 {event.location}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Activity Feed */}
            <main className="flex-1 py-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 px-4">
                    Aktivitet från vänner och klubbmedlemmar
                </h2>
                
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                    </div>
                ) : (
                    <ActivityFeed
                        activities={activities}
                        filter={filter}
                        onFilterChange={setFilter}
                        onKudos={handleKudos}
                        currentUserId={user?.uid}
                    />
                )}
            </main>

            <BottomNavigation />
        </div>
    );
}

function parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parseInt(timeStr) || 0;
}
