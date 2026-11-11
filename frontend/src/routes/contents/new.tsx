import { createFileRoute, useNavigate, redirect, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Braces, Building2, CheckCircle2, Clock, FileEdit, LayoutTemplate, Loader2, PenLine, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { contentApi, projectsApi, type ManualPublishStatus } from '../../lib/api'
import { useOrganization } from '../../contexts/organization-context'
import { RichTextEditor } from '../../components/RichTextEditor'
import { PageHeader } from '../../components/ui'

export const Route = createFileRoute('/contents/new')({
  component: NewArticlePage,
  validateSearch: (search: Record<string, unknown>): { projectId?: string } => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
})

type Mode = 'template' | 'manual'

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const STATUS_OPTIONS: { value: ManualPublishStatus; label: string; desc: string; icon: typeof FileEdit }[] = [
  { value: 'draft', label: 'Save as draft', desc: 'Private. Publish it manually later.', icon: FileEdit },
  { value: 'pending', label: 'Add to queue', desc: 'Published by the next Auto Publish run.', icon: Clock },
  { value: 'published', label: 'Publish now', desc: 'Goes live immediately.', icon: Send },
]

function NewArticlePage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentOrganization } = useOrganization()

  const [projectId, setProjectId] = useState(search.projectId ?? '')
  const [mode, setMode] = useState<Mode>('template')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ title: '', slug: '', metaDescription: '', tags: '', content: '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<ManualPublishStatus>('draft')

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', currentOrganization?.id],
    queryFn: async () => (await projectsApi.getAll(currentOrganization?.id)).data,
    enabled: !!currentOrganization,
  })

  // Default to the first project once projects load
  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [projects, projectId])

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

  const { data: fieldsData, isLoading: fieldsLoading } = useQuery({
    queryKey: ['template-fields', projectId],
    queryFn: async () => (await contentApi.getTemplateFields(projectId)).data,
    enabled: !!projectId,
  })
  const fields = fieldsData?.fields ?? []

  // Reset variables when switching project
  useEffect(() => {
    setVariables({})
  }, [projectId])

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'title' && !slugTouched) next.slug = slugify(value)
      return next
    })
  }

  const renderMutation = useMutation({
    mutationFn: async () => (await contentApi.renderTemplate(projectId, variables)).data,
    onSuccess: (rendered) => {
      setForm((prev) => ({
        title: rendered.title,
        slug: slugTouched ? prev.slug : rendered.slug,
        metaDescription: rendered.metaDescription,
        tags: rendered.tags,
        content: rendered.content,
      }))
      toast.success('Filled from the project template. You can still edit everything.')
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to render template'),
  })

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await contentApi.createSingle(projectId, {
          title: form.title,
          slug: form.slug,
          metaDescription: form.metaDescription,
          tags: form.tags,
          content: form.content,
          status,
          variables: mode === 'template' ? variables : undefined,
        })
      ).data,
    onSuccess: (article) => {
      const msg = { draft: 'Article saved as draft', pending: 'Article added to the publish queue', published: 'Article published' }[status]
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['contents'] })
      queryClient.invalidateQueries({ queryKey: ['org-contents'] })
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
      queryClient.invalidateQueries({ queryKey: ['project-stats'] })
      queryClient.invalidateQueries({ queryKey: ['overall-stats'] })
      navigate({ to: '/contents/$contentId', params: { contentId: article.id } })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Failed to create article')
    },
  })

  const isEmptyContent = !form.content || form.content.replace(/<[^>]*>/g, '').trim() === ''
  const canSubmit = !!projectId && form.title.trim() !== '' && !isEmptyContent && !createMutation.isPending
  const filledVariables = fields.filter((f) => (variables[f] ?? '').trim() !== '').length

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-900">No organization selected</h2>
        <p className="mt-1 text-sm text-gray-500">Select an organization from the header first.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={
          search.projectId
            ? { to: '/projects/$projectId', params: { projectId: search.projectId }, label: 'Back to project' }
            : { to: '/contents', label: 'Contents' }
        }
        title="New article"
        description="Create a single article, separate from mass generation. It is kept even when the project is regenerated."
      />

      {!projectsLoading && projects.length === 0 ? (
        <div className="surface mx-auto max-w-lg p-8 text-center">
          <h3 className="font-semibold text-gray-900">No projects yet</h3>
          <p className="mt-1 text-sm text-gray-500">An article belongs to a project. Create a project first.</p>
          <Link to="/projects/create" className="btn btn-primary btn-sm mt-5">
            Create project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column */}
          <div className="space-y-6">
            {/* 1. Project + mode */}
            <div className="surface p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="project">Project</label>
                  <select id="project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Uses this project&apos;s template, categories and thumbnail.</p>
                </div>
                <div>
                  <span className="label">How do you want to write it?</span>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                    {(
                      [
                        { value: 'template', label: 'From template', icon: Braces },
                        { value: 'manual', label: 'Write manually', icon: PenLine },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition ${mode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    {mode === 'template'
                      ? 'Fill in the variables, same as one CSV row.'
                      : 'Write the title and content yourself.'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Template variables */}
            {mode === 'template' && (
              <div className="surface p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="section-title">Template variables</h2>
                    <p className="section-desc">
                      One value per column, like a single CSV row. Then fill the article from the project template.
                    </p>
                  </div>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 tabular-nums">
                    {filledVariables}/{fields.length} filled
                  </span>
                </div>

                {fieldsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : fields.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                    This project&apos;s template has no variables. Switch to <strong>Write manually</strong>, or use
                    &ldquo;Fill from template&rdquo; to start from the template as-is.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div key={field}>
                        <label className="label font-mono text-xs" htmlFor={`var-${field}`}>
                          {`{{${/\s/.test(field) ? `[${field}]` : field}}}`}
                        </label>
                        <input
                          id={`var-${field}`}
                          className="field"
                          placeholder={field}
                          value={variables[field] ?? ''}
                          onChange={(e) => setVariables((prev) => ({ ...prev, [field]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!projectId || renderMutation.isPending}
                    onClick={() => renderMutation.mutate()}
                  >
                    {renderMutation.isPending ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
                    Fill from template
                  </button>
                </div>
              </div>
            )}

            {/* 3. Article */}
            <div className="surface p-5 sm:p-6">
              <h2 className="section-title mb-5">Article</h2>
              <div className="space-y-5">
                <div>
                  <label className="label" htmlFor="title">Title</label>
                  <input
                    id="title"
                    className="field"
                    placeholder="e.g. Jasa Service AC di Semarang"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="slug">Slug</label>
                  <div className="flex items-center rounded-lg border border-gray-300 bg-gray-50 shadow-xs focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15">
                    <span className="pl-3 font-mono text-sm text-gray-400">/</span>
                    <input
                      id="slug"
                      className="h-10 w-full rounded-r-lg bg-transparent px-1 font-mono text-sm outline-none"
                      placeholder="auto-from-title"
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true)
                        setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))
                      }}
                    />
                  </div>
                  <p className="hint">Generated from the title. A number is added automatically if it is already taken.</p>
                </div>
                <div>
                  <label className="label" htmlFor="meta">Meta description</label>
                  <textarea
                    id="meta"
                    className="field"
                    rows={2}
                    value={form.metaDescription}
                    onChange={(e) => setField('metaDescription', e.target.value)}
                  />
                  <p className={`hint ${form.metaDescription.length > 160 ? 'text-amber-600' : ''}`}>
                    {form.metaDescription.length} chars (150–160 recommended)
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="tags">Tags</label>
                  <input
                    id="tags"
                    className="field"
                    placeholder="tag1, tag2"
                    value={form.tags}
                    onChange={(e) => setField('tags', e.target.value)}
                  />
                </div>
                <div>
                  <span className="label">Content</span>
                  <RichTextEditor value={form.content} onChange={(html) => setForm((prev) => ({ ...prev, content: html }))} label="" />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="surface p-5">
              <h2 className="section-title mb-4">Publishing</h2>
              <div className="space-y-2">
                {STATUS_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${status === value ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/15' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${status === value ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{label}</span>
                      <span className="block text-xs text-gray-500">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <button
                className={`btn btn-lg mt-5 w-full ${status === 'published' ? 'btn-success' : 'btn-primary'}`}
                disabled={!canSubmit}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {status === 'published' ? 'Create & publish' : status === 'pending' ? 'Create & queue' : 'Create draft'}
              </button>
              {!canSubmit && !createMutation.isPending && (
                <p className="mt-2 text-center text-xs text-gray-500">A title and content are required.</p>
              )}
            </div>

            <div className="surface p-5">
              <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Search preview</p>
              <p className="truncate text-base font-medium text-blue-700">{form.title || 'Article title'}</p>
              <p className="truncate text-xs text-emerald-700">/{form.slug || 'slug'}</p>
              <p className="mt-1 line-clamp-3 text-sm text-gray-600">{form.metaDescription || 'Meta description'}</p>
              {project && <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">Project: {project.name}</p>}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
