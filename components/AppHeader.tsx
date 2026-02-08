'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthState } from '@/lib/auth/hooks';

export default function AppHeader() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const { user, loading } = useAuthState();

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isActive = (path: string) => pathname === path;

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-border ${isScrolled ? 'bg-background/80 backdrop-blur-md shadow-lg' : 'bg-background'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-white font-bold text-xl skew-x-[-10deg] shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all">
                            <span>S</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white group-hover:text-emerald-400 transition-colors uppercase">
                            Splitmark
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <NavLink href="/feed" label="Flöde" active={isActive('/feed')} />
                        <NavLink href="/events" label="Tävlingar" active={isActive('/events')} />
                        <NavLink href="/spectate" label="Live" active={isActive('/spectate')} />
                        <NavLink href="/discover" label="Utforska" active={isActive('/discover')} />
                        {user && (user.role === 'admin' || user.role === 'organizer') && (
                            <NavLink href="/admin" label="Admin" active={isActive('/admin')} />
                        )}
                        {user && (
                            <NavLink
                                href={user.clubId ? `/club/${user.clubId}` : '/join-club'}
                                label="Klubb"
                                active={pathname?.startsWith('/club')}
                            />
                        )}
                    </nav>

                    {/* Auth / Action */}
                    <div className="hidden md:flex items-center gap-4">
                        {!loading && (
                            user ? (
                                <Link
                                    href="/profile"
                                    className="w-10 h-10 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center overflow-hidden hover:scale-105 hover:border-emerald-400 transition-all"
                                >
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-emerald-500">{user.displayName?.[0] || 'U'}</span>
                                    )}
                                </Link>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded uppercase tracking-wide transition-all shadow-lg shadow-emerald-900/20"
                                >
                                    Logga in
                                </Link>
                            )
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-slate-300 hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? (
                            <span className="text-2xl">✕</span>
                        ) : (
                            <span className="text-2xl">☰</span>
                        )}
                    </button>
                </div>
            </header>

        </>
    );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`text-sm font-bold uppercase tracking-wider transition-colors ${active ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
        >
            {label}
        </Link>
    );
}

function MobileNavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center w-full h-full ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className="text-xl mb-1 opacity-80">{icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </Link>
    );
}
