interface SkeletonProps {
    className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div className={`animate-pulse bg-gray-200/70 rounded-md ${className}`} />
    )
}

export function ProjectCardSkeleton() {
    return (
        <div className="surface p-5 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
            </div>
        </div>
    )
}

export function ContentItemSkeleton() {
    return (
        <div className="surface p-4 space-y-3">
            <div className="flex gap-3">
                <Skeleton className="h-5 w-5" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </div>
        </div>
    )
}

export function StatsCardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center space-y-2">
            <Skeleton className="h-10 w-16 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
        </div>
    )
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <div className="flex gap-4 p-4 border-b">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
            ))}
        </div>
    )
}
