'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthState } from '@/lib/auth/hooks';

export default function BottomNavigation() {
    const pathname = usePathname();
    const { user, loading } = useAuthState();

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname?.startsWith(path);
    };

    const navItems = [
        { href: '/', label: 'Hem', icon: HomeIcon },
        { href: '/feed', label: 'Flöde', icon: FeedIcon },
        { href: '/spectate', label: 'Live', icon: LiveIcon },
        { href: '/events', label: 'Tävlingar', icon: CalendarIcon },
        { href: '/discover', label: 'Utforska', icon: DiscoverIcon },
        {
            href: user ? '/profile' : '/login',
            label: user ? 'Profil' : 'Logga in',
            icon: user ? ProfileIcon : LoginIcon
        },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pb-safe z-50 md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${active ? 'text-emerald-400' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            <Icon active={active} />
                            <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function HomeIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}

function FeedIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
    );
}

function LiveIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="2" fill={active ? 'currentColor' : 'none'} />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
    );
}

function CalendarIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}

function ProfileIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function DiscoverIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}

function LoginIcon({ active }: { active: boolean }) {
    return (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
    );
}

