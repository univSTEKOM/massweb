import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Spinner } from '@heroui/react'
import { Building2, FileEdit, FolderOpen, Plus, Search } from 'lucide-react'
import { contentApi } from '../lib/api'
import { useOrganization } from '../contexts/organization-context'
import { ContentTable, ContentBulkBar } from '../components/ContentTable'
import { PageHeader, Pagination, formatNumber } from '../components/ui'
import { toggleInSet } from '../lib/content-actions'

export const Route = createFileRoute('/drafts')({
    component: DraftsPage,
    beforeLoad: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw redirect({ to: '/login' })
        }
    },
})

/**
 * Manual publishing workspace: every draft across the organization, separate from
 * the per-project auto-publish queue.
 */
function DraftsPage() {
    const { currentOrganization } = useOrganization()
    const [page, setPage] = useState(1)
    const [projectFilter, setProjectFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const { data, isLoading } = useQuery({
        queryKey: ['drafts', currentOrganization?.id, page, projectFilter, debouncedSearch],
        queryFn: async () => {
            const res = await contentApi.searchOrganizationContents(currentOrganization!.id, {
                status: 'draft',
                projectId: projectFilter !== 'all' ? projectFilter : undefined,
                search: debouncedSearch || undefined,
                page,
                limit: 25,
            })
            return res.data
        },
        enabled: !!currentOrganization?.id,
    })

    const projectNames = useMemo(
        () => Object.fromEntries((data?.projects ?? []).map((p) => [p.id, p.name])),
        [data?.projects],
    )

    const toggleAll = (ids: string[], select: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => (select ? next.add(id) : next.delete(id)))
            return next
        })
    }

    if (!currentOrganization) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <h2 className="text-lg font-semibold text-gray-900">No organization selected</h2>
                <p className="mt-1 text-sm text-gray-500">Select an organization from the header to see its drafts.</p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
            <PageHeader
                title="Drafts"
                description="Articles parked as draft. Auto-publish never touches them. Review here and publish manually when ready."
                actions={
                    <>
                        {data && (
                            <div className="mr-3 text-right">
                                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{formatNumber(data.total)}</p>
                                <p className="text-xs text-gray-500">drafts</p>
                            </div>
                        )}
                        <Link to="/contents/new" className="btn btn-primary">
                            <Plus /> New article
                        </Link>
                    </>
                }
            />

            <div className="surface overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:p-5">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search drafts by title..."
                            className="field pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative sm:w-64">
                        <FolderOpen className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <select
                            className="field pl-9"
                            value={projectFilter}
                            onChange={(e) => {
                                setProjectFilter(e.target.value)
                                setPage(1)
                                setSelected(new Set())
                            }}
                        >
                            <option value="all">All projects</option>
                            {data?.projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Spinner />
                    </div>
                ) : !data || data.contents.length === 0 ? (
                    <div className="mx-auto max-w-sm px-4 py-14 text-center">
                        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <FileEdit className="h-6 w-6" />
                        </span>
                        <h3 className="text-base font-semibold text-gray-900">
                            {debouncedSearch || projectFilter !== 'all' ? 'No drafts match your filters' : 'No drafts'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Move articles to draft from a project, or generate a project with &ldquo;Save as drafts&rdquo;.
                        </p>
                        <Link to="/projects" className="btn btn-secondary btn-sm mt-5">
                            Go to projects
                        </Link>
                    </div>
                ) : (
                    <>
                        <ContentTable
                            contents={data.contents}
                            selected={selected}
                            onToggle={(id) => setSelected((prev) => toggleInSet(prev, id))}
                            onToggleAll={toggleAll}
                            projectNames={projectNames}
                        />
                        <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
                    </>
                )}
            </div>

            <ContentBulkBar selected={selected} onClear={() => setSelected(new Set())} />
        </div>
    )
}
