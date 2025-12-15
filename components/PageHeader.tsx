'use client';

import Link from 'next/link';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    backHref?: string;
    backLabel?: string;
    rightAction?: React.ReactNode;
    showLogo?: boolean;
}

export default function PageHeader({
    title,
    subtitle,
    backHref,
    backLabel = 'Tillbaka',
    rightAction,
    showLogo = false,
}: PageHeaderProps) {
    return (
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto">
                {/* Back Link or Logo */}
                {backHref ? (
                    <Link
                        href={backHref}
                        className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 mb-3 inline-flex items-center gap-2 transition-colors group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        {backLabel}
                    </Link>
                ) : showLogo ? (
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" />
                            </svg>
                        </div>
                        <span className="text-lg font-bold text-white">Splitmark</span>
                    </div>
                ) : null}

                {/* Title Row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
                        )}
                    </div>
                    {rightAction && <div>{rightAction}</div>}
                </div>
            </div>
        </header>
    );
}
