import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@heroui/react'
import { Save, Trash2, Eye, EyeOff, Send, FileEdit, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { contentApi, type ManualPublishStatus } from '../../lib/api'
import { RichTextEditor } from '../../components/RichTextEditor'
import { PageHeader, StatusBadge } from '../../components/ui'

export const Route = createFileRoute('/contents/$contentId')({
  component: ContentEditPage,
})

const STATUS_DONE: Record<ManualPublishStatus, string> = {
  published: 'Saved and published',
  draft: 'Saved as draft',
  pending: 'Saved and added to the publish queue',
}

function ContentEditPage() {
  const { contentId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPreview, setShowPreview] = useState(true)
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    metaDescription: '',
    htmlContent: '',
    tags: '',
  })

  const { data: content, isLoading } = useQuery({
    queryKey: ['content', contentId],
    queryFn: async () => (await contentApi.getById(contentId)).data,
  })

  // Initialise the form once per article, so refetches never wipe unsaved edits
  useEffect(() => {
    if (content && initializedFor !== content.id) {
      setFormData({
        title: content.title || '',
        metaDescription: content.metaDescription || '',
        htmlContent: content.content || '',
        tags: content.tags || '',
      })
      setInitializedFor(content.id)
    }
  }, [content, initializedFor])

  const backToProject = () => {
    if (content?.projectId) {
      navigate({ to: '/projects/$projectId', params: { projectId: content.projectId } })
    } else {
      navigate({ to: '/projects' })
    }
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['content', contentId] })
    queryClient.invalidateQueries({ queryKey: ['contents'] })
    queryClient.invalidateQueries({ queryKey: ['org-contents'] })
    queryClient.invalidateQueries({ queryKey: ['drafts'] })
    queryClient.invalidateQueries({ queryKey: ['project-stats'] })
    queryClient.invalidateQueries({ queryKey: ['overall-stats'] })
  }

  const fields = () => ({
    title: formData.title,
    metaDescription: formData.metaDescription,
    content: formData.htmlContent,
    tags: formData.tags,
  })

  const updateMutation = useMutation({
    mutationFn: async () => contentApi.update(contentId, fields()),
    onSuccess: () => {
      toast.success('Content saved')
      invalidate()
    },
    onError: () => toast.error('Failed to save content'),
  })

  // Save edits and change status in one step (manual publish / draft / queue)
  const statusMutation = useMutation({
    mutationFn: async (status: ManualPublishStatus) => {
      await contentApi.update(contentId, fields())
      await contentApi.bulkStatus([contentId], status)
      return status
    },
    onSuccess: (status) => {
      toast.success(STATUS_DONE[status])
      invalidate()
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => contentApi.delete(contentId),
    onSuccess: () => {
      toast.success('Content deleted')
      invalidate()
      backToProject()
    },
    onError: () => toast.error('Failed to delete content'),
  })

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this content?')) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const status = content?.publishStatus ?? 'pending'
  const busy = updateMutation.isPending || statusMutation.isPending

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={
          content?.projectId
            ? { to: '/projects/$projectId', params: { projectId: content.projectId }, label: 'Back to project' }
            : { to: '/projects', label: 'Projects' }
        }
        title="Edit content"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="font-mono text-xs text-gray-500">/{content?.slug}</span>
          </span>
        }
        actions={
          <>
            <button className="btn btn-danger-ghost" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 /> {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
            <button className="btn btn-primary" onClick={() => updateMutation.mutate()} disabled={busy}>
              <Save /> {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Edit form */}
        <div className="space-y-6">
          <div className="surface p-5 sm:p-6">
            <h2 className="section-title mb-5">SEO fields</h2>
            <div className="space-y-5">
              <div>
                <label className="label" htmlFor="title">Title</label>
                <input
                  id="title"
                  type="text"
                  className="field"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <p className="hint">Page title for SEO</p>
              </div>

              <div>
                <label className="label" htmlFor="meta">Meta description</label>
                <textarea
                  id="meta"
                  className="field"
                  rows={3}
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                />
                <p className={`hint ${formData.metaDescription.length > 160 ? 'text-amber-600' : ''}`}>
                  {formData.metaDescription.length} chars (150–160 recommended)
                </p>
              </div>

              <div>
                <label className="label" htmlFor="tags">Tags</label>
                <input
                  id="tags"
                  type="text"
                  className="field"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                />
                <p className="hint">Comma-separated tags</p>
              </div>
            </div>
          </div>

          <div className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">HTML content</h2>
            <RichTextEditor
              value={formData.htmlContent}
              onChange={(html) => setFormData({ ...formData, htmlContent: html })}
              label=""
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Publishing */}
          <div className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Publishing</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mb-4 text-sm text-gray-500">
              {status === 'draft' && 'This article is a draft. Auto-publish skips it until you publish or queue it.'}
              {status === 'pending' && 'Queued: the next auto-publish job will publish this article.'}
              {status === 'published' && 'This article is live.'}
              {status === 'failed' && 'Publishing failed. Queue it again or publish it manually.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {status !== 'published' && (
                <button className="btn btn-success" disabled={busy} onClick={() => statusMutation.mutate('published')}>
                  <Send /> Save &amp; publish now
                </button>
              )}
              {status !== 'draft' && (
                <button className="btn btn-secondary" disabled={busy} onClick={() => statusMutation.mutate('draft')}>
                  <FileEdit /> {status === 'published' ? 'Unpublish to draft' : 'Save as draft'}
                </button>
              )}
              {status !== 'pending' && status !== 'published' && (
                <button className="btn btn-secondary" disabled={busy} onClick={() => statusMutation.mutate('pending')}>
                  <Clock /> Add to queue
                </button>
              )}
            </div>
            <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{content?.createdAt ? new Date(content.createdAt).toLocaleString() : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Published</dt>
                <dd className="text-gray-900">{content?.publishedAt ? new Date(content.publishedAt).toLocaleString() : '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Preview */}
          <div className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Preview</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <><EyeOff /> Hide</> : <><Eye /> Show</>}
              </button>
            </div>

            {showPreview && (
              <div className="space-y-5">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Search preview</p>
                  <p className="truncate text-lg font-medium text-blue-700">{formData.title || 'Untitled'}</p>
                  <p className="truncate text-xs text-emerald-700">/{content?.slug}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{formData.metaDescription || 'No meta description'}</p>
                  {formData.tags && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {formData.tags.split(',').filter((t) => t.trim()).map((tag, index) => (
                        <span key={index} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Rendered HTML</p>
                  <div
                    className="prose-sm max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: formData.htmlContent }}
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Raw HTML</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-emerald-300">
                    {formData.htmlContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
