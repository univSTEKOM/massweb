import { useState, useEffect } from 'react'
import { Play, Clock, Zap, Pause, RotateCcw, X } from 'lucide-react'
import { formatNumber } from './ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contentApi } from '../lib/api'
import toast from 'react-hot-toast'

interface PublishJobControlProps {
    projectId: string
    totalContents: number
    pendingContents: number
}

export function PublishJobControl({ projectId, totalContents, pendingContents }: PublishJobControlProps) {
    const [delaySeconds, setDelaySeconds] = useState(5)
    const [jobId, setJobId] = useState<string | null>(null)
    const [jobStatus, setJobStatus] = useState<any>(null)
    const queryClient = useQueryClient()

    // Check for active job on mount
    useEffect(() => {
        const checkActiveJob = async () => {
            try {
                const response = await contentApi.getActivePublishJob(projectId)
                if (response.data) {
                    setJobId(response.data.id)
                    setJobStatus(response.data)
                }
            } catch (error) {
                console.error('Failed to check for active job:', error)
            }
        }
        checkActiveJob()
    }, [projectId])

    const startPublishMutation = useMutation({
        mutationFn: async () => {
            const response = await contentApi.publishAsync(projectId, delaySeconds)
            return response.data
        },
        onSuccess: (data) => {
            setJobId(data.jobId)
            toast.success('Publishing started in background!')
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to start publishing'
            toast.error(errorMessage)
        },
    })

    const pauseMutation = useMutation({
        mutationFn: async () => {
            if (!jobId) return
            await contentApi.pausePublishJob(jobId)
        },
        onSuccess: () => {
            toast.success('Publishing paused')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to pause')
        },
    })

    const resumeMutation = useMutation({
        mutationFn: async () => {
            if (!jobId) return
            await contentApi.resumePublishJob(jobId)
        },
        onSuccess: () => {
            toast.success('Publishing resumed')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to resume')
        },
    })

    const cancelMutation = useMutation({
        mutationFn: async () => {
            if (!jobId) return
            await contentApi.cancelPublishJob(jobId)
        },
        onSuccess: () => {
            toast.success('Publishing cancelled')
            setJobId(null)
            setJobStatus(null)
            queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to cancel')
        },
    })

    // Poll for job status
    useEffect(() => {
        if (!jobId) return

        const interval = setInterval(async () => {
            try {
                const response = await contentApi.getPublishJobStatus(jobId)
                const status = response.data
                setJobStatus(status)

                if (status.status === 'completed') {
                    clearInterval(interval)
                    toast.success(`Successfully published ${status.totalContents} items!`)
                    queryClient.invalidateQueries({ queryKey: ['contents', projectId] })
                    queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
                    setJobId(null)
                    setJobStatus(null)
                } else if (status.status === 'failed' || status.status === 'cancelled') {
                    clearInterval(interval)
                    if (status.status === 'failed') {
                        toast.error(`Publishing failed: ${status.errorMessage || 'Unknown error'}`)
                    }
                    setJobId(null)
                    setJobStatus(null)
                }
            } catch (error) {
                console.error('Failed to fetch job status:', error)
            }
        }, 2000) // Poll every 2 seconds

        return () => clearInterval(interval)
    }, [jobId, projectId, queryClient])

    const handleStart = () => {
        if (pendingContents === 0) {
            toast.error('No queued content to publish')
            return
        }
        startPublishMutation.mutate()
    }

    const header = (title: string, desc: string, pulse = false) => (
        <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Zap className={`h-4 w-4 ${pulse ? 'animate-pulse' : ''}`} />
            </span>
            <div>
                <h3 className="section-title">{title}</h3>
                <p className="section-desc">{desc}</p>
            </div>
        </div>
    )

    // Show progress if job is running
    if (jobId && jobStatus) {
        const progress = jobStatus.totalContents > 0
            ? (jobStatus.processedCount / jobStatus.totalContents) * 100
            : 0

        const isPaused = jobStatus.status === 'paused'
        const isProcessing = jobStatus.status === 'processing' || jobStatus.status === 'pending'

        return (
            <div className="surface flex flex-col p-5 sm:p-6">
                {header(
                    isPaused ? 'Auto Publish paused' : 'Auto Publish running',
                    `Publishing queued articles with a ${jobStatus.delaySeconds}s delay between items.`,
                    !isPaused,
                )}

                <div className="mt-6">
                    <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-600 tabular-nums">
                            {formatNumber(jobStatus.processedCount)} / {formatNumber(jobStatus.totalContents)}
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ease-out ${isPaused ? 'bg-amber-400' : 'bg-blue-600'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        Status: <span className="font-medium capitalize text-gray-700">{jobStatus.status}</span>
                        {jobStatus.status === 'pending' && ' · waiting for the scheduler (runs every 30s)'}
                    </p>
                </div>

                <div className="mt-auto flex gap-2 pt-6">
                    {isPaused ? (
                        <button
                            className="btn btn-success flex-1"
                            onClick={() => resumeMutation.mutate()}
                            disabled={resumeMutation.isPending}
                        >
                            <RotateCcw /> {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
                        </button>
                    ) : isProcessing ? (
                        <button
                            className="btn btn-warning flex-1"
                            onClick={() => pauseMutation.mutate()}
                            disabled={pauseMutation.isPending}
                        >
                            <Pause /> {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
                        </button>
                    ) : null}

                    <button
                        className="btn btn-secondary text-red-600"
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                    >
                        <X /> {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="surface flex flex-col p-5 sm:p-6">
            {header(
                'Auto Publish',
                'Publishes every queued article in the background, one by one. Drafts are never included.',
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">Queued</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
                        {formatNumber(pendingContents)}
                        <span className="ml-1 text-sm font-normal text-gray-400">/ {formatNumber(totalContents)}</span>
                    </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                        <Clock className="h-3 w-3" /> Est. time
                    </p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
                        ~{Math.ceil((pendingContents * delaySeconds) / 60)} min
                    </p>
                </div>
            </div>

            <div className="mt-5">
                <label className="label" htmlFor="publish-delay">Delay between items (seconds)</label>
                <input
                    id="publish-delay"
                    type="number"
                    min="0"
                    max="3600"
                    className="field"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <p className="hint">0 = publish immediately · recommended 3–10 seconds. Keeps running if you leave this page.</p>
            </div>

            <button
                className="btn btn-primary mt-5 w-full"
                onClick={handleStart}
                disabled={startPublishMutation.isPending || pendingContents === 0}
            >
                <Play /> {startPublishMutation.isPending ? 'Starting...' : 'Start auto publish'}
            </button>
        </div>
    )
}
