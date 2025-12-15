'use client';

import { useEffect, useState } from 'react';
import type { VirtualPunch, VirtualControl } from '@/types/virtual-controls';

interface VirtualPunchNotificationProps {
    punch: VirtualPunch | null;
    control: VirtualControl | null;
    onDismiss?: () => void;
}

/**
 * Full-screen overlay notification when a virtual control is punched
 */
export default function VirtualPunchNotification({
    punch,
    control,
    onDismiss,
}: VirtualPunchNotificationProps) {
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (punch && control) {
            setVisible(true);
            setAnimating(true);

            // Auto-dismiss after 2 seconds
            const timer = setTimeout(() => {
                setAnimating(false);
                setTimeout(() => {
                    setVisible(false);
                    onDismiss?.();
                }, 300);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [punch, control, onDismiss]);

    if (!visible || !punch || !control) return null;

    const isFinish = control.type === 'finish';
    const isStart = control.type === 'start';

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${animating ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 ${isFinish
                        ? 'bg-gradient-to-br from-yellow-500/80 to-orange-600/80'
                        : 'bg-gradient-to-br from-emerald-500/80 to-teal-600/80'
                    }`}
            />

            {/* Content */}
            <div
                className={`relative text-center text-white transform transition-transform duration-300 ${animating ? 'scale-100' : 'scale-50'
                    }`}
            >
                {/* Large control code */}
                <div
                    className={`text-9xl font-black mb-4 drop-shadow-lg ${animating ? 'animate-bounce' : ''
                        }`}
                >
                    {isStart ? '▶' : isFinish ? '🏁' : control.code}
                </div>

                {/* Status text */}
                <div className="text-3xl font-bold mb-2 uppercase tracking-wider">
                    {isStart ? 'Start!' : isFinish ? 'Mål!' : 'Stämplat!'}
                </div>

                {/* Control info */}
                {control.description && (
                    <div className="text-xl opacity-80">{control.description}</div>
                )}

                {/* Distance info */}
                <div className="mt-4 text-lg opacity-70">
                    {punch.distanceFromControl.toFixed(0)}m från kontroll
                </div>

                {/* Checkmark animation */}
                <div className="mt-6">
                    <svg
                        className="w-20 h-20 mx-auto text-white drop-shadow-lg animate-ping"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact punch badge for the punch list
 */
export function PunchBadge({
    punch,
    control,
    index,
}: {
    punch: VirtualPunch;
    control?: VirtualControl;
    index: number;
}) {
    const isFinish = control?.type === 'finish';
    const isStart = control?.type === 'start';

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    return (
        <div
            className={`flex items-center gap-3 px-4 py-2 rounded-xl ${isFinish
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                }`}
        >
            {/* Order */}
            <span className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center text-xs font-bold">
                {isStart ? 'S' : index}
            </span>

            {/* Code */}
            <span className="text-lg font-bold">
                {isStart ? 'Start' : isFinish ? 'Mål' : punch.controlCode}
            </span>

            {/* Time */}
            <span className="ml-auto text-sm opacity-70">
                {formatTime(punch.timestamp)}
            </span>

            {/* Accuracy indicator */}
            {punch.accuracy > 25 && (
                <span title={`GPS: ±${punch.accuracy.toFixed(0)}m`} className="text-xs">
                    ⚠️
                </span>
            )}
        </div>
    );
}
