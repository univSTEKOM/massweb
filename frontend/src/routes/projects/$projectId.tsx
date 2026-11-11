import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Spinner } from '@heroui/react'
import { Book, CheckCircle2, Clock, FileEdit, FileText, Search, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, contentApi, type PublishStatus } from '../../lib/api'
import { ExportMenu } from '../../components/ExportMenu'
import { PublishJobControl } from '../../components/PublishJobControl'
import { ManualPublishPanel } from '../../components/ManualPublishPanel'
import { ContentTable, ContentBulkBar } from '../../components/ContentTable'
import { PageHeader, Pagination, StatTile, formatNumber } from '../../components/ui'
import { toggleInSet } from '../../lib/content-actions'

export const Route = createFileRoute('/projects/$projectId')({
    component: ProjectDetailPage,
    beforeLoad: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw redirect({ to: '/login' })
        }
    },
})

type Tab = 'all' | Extract<PublishStatus, 'draft' | 'pending' | 'published'>

function ProjectDetailPage() {
    const { projectId } = Route.useParams()
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [tab, setTab] = useState<Tab>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [generateAsDraft, setGenerateAsDraft] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const { data: project, isLoading: projectLoading } = useQuery({
        queryKey: ['project', projectId],
        queryFn: async () => (await projectsApi.getById(projectId)).data,
    })

    const { data: stats } = useQuery({
        queryKey: ['project-stats', projectId],
        queryFn: async () => (await projectsApi.getStats(projectId)).data,
    })

    const { data: contentsData, isLoading: contentsLoading } = useQuery({
        queryKey: ['contents', projectId, page, tab, debouncedSearch],
        queryFn: async () =>
            (
                await contentApi.getContents(
                    projectId,
                    page,
                    20,
                    tab === 'all' ? undefined : tab,
                    debouncedSearch || undefined,
                )
            ).data,
    })

    const generateMutation = useMutation({
        mutationFn: async () => {
            toast.loading('Generating articles...', { id: 'generate' })
            return (await contentApi.generateSync(projectId, { asDraft: generateAsDraft })).data
        },
        onSuccess: (data) => {
            toast.success(
                `${formatNumber(data.generatedCount)} articles generated${generateAsDraft ? ' as drafts' : ' into the queue'}`,
                { id: 'generate' },
            )
            queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
            queryClient.invalidateQueries({ queryKey: ['overall-stats'] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to generate content', { id: 'generate' })
        },
    })

    const changeTab = (next: Tab) => {
        setTab(next)
        setPage(1)
        setSelected(new Set())
    }

    const toggleAll = (ids: string[], select: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => (select ? next.add(id) : next.delete(id)))
            return next
        })
    }

    if (projectLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500 sm:px-6 lg:px-8">Project not found</div>
        )
    }

    const tabs: { key: Tab; label: string; count?: number }[] = [
        { key: 'all', label: 'All', count: stats?.totalContents },
        { key: 'draft', label: 'Drafts', count: stats?.draftContents },
        { key: 'pending', label: 'Queued', count: stats?.pendingContents },
        { key: 'published', label: 'Published', count: stats?.publishedContents },
    ]

    const isProjectEmpty = (stats?.totalContents ?? 0) === 0

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
            <PageHeader
                back={{ to: '/projects', label: 'Projects' }}
                leading={
                    project.thumbnailUrl ? (
                        <img
                            src={project.thumbnailUrl}
                            alt={project.name}
                            className="h-16 w-16 shrink-0 rounded-xl border border-gray-200 object-cover"
                        />
                    ) : undefined
                }
                title={project.name}
                description={
                    <div className="space-y-2.5">
                        {project.description && <p>{project.description}</p>}
                        {project.categories && project.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {project.categories.map((category) => (
                                    <span
                                        key={category.id}
                                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                        style={{
                                            backgroundColor: `${category.color || '#3B82F6'}1A`,
                                            color: category.color || '#3B82F6',
                                        }}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color || '#3B82F6' }} />
                                        {category.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                }
                actions={
                    <>
                        <ExportMenu projectId={projectId} projectName={project.name} totalContents={stats?.totalContents || 0} />
                        <Link to="/projects/$projectId/api-docs" params={{ projectId }} className="btn btn-secondary btn-sm">
                            <Book /> API Docs
                        </Link>
                    </>
                }
            />

            {/* Stats (click to filter) */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <StatTile label="Total articles" value={formatNumber(stats?.totalContents)} icon={<FileText />} tone="blue" onClick={() => changeTab('all')} active={tab === 'all'} />
                <StatTile label="Drafts" value={formatNumber(stats?.draftContents)} icon={<FileEdit />} tone="slate" onClick={() => changeTab('draft')} active={tab === 'draft'} />
                <StatTile label="Queued" value={formatNumber(stats?.pendingContents)} icon={<Clock />} tone="amber" onClick={() => changeTab('pending')} active={tab === 'pending'} />
                <StatTile label="Published" value={formatNumber(stats?.publishedContents)} icon={<CheckCircle2 />} tone="green" onClick={() => changeTab('published')} active={tab === 'published'} />
            </div>

            {/* Publishing: automatic (queue) vs manual (drafts), kept separate */}
            <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <PublishJobControl
                    projectId={projectId}
                    totalContents={stats?.totalContents || 0}
                    pendingContents={stats?.pendingContents || 0}
                />
                <ManualPublishPanel projectId={projectId} stats={stats} onReviewDrafts={() => changeTab('draft')} />
            </div>

            {/* Content list */}
            <div className="surface overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => changeTab(t.key)}
                                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                            >
                                {t.label}
                                <span className={`rounded-md px-1.5 text-xs tabular-nums ${tab === t.key ? 'bg-white/15' : 'bg-gray-100 text-gray-500'}`}>
                                    {formatNumber(t.count)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-72">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by title..."
                            className="field pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {tab === 'draft' && (stats?.draftContents ?? 0) > 0 && (
                    <div className="border-b border-gray-100 bg-slate-50 px-5 py-2.5 text-sm text-slate-600">
                        Drafts are not published by auto-publish. Select the ones you want and use <strong>Publish now</strong>.
                    </div>
                )}

                {contentsLoading ? (
                    <div className="flex justify-center py-16">
                        <Spinner />
                    </div>
                ) : !contentsData || contentsData.contents.length === 0 ? (
                    isProjectEmpty && !debouncedSearch ? (
                        <div className="mx-auto max-w-md px-4 py-14 text-center">
                            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Sparkles className="h-6 w-6" />
                            </span>
                            <h3 className="text-base font-semibold text-gray-900">No articles generated yet</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Generate articles from this project&apos;s uploaded data and template.
                            </p>
                            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={generateAsDraft}
                                    onChange={(e) => setGenerateAsDraft(e.target.checked)}
                                />
                                Save as drafts (publish manually later)
                            </label>
                            <div className="mt-4">
                                <button className="btn btn-primary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                                    <Sparkles /> {generateMutation.isPending ? 'Generating...' : 'Generate articles'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="px-4 py-14 text-center text-sm text-gray-500">
                            {debouncedSearch ? `No articles match "${debouncedSearch}".` : 'No articles in this view.'}
                        </div>
                    )
                ) : (
                    <>
                        <ContentTable
                            contents={contentsData.contents}
                            selected={selected}
                            onToggle={(id) => setSelected((prev) => toggleInSet(prev, id))}
                            onToggleAll={toggleAll}
                        />
                        <Pagination page={page} totalPages={contentsData.totalPages} onChange={setPage} />
                    </>
                )}
            </div>

            <ContentBulkBar selected={selected} onClear={() => setSelected(new Set())} />
        </div>
    )
}
