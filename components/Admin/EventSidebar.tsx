'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface EventSidebarProps {
    eventId: string;
    eventName: string;
}

const navItems = [
    { href: '', label: 'Översikt', icon: '📊' },
    { href: '/entries', label: 'Anmälningar', icon: '📝' },
    { href: '/courses', label: 'Banor', icon: '🗺️' },
    { href: '/lottning', label: 'Lottning', icon: '🎲' },
    { href: '/timing', label: 'Tidtagning', icon: '⏱️' },
    { href: '/results', label: 'Resultat', icon: '🏆' },
    { href: '/splits', label: 'Sträcktider', icon: '📊' },
    { href: '/missing', label: 'Kvar i skogen', icon: '🌲' },
    { href: '/ekonomi', label: 'Ekonomi', icon: '💰' },
    { href: '/teams', label: 'Lag & Stafett', icon: '👥' },
];

export default function EventSidebar({ eventId, eventName }: EventSidebarProps) {
    const pathname = usePathname();
    const basePath = `/admin/events/${eventId}`;

    return (
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
            {/* Event Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                <Link href="/admin" className="text-xs text-white/80 hover:text-white">
                    ← Alla tävlingar
                </Link>
                <h2 className="font-bold text-lg mt-1 truncate" title={eventName}>
                    {eventName}
                </h2>
            </div>

            {/* Navigation */}
            <nav className="p-2">
                {navItems.map((item) => {
                    const fullPath = `${basePath}${item.href}`;
                    const isActive = pathname === fullPath ||
                        (item.href === '' && pathname === basePath);

                    return (
                        <Link
                            key={item.href}
                            href={fullPath}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${isActive
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Quick Actions */}
            <div className="p-4 border-t dark:border-gray-700">
                <Link
                    href={`/speaker/${eventId}`}
                    target="_blank"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                    <span>🎙️</span> Öppna speakervy
                </Link>
                <Link
                    href={`/race/${eventId}`}
                    target="_blank"
                    className="flex items-center gap-2 px-4 py-2 mt-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                    <span>📱</span> Deltagarvy
                </Link>
            </div>
        </aside>
    );
}
