import { ArrowRight, Clock, FileEdit, Hand, Send } from 'lucide-react'
import type { ProjectStats } from '../lib/api'
import { useContentActions } from '../lib/content-actions'
import { formatNumber } from './ui'
import { useConfirm } from './Modal'

interface ManualPublishPanelProps {
    projectId: string
    stats?: ProjectStats
    onReviewDrafts: () => void
}

/**
 * Manual publishing, kept separate from the auto-publish job.
 * Drafts are never touched by auto-publish; they only go live from here
 * (or from the per-article / bulk "Publish now" actions).
 */
export function ManualPublishPanel({ projectId, stats, onReviewDrafts }: ManualPublishPanelProps) {
    const { setProjectStatus, isBusy } = useContentActions()
    const confirm = useConfirm()
    const drafts = stats?.draftContents ?? 0
    const queued = stats?.pendingContents ?? 0

    return (
        <div className="surface flex flex-col p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Hand className="h-4 w-4" />
                </span>
                <div>
                    <h3 className="section-title">Manual Publish &amp; Drafts</h3>
                    <p className="section-desc">
                        Drafts are skipped by auto-publish. Review them, then publish manually whenever you are ready.
                    </p>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">Drafts</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{formatNumber(drafts)}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">In auto-publish queue</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{formatNumber(queued)}</p>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                <button
                    className="btn btn-success w-full"
                    disabled={isBusy || drafts === 0}
                    onClick={async () => {
                        const ok = await confirm({
                            title: `Publish all ${formatNumber(drafts)} drafts now?`,
                            message: 'They go live immediately, outside the auto-publish queue.',
                            confirmText: 'Publish all',
                            tone: 'primary',
                        })
                        if (ok) setProjectStatus.mutate({ projectId, from: 'draft', to: 'published' })
                    }}
                >
                    <Send /> Publish all drafts now
                </button>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                        className="btn btn-secondary"
                        disabled={isBusy || queued === 0}
                        onClick={async () => {
                            const ok = await confirm({
                                title: `Move all ${formatNumber(queued)} queued articles to draft?`,
                                message: 'Auto-publish will skip them until you queue or publish them again.',
                                confirmText: 'Move to draft',
                                tone: 'primary',
                            })
                            if (ok) setProjectStatus.mutate({ projectId, from: 'pending', to: 'draft' })
                        }}
                        title="Mass draft: pull every queued article out of auto-publish"
                    >
                        <FileEdit /> Draft all queued
                    </button>
                    <button
                        className="btn btn-secondary"
                        disabled={isBusy || drafts === 0}
                        onClick={() => setProjectStatus.mutate({ projectId, from: 'draft', to: 'pending' })}
                        title="Hand every draft over to the auto-publish queue"
                    >
                        <Clock /> Queue all drafts
                    </button>
                </div>
            </div>

            <button
                className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                onClick={onReviewDrafts}
                disabled={drafts === 0}
            >
                Review &amp; pick drafts to publish <ArrowRight className="h-4 w-4" />
            </button>
        </div>
    )
}
