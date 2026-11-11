import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Pause, Play, Trash2, X, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminJobsApi } from '../../lib/admin-api'
import { AdminTable, AdminToolbar, apiError } from '../../components/admin/AdminParts'
import { useConfirm } from '../../components/Modal'
import { formatDate } from '../../components/ui'

export const Route = createFileRoute('/admin/jobs')({
  component: AdminJobsPage,
})

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock },
  processing: { label: 'Processing', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Play },
  paused: { label: 'Paused', cls: 'bg-orange-50 text-orange-700 ring-orange-200', icon: Pause },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200', icon: AlertCircle },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 ring-gray-200', icon: XCircle },
}

/** One admin job action (pause / resume / cancel / delete) with toasts and list refresh. */
function useJobAction(fn: (id: string) => Promise<unknown>, done: string, fail: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      toast.success(done)
    },
    onError: (error) => toast.error(apiError(error, fail)),
  })
}

function AdminJobsPage() {
  const confirm = useConfirm()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', page, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter
      return (await adminJobsApi.getAll(params)).data
    },
    // Keep progress live while something is running
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((j: any) => j.status === 'processing' || j.status === 'pending') ? 5000 : false,
  })

  const pause = useJobAction(adminJobsApi.pause, 'Job paused', 'Failed to pause job')
  const resume = useJobAction(adminJobsApi.resume, 'Job resumed', 'Failed to resume job')
  const cancel = useJobAction(adminJobsApi.cancel, 'Job cancelled', 'Failed to cancel job')
  const remove = useJobAction(adminJobsApi.delete, 'Job deleted', 'Failed to delete job')
  const busy = pause.isPending || resume.isPending || cancel.isPending || remove.isPending

  const handleCancel = async (job: any) => {
    const ok = await confirm({
      title: 'Cancel this publish job?',
      message: `${job.project?.name ?? 'The project'}: ${job.processedCount}/${job.totalContents} articles were published. The rest stay queued.`,
      confirmText: 'Cancel job',
      cancelText: 'Keep running',
    })
    if (ok) cancel.mutate(job.id)
  }

  const handleDelete = async (job: any) => {
    const ok = await confirm({
      title: 'Delete this job record?',
      message: 'Only the job history is removed. Published articles are not affected.',
      confirmText: 'Delete',
    })
    if (ok) remove.mutate(job.id)
  }

  const jobs = data?.data || []

  return (
    <div className="surface overflow-hidden">
      <AdminToolbar>
        <select
          className="field w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([value, s]) => (
            <option key={value} value={value}>{s.label}</option>
          ))}
        </select>
        {data && <span className="text-sm text-gray-500 tabular-nums sm:ml-auto">{data.total ?? jobs.length} jobs</span>}
      </AdminToolbar>

      <AdminTable
        isLoading={isLoading}
        isEmpty={jobs.length === 0}
        emptyText={statusFilter !== 'all' ? 'No jobs with this status.' : 'No publish jobs yet.'}
        page={page}
        totalPages={data?.totalPages || 0}
        onPage={setPage}
        head={
          <tr>
            <th className="px-5 py-2.5">Project</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Progress</th>
            <th className="px-3 py-2.5">Created</th>
            <th className="px-5 py-2.5 text-right">Actions</th>
          </tr>
        }
      >
        {jobs.map((job: any) => {
          const s = STATUS[job.status] ?? STATUS.pending
          const Icon = s.icon
          const pct = job.totalContents > 0 ? Math.round((job.processedCount / job.totalContents) * 100) : 0
          return (
            <tr key={job.id} className="hover:bg-gray-50/70">
              <td className="px-5 py-3">
                <p className="font-medium text-gray-900">{job.project?.name || 'Unknown project'}</p>
                <p className="text-xs text-gray-500">
                  {job.organization?.name || 'No organization'} · <span className="font-mono" title={job.id}>{job.id.slice(0, 8)}</span>
                </p>
              </td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${s.cls}`}>
                  <Icon className="h-3 w-3" /> {s.label}
                </span>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${job.status === 'failed' ? 'bg-red-500' : job.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs whitespace-nowrap text-gray-500 tabular-nums">
                    {job.processedCount}/{job.totalContents}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatDate(job.createdAt, true)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1">
                  {job.status === 'processing' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => pause.mutate(job.id)}>
                      <Pause /> Pause
                    </button>
                  )}
                  {job.status === 'paused' && (
                    <button className="btn btn-sm text-emerald-700 hover:bg-emerald-50" disabled={busy} onClick={() => resume.mutate(job.id)}>
                      <Play /> Resume
                    </button>
                  )}
                  {['pending', 'processing', 'paused'].includes(job.status) && (
                    <button className="btn btn-danger-ghost btn-sm" disabled={busy} onClick={() => handleCancel(job)}>
                      <X /> Cancel
                    </button>
                  )}
                  {['completed', 'failed', 'cancelled'].includes(job.status) && (
                    <button className="btn btn-ghost btn-sm btn-icon" disabled={busy} onClick={() => handleDelete(job)} title="Delete record" aria-label="Delete job record">
                      <Trash2 />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </AdminTable>
    </div>
  )
}
