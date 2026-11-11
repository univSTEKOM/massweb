import { Link } from '@tanstack/react-router'
import { Clock, FileEdit, FolderOpen, Pencil, Send, Trash2 } from 'lucide-react'
import type { GeneratedContent } from '../lib/api'
import { useContentActions } from '../lib/content-actions'
import { BulkActionBar, StatusBadge } from './ui'

interface ContentTableProps {
    contents: GeneratedContent[]
    selected: Set<string>
    onToggle: (id: string) => void
    onToggleAll: (ids: string[], select: boolean) => void
    projectNames?: Record<string, string>
}

/** Floating bar with mass actions for the current selection. */
export function ContentBulkBar({ selected, onClear }: { selected: Set<string>; onClear: () => void }) {
    const { setStatus, remove, isBusy } = useContentActions({ onDone: onClear })
    const ids = Array.from(selected)
    const n = ids.length

    return (
        <BulkActionBar count={n} onClear={onClear}>
            <button
                className="btn btn-sm bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={isBusy}
                onClick={() => {
                    if (confirm(`Publish ${n} article(s) now? They go live immediately, outside the auto-publish queue.`)) {
                        setStatus.mutate({ ids, status: 'published' })
                    }
                }}
            >
                <Send /> Publish now
            </button>
            <button className="btn btn-sm text-white hover:bg-white/10" disabled={isBusy} onClick={() => setStatus.mutate({ ids, status: 'draft' })}>
                <FileEdit /> Move to draft
            </button>
            <button className="btn btn-sm text-white hover:bg-white/10" disabled={isBusy} onClick={() => setStatus.mutate({ ids, status: 'pending' })}>
                <Clock /> Queue
            </button>
            <button
                className="btn btn-sm text-red-300 hover:bg-red-500/15 hover:text-red-200"
                disabled={isBusy}
                onClick={() => {
                    if (confirm(`Delete ${n} article(s)? This cannot be undone.`)) remove.mutate(ids)
                }}
            >
                <Trash2 /> Delete
            </button>
        </BulkActionBar>
    )
}

function formatDate(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ContentTable({ contents, selected, onToggle, onToggleAll, projectNames }: ContentTableProps) {
    const { setStatus, remove, isBusy } = useContentActions()
    const ids = contents.map((c) => c.id)
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
    const someSelected = !allSelected && ids.some((id) => selected.has(id))

    const quick = (id: string, status: 'published' | 'draft' | 'pending') => setStatus.mutate({ ids: [id], status })

    return (
        <div>
            {/* Header row */}
            <div className="hidden grid-cols-[2rem_minmax(0,1fr)_7.5rem_7rem_14rem] items-center gap-4 border-b border-gray-100 bg-gray-50/70 px-5 py-2.5 text-xs font-medium tracking-wide text-gray-500 uppercase md:grid">
                <input
                    type="checkbox"
                    className="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                        if (el) el.indeterminate = someSelected
                    }}
                    onChange={() => onToggleAll(ids, !allSelected)}
                    aria-label="Select all on this page"
                />
                <span>Article</span>
                <span>Status</span>
                <span>Date</span>
                <span className="text-right">Actions</span>
            </div>

            <ul className="divide-y divide-gray-100">
                {contents.map((content) => {
                    const isSelected = selected.has(content.id)
                    const date = content.publishStatus === 'published' ? content.publishedAt : content.createdAt
                    return (
                        <li
                            key={content.id}
                            className={`grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-5 py-4 transition-colors md:grid-cols-[2rem_minmax(0,1fr)_7.5rem_7rem_14rem] md:items-center ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'}`}
                        >
                            <input
                                type="checkbox"
                                className="checkbox mt-1 md:mt-0"
                                checked={isSelected}
                                onChange={() => onToggle(content.id)}
                                aria-label={`Select ${content.title}`}
                            />

                            <div className="min-w-0">
                                <Link
                                    to="/contents/$contentId"
                                    params={{ contentId: content.id }}
                                    className="block truncate font-medium text-gray-900 hover:text-blue-600"
                                >
                                    {content.title || 'Untitled'}
                                </Link>
                                <div className="mt-0.5 flex min-w-0 items-center gap-3 text-xs text-gray-500">
                                    {projectNames?.[content.projectId] && (
                                        <span className="inline-flex shrink-0 items-center gap-1">
                                            <FolderOpen className="h-3 w-3" />
                                            {projectNames[content.projectId]}
                                        </span>
                                    )}
                                    <span className="truncate font-mono">/{content.slug}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 md:hidden">
                                    <StatusBadge status={content.publishStatus} />
                                    <span className="text-xs text-gray-500">{formatDate(date)}</span>
                                </div>
                            </div>

                            <div className="hidden md:block">
                                <StatusBadge status={content.publishStatus} />
                            </div>
                            <div className="hidden text-sm text-gray-500 tabular-nums md:block">{formatDate(date)}</div>

                            <div className="col-start-2 flex items-center gap-1 md:col-start-auto md:justify-end">
                                {content.publishStatus !== 'published' && (
                                    <button
                                        className="btn btn-sm text-emerald-700 hover:bg-emerald-50"
                                        disabled={isBusy}
                                        onClick={() => quick(content.id, 'published')}
                                        title="Publish now (manual)"
                                    >
                                        <Send /> Publish
                                    </button>
                                )}
                                {content.publishStatus !== 'draft' && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        disabled={isBusy}
                                        onClick={() => quick(content.id, 'draft')}
                                        title={content.publishStatus === 'published' ? 'Unpublish and keep as draft' : 'Move to draft'}
                                    >
                                        <FileEdit /> Draft
                                    </button>
                                )}
                                {(content.publishStatus === 'draft' || content.publishStatus === 'failed') && (
                                    <button
                                        className="btn btn-ghost btn-sm btn-icon"
                                        disabled={isBusy}
                                        onClick={() => quick(content.id, 'pending')}
                                        title="Add to auto-publish queue"
                                    >
                                        <Clock />
                                    </button>
                                )}
                                <Link
                                    to="/contents/$contentId"
                                    params={{ contentId: content.id }}
                                    className="btn btn-ghost btn-sm btn-icon"
                                    title="Edit"
                                >
                                    <Pencil />
                                </Link>
                                <button
                                    className="btn btn-danger-ghost btn-sm btn-icon"
                                    disabled={isBusy}
                                    onClick={() => {
                                        if (confirm(`Delete "${content.title}"?`)) remove.mutate([content.id])
                                    }}
                                    title="Delete"
                                >
                                    <Trash2 />
                                </button>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
