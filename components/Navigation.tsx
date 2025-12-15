'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthState } from '@/lib/auth/hooks';

export default function Navigation() {
    const pathname = usePathname();
    const { isAuthenticated, user } = useAuthState();

    const navItems = [
        { href: '/', label: 'Hem', icon: '🏠' },
        { href: '/events', label: 'Tävlingar', icon: '📅' },
        { href: '/tracks', label: 'Spår', icon: '📍', auth: true },
        { href: '/training', label: 'Träning', icon: '📊', auth: true },
        { href: '/compare', label: 'Jämför', icon: '⚖️' },
    ];

    const adminItems = [
        { href: '/admin', label: 'Admin', icon: '⚙️' },
        { href: '/admin/events/create', label: 'Ny tävling', icon: '➕' },
    ];

    const isAdmin = user?.role === 'admin' || user?.role === 'organizer';

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 z-50 md:top-0 md:bottom-auto md:border-b md:border-t-0">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo - Desktop */}
                    <Link
                        href="/"
                        className="hidden md:flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400"
                    >
                        <span className="text-2xl">🧭</span>
                        <span>Splitmark</span>
                    </Link>

                    {/* Main Nav */}
                    <div className="flex items-center gap-1 md:gap-2 flex-1 md:flex-none justify-around md:justify-center">
                        {navItems.map((item) => {
                            if (item.auth && !isAuthenticated) return null;

                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex flex-col md:flex-row items-center gap-1 px-3 py-2 rounded-lg transition-colors ${isActive
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <span className="text-xl md:text-lg">{item.icon}</span>
                                    <span className="text-xs md:text-sm font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Admin & Auth - Desktop */}
                    <div className="hidden md:flex items-center gap-2">
                        {isAdmin && adminItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === item.href
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}

                        {isAuthenticated ? (
                            <Link
                                href="/profile"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/profile'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                    {user?.displayName?.[0] || '?'}
                                </div>
                                <span className="hidden lg:inline">{user?.displayName?.split(' ')[0]}</span>
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                            >
                                Logga in
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
