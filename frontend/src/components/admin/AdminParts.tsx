import type { ReactNode } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Pagination } from '../ui'

/** Error text from an axios error (server message when there is one). */
export function apiError(error: any, fallback: string): string {
    const message = error?.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : message || fallback
}

export function AdminToolbar({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:p-5">{children}</div>
}

export function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="field pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    )
}

export function ActiveBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-200'}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {active ? activeLabel : inactiveLabel}
        </span>
    )
}

interface AdminTableProps {
    isLoading: boolean
    isEmpty: boolean
    emptyText: string
    head: ReactNode
    children: ReactNode
    page: number
    totalPages: number
    onPage: (p: number) => void
}

/** Table wrapper: scrolls horizontally inside the card on small screens instead of widening the page. */
export function AdminTable({ isLoading, isEmpty, emptyText, head, children, page, totalPages, onPage }: AdminTableProps) {
    if (isLoading) {
        return (
            <div className="flex justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
        )
    }
    if (isEmpty) {
        return <p className="px-4 py-14 text-center text-sm text-gray-500">{emptyText}</p>
    }
    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-medium tracking-wide whitespace-nowrap text-gray-500 uppercase">
                        {head}
                    </thead>
                    <tbody className="divide-y divide-gray-100">{children}</tbody>
                </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={onPage} />
        </>
    )
}
