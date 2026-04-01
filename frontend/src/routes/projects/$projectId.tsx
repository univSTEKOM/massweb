import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { projectsApi, contentApi, type GeneratedContent } from '../../lib/api'
import { Button, Card, Spinner } from '@heroui/react'
import { ArrowLeft, Sparkles, Eye, Trash2, CheckSquare, Square, RotateCcw, Book, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExportMenu } from '../../components/ExportMenu'
import { PublishJobControl } from '../../components/PublishJobControl'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/projects/$projectId')({
    component: ProjectDetailPage,
    beforeLoad: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw redirect({ to: '/login' })
        }
    },
})

function ProjectDetailPage() {
    const { projectId } = Route.useParams()
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [bulkPublishDelay, setBulkPublishDelay] = useState(3)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const { data: project, isLoading: projectLoading } = useQuery({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const response = await projectsApi.getById(projectId)
            return response.data
        },
    })

    const { data: stats } = useQuery({
        queryKey: ['project-stats', projectId],
        queryFn: async () => {
            const response = await projectsApi.getStats(projectId)
            return response.data
        },
    })

    const { data: contentsData, isLoading: contentsLoading } = useQuery({
        queryKey: ['contents', projectId, page, statusFilter, debouncedSearch],
        queryFn: async () => {
            const response = await contentApi.getContents(
                projectId,
                page,
                20,
                statusFilter === 'all' ? undefined : statusFilter,
                debouncedSearch || undefined
            )
            return response.data
        },
    })

    // Toggle selection
    const toggleSelection = (id: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            toast.loading('Deleting content...', { id: 'bulk-delete' })
            await Promise.all(ids.map(id => contentApi.delete(id)))
        },
        onSuccess: () => {
            toast.success('Content deleted successfully', { id: 'bulk-delete' })
            queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
            setSelectedItems(new Set())
        },
        onError: () => {
            toast.error('Failed to delete content', { id: 'bulk-delete' })
        },
    })

    // Bulk publish mutation  
    const bulkPublishMutation = useMutation({
        mutationFn: async ({ ids, delay }: { ids: string[], delay: number }) => {
            toast.loading(`Publishing ${ids.length} item(s)...`, { id: 'bulk-publish' })
            for (let i = 0; i < ids.length; i++) {
                await contentApi.update(ids[i], { publishStatus: 'published' })
                if (i < ids.length - 1 && delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay * 1000))
                }
            }
        },
        onSuccess: () => {
            toast.success('Content published successfully', { id: 'bulk-publish' })
            queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
            setSelectedItems(new Set())
        },
        onError: () => {
            toast.error('Failed to publish content', { id: 'bulk-publish' })
        },
    })

    // Bulk unpublish mutation
    const bulkUnpublishMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            toast.loading(`Unpublishing ${ids.length} item(s)...`, { id: 'bulk-unpublish' })
            await contentApi.unpublish(ids)
        },
        onSuccess: () => {
            toast.success('Content unpublished successfully', { id: 'bulk-unpublish' })
            queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
            setSelectedItems(new Set())
        },
        onError: () => {
            toast.error('Failed to unpublish content', { id: 'bulk-unpublish' })
        },
    })

    const handleBulkDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`)) {
            bulkDeleteMutation.mutate(Array.from(selectedItems))
        }
    }

    const handleBulkPublish = () => {
        if (selectedItems.size === 0) return
        bulkPublishMutation.mutate({
            ids: Array.from(selectedItems),
            delay: bulkPublishDelay
        })
    }

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!project) {
        return <div>Project not found</div>
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6 flex justify-between items-center">
                <Link to="/projects">
                    <Button className="bg-gray-100 hover:bg-gray-200 text-gray-800">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Projects
                    </Button>
                </Link>
                <Link to={`/projects/${projectId}/api-docs`}>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Book className="w-4 h-4 mr-2" />
                        API Documentation
                    </Button>
                </Link>
            </div>

            <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                    {project.thumbnailUrl && (
                        <img
                            src={project.thumbnailUrl}
                            alt={project.name}
                            className="w-24 h-24 rounded-lg object-cover border-2 border-blue-500 shadow-lg"
                        />
                    )}
                    <div className="flex-1">
                        <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
                        {project.description && (
                            <p className="text-gray-600 dark:text-gray-400">{project.description}</p>
                        )}
                    </div>
                </div>

                {/* Categories */}
                {project.categories && project.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {project.categories.map((category) => (
                            <span
                                key={category.id}
                                className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5"
                                style={{
                                    backgroundColor: category.color ? `${category.color}20` : '#3B82F620',
                                    color: category.color || '#3B82F6',
                                }}
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: category.color || '#3B82F6' }}
                                />
                                {category.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="text-center p-6">
                        <p className="text-3xl font-bold text-blue-600">{stats.totalContents}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Contents</p>
                    </Card>
                    <Card className="text-center p-6">
                        <p className="text-3xl font-bold text-green-600">{stats.publishedContents}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Published</p>
                    </Card>
                    <Card className="text-center p-6">
                        <p className="text-3xl font-bold text-orange-600">{stats.pendingContents}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                    </Card>
                </div>
            )}

            {/* Export and Publish Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Export Menu */}
                <Card className="p-6">
                    <h3 className="text-xl font-bold mb-4">Export Content</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Download all generated content in various formats
                    </p>
                    <ExportMenu
                        projectId={projectId}
                        projectName={project.name}
                        totalContents={stats?.totalContents || 0}
                    />
                </Card>

                {/* Publish Control */}
                <PublishJobControl
                    projectId={projectId}
                    totalContents={stats?.totalContents || 0}
                    pendingContents={stats?.pendingContents || 0}
                />
            </div>

            {/* Content List */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Generated Content</h2>
                        {selectedItems.size > 0 && (
                            <p className="text-sm text-blue-600 mt-1">
                                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari berdasarkan judul..."
                                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setPage(1)
                            }}
                        >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="published">Published</option>
                        </select>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedItems.size > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex flex-wrap gap-3 items-center">
                        <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Selected
                        </Button>

                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max="60"
                                className="w-20 px-2 py-1 border rounded text-sm"
                                value={bulkPublishDelay}
                                onChange={(e) => setBulkPublishDelay(Math.max(0, parseInt(e.target.value) || 0))}
                            />
                            <span className="text-sm text-gray-600">sec delay</span>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleBulkPublish}
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Publish Selected
                            </Button>

                            <Button
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                                onClick={() => bulkUnpublishMutation.mutate(Array.from(selectedItems))}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Unpublish Selected
                            </Button>
                        </div>

                        <Button
                            size="sm"
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 ml-auto"
                            onClick={() => setSelectedItems(new Set())}
                        >
                            Clear Selection
                        </Button>
                    </div>
                )}

                {contentsLoading ? (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                ) : !contentsData || contentsData.contents.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-600 dark:text-gray-400">No content generated yet</p>
                        <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700">
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Content
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {contentsData.contents.map((content: GeneratedContent) => (
                                <Card key={content.id} className="p-4 hover:shadow-lg transition-shadow">
                                    <div className="flex gap-3 items-start">
                                        {/* Checkbox */}
                                        <button
                                            onClick={() => toggleSelection(content.id)}
                                            className="mt-1 flex-shrink-0"
                                        >
                                            {selectedItems.has(content.id) ? (
                                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-400 hover:text-blue-500" />
                                            )}
                                        </button>

                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold mb-1">{content.title}</h3>
                                            {content.metaDescription && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                                    {content.metaDescription}
                                                </p>
                                            )}
                                            <div className="flex gap-2 items-center">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${content.publishStatus === 'published'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {content.publishStatus}
                                                </span>
                                                <span className="text-xs text-gray-500">{content.slug}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link to="/contents/$contentId" params={{ contentId: content.id }}>
                                                <Button className="bg-gray-100 hover:bg-gray-200 text-gray-800 p-2">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button className="bg-red-100 hover:bg-red-200 text-red-700 p-2">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {contentsData.totalPages > 1 && (
                            <div className="flex justify-center mt-6 gap-2">
                                <Button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    isDisabled={page === 1}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
                                >
                                    Previous
                                </Button>
                                <span className="px-4 py-2">
                                    Page {page} of {contentsData.totalPages}
                                </span>
                                <Button
                                    onClick={() => setPage(p => Math.min(contentsData.totalPages, p + 1))}
                                    isDisabled={page === contentsData.totalPages}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    )
}
