'use client';

/**
 * Loading skeleton for EventCard
 */
export function EventCardSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'featured' }) {
    const isFeatured = variant === 'featured';

    return (
        <article
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden animate-pulse ${isFeatured ? 'md:col-span-2' : ''
                }`}
        >
            {/* Hero placeholder */}
            <div className={`bg-gray-200 dark:bg-gray-700 ${isFeatured ? 'aspect-[21/9]' : 'aspect-[4/3]'}`} />

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Title */}
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />

                {/* Location & Date */}
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>

                {/* Stats chips */}
                <div className="flex gap-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                    <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
            </div>
        </article>
    );
}

/**
 * Grid of loading skeletons
 */
export function EventGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Featured skeleton first */}
            <EventCardSkeleton variant="featured" />

            {/* Regular skeletons */}
            {Array.from({ length: count - 1 }).map((_, i) => (
                <EventCardSkeleton key={i} variant="grid" />
            ))}
        </div>
    );
}

/**
 * Filter chip skeleton
 */
export function FilterChipSkeleton() {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {Array.from({ length: 7 }).map((_, i) => (
                <div
                    key={i}
                    className="h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
                    style={{ width: `${60 + Math.random() * 40}px` }}
                />
            ))}
        </div>
    );
}
