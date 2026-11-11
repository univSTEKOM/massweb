import { createFileRoute, Link, useNavigate, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { projectsApi, contentApi, type Project } from '../../lib/api'
import { Plus, Calendar, FileText, CheckCircle2, Clock, Activity, Zap, BarChart3, Building2, Trash2, FileEdit, ChevronRight } from 'lucide-react'
import { ProjectCardSkeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader, StatTile, formatNumber } from '../../components/ui'
import { useOrganization } from '../../contexts/organization-context'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/projects/')({
    component: ProjectsPage,
    beforeLoad: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw redirect({ to: '/login' })
        }
    },
})

function NewProjectButton() {
    return (
        <Link to="/projects/create" className="btn btn-primary">
            <Plus /> New project
        </Link>
    )
}

function ProjectsPage() {
    const navigate = useNavigate()
    const { currentOrganization } = useOrganization()

    const { data: projects, isLoading, error } = useQuery({
        queryKey: ['projects', currentOrganization?.id],
        queryFn: async () => (await projectsApi.getAll(currentOrganization?.id)).data,
        enabled: !!currentOrganization,
    })

    const { data: stats } = useQuery({
        queryKey: ['overall-stats', currentOrganization?.id],
        queryFn: async () => (await contentApi.getOverallStats(currentOrganization?.id)).data,
        enabled: !!currentOrganization,
    })

    const header = (
        <PageHeader
            title="Dashboard"
            description="Overview of your content marketing operations"
            actions={<NewProjectButton />}
        />
    )

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {header}
                <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200/70" />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <ProjectCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="mx-auto max-w-md px-4 py-16">
                <div className="surface p-6 text-sm text-red-600">Error loading projects: {(error as Error).message}</div>
            </div>
        )
    }

    if (!currentOrganization) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <h2 className="text-lg font-semibold text-gray-900">No organization selected</h2>
                <p className="mt-1 text-sm text-gray-500">Please select an organization to view projects.</p>
            </div>
        )
    }

    const publishRate = stats && stats.totalContent > 0 ? (stats.publishedContent / stats.totalContent) * 100 : 0

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {header}

            {stats && (
                <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
                    <StatTile label="Projects" value={formatNumber(stats.totalProjects)} icon={<BarChart3 />} tone="blue" />
                    <StatTile
                        label="Articles"
                        value={formatNumber(stats.totalContent)}
                        icon={<FileText />}
                        tone="purple"
                        footer={`~${formatNumber(stats.totalProjects ? Math.round(stats.totalContent / stats.totalProjects) : 0)} per project`}
                    />
                    <StatTile
                        label="Published"
                        value={formatNumber(stats.publishedContent)}
                        icon={<CheckCircle2 />}
                        tone="green"
                        footer={
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${publishRate}%` }} />
                                </div>
                                <span className="font-medium text-emerald-700 tabular-nums">{publishRate.toFixed(0)}%</span>
                            </div>
                        }
                    />
                    <StatTile
                        label="Queued / Drafts"
                        value={
                            <span>
                                {formatNumber(stats.pendingContent)}
                                <span className="mx-1.5 text-gray-300">/</span>
                                {formatNumber(stats.draftContent)}
                            </span>
                        }
                        icon={<Clock />}
                        tone="amber"
                        footer={
                            <Link to="/drafts" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700">
                                Manage drafts <ChevronRight className="h-3 w-3" />
                            </Link>
                        }
                    />
                    <StatTile
                        label="Active jobs"
                        value={formatNumber(stats.activeJobs)}
                        icon={<Activity className={stats.activeJobs > 0 ? 'animate-pulse' : ''} />}
                        tone="slate"
                        footer={`${stats.completedJobsToday} completed today${stats.failedContent ? ` · ${stats.failedContent} failed` : ''}`}
                    />
                </div>
            )}

            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900">Your projects</h2>
                    <p className="text-sm text-gray-500">Open a project to manage, draft and publish its articles</p>
                </div>
            </div>

            {!projects || projects.length === 0 ? (
                <div className="surface">
                    <EmptyState
                        icon={<Zap className="h-7 w-7 text-blue-600" />}
                        title="No projects yet"
                        description="Create your first project to start generating SEO-optimized content at scale"
                        action={{ label: 'Create project', onClick: () => navigate({ to: '/projects/create' }) }}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                    {projects.map((project: Project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            )}
        </div>
    )
}

function ProjectCard({ project }: { project: Project }) {
    const queryClient = useQueryClient()

    const formatStat = (value: number | undefined): string => {
        if (!value) return '0'
        return value > 9999 ? `${Math.floor(value / 1000)}k` : value.toLocaleString('en-US')
    }

    const { data: stats } = useQuery({
        queryKey: ['project-stats', project.id],
        queryFn: async () => (await projectsApi.getStats(project.id)).data,
    })

    const deleteMutation = useMutation({
        mutationFn: async () => projectsApi.delete(project.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['overall-stats'] })
            toast.success('Project deleted successfully')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete project')
        },
    })

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (window.confirm(`Are you sure you want to delete "${project.name}"? This will delete all generated content. This action cannot be undone.`)) {
            deleteMutation.mutate()
        }
    }

    const total = stats?.totalContents ?? 0
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

    return (
        <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="surface group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
        >
            <div className="mb-3 flex items-start gap-3">
                {project.thumbnailUrl ? (
                    <img src={project.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover" />
                ) : (
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText className="h-5 w-5" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-gray-900 group-hover:text-blue-700">{project.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
                <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="btn btn-danger-ghost btn-sm btn-icon opacity-60 group-hover:opacity-100"
                    title="Delete project"
                >
                    <Trash2 />
                </button>
            </div>

            {project.description && <p className="mb-4 line-clamp-2 text-sm text-gray-500">{project.description}</p>}

            <div className="mt-auto">
                {/* Status distribution */}
                <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="bg-emerald-500" style={{ width: `${pct(stats?.publishedContents ?? 0)}%` }} />
                    <div className="bg-amber-400" style={{ width: `${pct(stats?.pendingContents ?? 0)}%` }} />
                    <div className="bg-slate-300" style={{ width: `${pct(stats?.draftContents ?? 0)}%` }} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                        { label: 'Total', value: total, cls: 'text-gray-900' },
                        { label: 'Live', value: stats?.publishedContents, cls: 'text-emerald-600' },
                        { label: 'Queue', value: stats?.pendingContents, cls: 'text-amber-600' },
                        { label: 'Draft', value: stats?.draftContents, cls: 'text-slate-600', icon: true },
                    ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-gray-50 px-1 py-2">
                            <p className={`text-sm font-semibold tabular-nums ${item.cls}`}>{formatStat(item.value)}</p>
                            <p className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-gray-500">
                                {item.icon && <FileEdit className="h-2.5 w-2.5" />}
                                {item.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    )
}
