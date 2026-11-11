import { Link } from '@tanstack/react-router'
import { ArrowLeft, Layers, PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProjectType, PublishStatus } from '../lib/api'

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */
export const STATUS_META: Record<PublishStatus, { label: string; badge: string; dot: string }> = {
    draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
    pending: { label: 'Queued', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    published: { label: 'Published', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    failed: { label: 'Failed', badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
}

export function StatusBadge({ status }: { status: PublishStatus }) {
    const meta = STATUS_META[status] ?? STATUS_META.pending
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    )
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */
interface PageHeaderProps {
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    back?: { to: string; label: string; params?: Record<string, string> }
    leading?: ReactNode
}

export function PageHeader({ title, description, actions, back, leading }: PageHeaderProps) {
    return (
        <div className="mb-8">
            {back && (
                <Link
                    to={back.to as any}
                    params={back.params as any}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {back.label}
                </Link>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    {leading}
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
                        {description && <div className="mt-1.5 text-sm text-gray-500 sm:text-base">{description}</div>}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */
const TONES = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
} as const

interface StatTileProps {
    label: string
    value: ReactNode
    icon: ReactNode
    tone?: keyof typeof TONES
    footer?: ReactNode
    onClick?: () => void
    active?: boolean
}

export function StatTile({ label, value, icon, tone = 'blue', footer, onClick, active }: StatTileProps) {
    const Comp = onClick ? 'button' : 'div'
    return (
        <Comp
            onClick={onClick}
            className={`surface w-full p-5 text-left transition ${onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : ''} ${active ? 'border-blue-500 ring-2 ring-blue-500/15' : ''}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]} [&>svg]:h-4 [&>svg]:w-4`}>
                    {icon}
                </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{value}</p>
            {footer && <div className="mt-2 text-xs text-gray-500">{footer}</div>}
        </Comp>
    )
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
    if (totalPages <= 1) return null
    return (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:px-5">
            <p className="text-sm text-gray-500">
                Page <span className="font-medium text-gray-900">{page}</span> of{' '}
                <span className="font-medium text-gray-900">{totalPages}</span>
            </p>
            <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                    Previous
                </button>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
                    Next
                </button>
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Floating bulk action bar                                            */
/* ------------------------------------------------------------------ */
export function BulkActionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
    if (count === 0) return null
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 p-2 pl-4 text-white shadow-2xl shadow-gray-900/20">
                <span className="mr-1 text-sm font-medium tabular-nums">
                    {count} selected
                </span>
                <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
                {children}
                <button className="btn btn-sm text-gray-300 hover:bg-white/10 hover:text-white" onClick={onClear}>
                    Clear
                </button>
            </div>
        </div>
    )
}

export function formatNumber(value: number | undefined) {
    return (value ?? 0).toLocaleString('en-US')
}

/* ------------------------------------------------------------------ */
/* Project type badge                                                  */
/* ------------------------------------------------------------------ */
export function ProjectTypeBadge({ type }: { type?: ProjectType }) {
    const manual = type === 'manual'
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${manual ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}
        >
            {manual ? <PenLine className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
            {manual ? 'Manual' : 'Mass'}
        </span>
    )
}
