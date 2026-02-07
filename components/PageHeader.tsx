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
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-4 sticky top-0 z-40 shadow-xl shadow-black/20">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Back Link or Logo */}
                {backHref ? (
                    <Link
                        href={backHref}
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-emerald-400 mb-4 inline-flex items-center gap-2 transition-all group"
                    >
                        <span className="bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center group-hover:bg-emerald-900/30 group-hover:-translate-x-0.5 transition-all text-sm">
                            ←
                        </span>
                        {backLabel}
                    </Link>
                ) : showLogo ? (
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-white font-extrabold text-xl skew-x-[-10deg] shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            <span>S</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white uppercase">
                            Splitmark
                        </span>
                    </div>
                ) : null}

                {/* Title Row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {rightAction && (
                        <div className="flex-shrink-0">
                            {rightAction}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
