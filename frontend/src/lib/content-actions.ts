import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { contentApi, type ManualPublishStatus, type PublishStatus } from './api'

const STATUS_SUCCESS: Record<ManualPublishStatus, (n: number) => string> = {
    published: (n) => `${n} article${n === 1 ? '' : 's'} published`,
    draft: (n) => `${n} article${n === 1 ? '' : 's'} moved to draft`,
    pending: (n) => `${n} article${n === 1 ? '' : 's'} added to the publish queue`,
}

function errorMessage(error: any, fallback: string) {
    const msg = error?.response?.data?.message
    return Array.isArray(msg) ? msg.join(', ') : msg || error?.message || fallback
}

/**
 * Shared mutations for manual publishing, drafting and deleting content.
 * Invalidates every list/stat query that can show the affected items.
 */
export function useContentActions(options: { onDone?: () => void } = {}) {
    const queryClient = useQueryClient()

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['contents'] })
        queryClient.invalidateQueries({ queryKey: ['content'] })
        queryClient.invalidateQueries({ queryKey: ['project-stats'] })
        queryClient.invalidateQueries({ queryKey: ['overall-stats'] })
        queryClient.invalidateQueries({ queryKey: ['org-contents'] })
        queryClient.invalidateQueries({ queryKey: ['drafts'] })
    }

    const setStatus = useMutation({
        mutationFn: async ({ ids, status }: { ids: string[]; status: ManualPublishStatus }) => {
            toast.loading('Updating...', { id: 'content-status' })
            const res = await contentApi.bulkStatus(ids, status)
            return { status, updated: res.data.updated }
        },
        onSuccess: ({ status, updated }) => {
            toast.success(STATUS_SUCCESS[status](updated), { id: 'content-status' })
            refresh()
            options.onDone?.()
        },
        onError: (error) => toast.error(errorMessage(error, 'Failed to update status'), { id: 'content-status' }),
    })

    const setProjectStatus = useMutation({
        mutationFn: async ({ projectId, from, to }: { projectId: string; from: PublishStatus; to: ManualPublishStatus }) => {
            toast.loading('Updating...', { id: 'project-status' })
            const res = await contentApi.projectBulkStatus(projectId, from, to)
            return { status: to, updated: res.data.updated }
        },
        onSuccess: ({ status, updated }) => {
            toast.success(STATUS_SUCCESS[status](updated), { id: 'project-status' })
            refresh()
            options.onDone?.()
        },
        onError: (error) => toast.error(errorMessage(error, 'Failed to update status'), { id: 'project-status' }),
    })

    const remove = useMutation({
        mutationFn: async (ids: string[]) => {
            toast.loading('Deleting...', { id: 'content-delete' })
            const res = await contentApi.bulkDelete(ids)
            return res.data.deleted
        },
        onSuccess: (deleted) => {
            toast.success(`${deleted} article${deleted === 1 ? '' : 's'} deleted`, { id: 'content-delete' })
            refresh()
            options.onDone?.()
        },
        onError: (error) => toast.error(errorMessage(error, 'Failed to delete'), { id: 'content-delete' }),
    })

    const isBusy = setStatus.isPending || setProjectStatus.isPending || remove.isPending

    return { setStatus, setProjectStatus, remove, isBusy }
}

/** Selection helper for paginated lists. */
export function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
}
