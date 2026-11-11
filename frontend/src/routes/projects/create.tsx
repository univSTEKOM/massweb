import { createFileRoute, useNavigate, redirect, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { projectsApi, csvApi, contentApi, categoriesApi } from '../../lib/api'
import type { Category } from '../../lib/api'
import { useDropzone } from 'react-dropzone'
import { Upload, Layers, Copy, Building2, Tag, Plus, FileEdit, Clock } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ThumbnailUpload } from '../../components/ThumbnailUpload'
import { useOrganization } from '../../contexts/organization-context'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/projects/create')({
    component: CreateProjectPage,
    beforeLoad: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw redirect({ to: '/login' })
        }
    },
})

function CreateProjectPage() {
    const navigate = useNavigate()
    const { currentOrganization } = useOrganization()

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        template: '',
        titleTemplate: '',
        metaDescriptionTemplate: '',
        tagsTemplate: '',
        slugTemplate: '',
    })
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    // Save generated articles as drafts (manual publish) instead of the auto-publish queue
    const [generateAsDraft, setGenerateAsDraft] = useState(false)
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [csvColumns, setCsvColumns] = useState<string[]>([])
    const [errors, setErrors] = useState<string[]>([])
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Fetch organization categories
    const { data: categories = [] } = useQuery({
        queryKey: ['categories', currentOrganization?.id],
        queryFn: async () => {
            if (!currentOrganization?.id) return [];
            const res = await categoriesApi.getByOrganization(currentOrganization.id);
            return res.data;
        },
        enabled: !!currentOrganization?.id,
    });

    // Helper function to format column name for Handlebars template
    // Columns with spaces need bracket notation: {{[Column Name]}}
    const formatHandlebarsVar = (columnName: string): string => {
        // Check if column name contains spaces or special characters
        if (/\s/.test(columnName) || !/^\w+$/.test(columnName)) {
            return `{{[${columnName}]}}`
        }
        return `{{${columnName}}}`
    }

    const toggleCategory = (categoryId: string) => {
        setSelectedCategoryIds(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        )
    }

    const createProjectMutation = useMutation({
        mutationFn: async () => {
            const validationErrors: string[] = []
            if (!currentOrganization) validationErrors.push('No organization selected')
            if (!formData.name.trim()) validationErrors.push('Project name is required')
            if (!formData.template.trim()) validationErrors.push('Template is required')

            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join(', '))
            }

            setErrors([])

            try {
                // Create project payload with current organization and category IDs
                const projectPayload = {
                    ...formData,
                    organizationId: currentOrganization!.id,
                    categoryIds: selectedCategoryIds,
                }

                console.log('Creating project...', projectPayload)
                const projectResponse = await Promise.race([
                    projectsApi.create(projectPayload),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Project creation timed out')), 30000)
                    )
                ]) as any
                console.log('Project created:', projectResponse.data)

                const project = projectResponse.data

                // Upload thumbnail if provided
                if (thumbnailFile) {
                    console.log('Uploading thumbnail...')
                    await projectsApi.uploadThumbnail(project.id, thumbnailFile)
                    console.log('Thumbnail uploaded')
                }

                if (csvFile) {
                    console.log('Uploading CSV...')
                    await Promise.race([
                        csvApi.upload(project.id, csvFile),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('CSV upload timed out after 2 minutes')), 120000)
                        )
                    ])
                    console.log('CSV uploaded')
                }

                console.log('Starting generation...')
                // Use synchronous generation (no Redis required)
                const result = await Promise.race([
                    contentApi.generateSync(project.id, { asDraft: generateAsDraft }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Generation timed out after 5 minutes')), 300000)
                    )
                ]) as { data: { generatedCount: number } }
                console.log('Generation completed:', result.data?.generatedCount || 0, 'items')

                // Navigate to project page after short delay
                setTimeout(() => {
                    navigate({ to: `/projects/${project.id}` })
                }, 1500)

                return { project }
            } catch (error: any) {
                console.error('Create project error:', error)
                throw error
            }
        },
        onSuccess: ({ project }) => {
            console.log('Success! Project created:', project.id)
            setSuccessMessage('Project created and content generated successfully! Redirecting...')
            toast.success('Content generated successfully!')
        },
        onError: (error: any) => {
            console.error('Mutation error:', error)
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create project'
            setErrors([errorMessage])
            toast.error(errorMessage)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        },
    })

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        maxFiles: 1,
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                const file = acceptedFiles[0]
                setCsvFile(file)

                const fileName = file.name.toLowerCase()

                if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    // Parse Excel file for column preview
                    try {
                        const arrayBuffer = await file.arrayBuffer()
                        const XLSX = await import('xlsx')
                        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
                        const sheetName = workbook.SheetNames[0]
                        const sheet = workbook.Sheets[sheetName]
                        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
                        if (jsonData.length > 0) {
                            const headers = jsonData[0].map((h: any) => String(h).trim())
                            setCsvColumns(headers)
                            console.log('Excel columns:', headers)
                        }
                    } catch (error) {
                        console.error('Error parsing Excel file:', error)
                        toast.error('Error parsing Excel file')
                    }
                } else {
                    // Parse CSV file
                    const text = await file.text()
                    const firstLine = text.split('\n')[0]

                    let delimiter = ','
                    if (firstLine.includes(';')) delimiter = ';'
                    else if (firstLine.includes('\t')) delimiter = '\t'
                    else if (firstLine.includes('|')) delimiter = '|'

                    Papa.parse(file, {
                        header: true,
                        preview: 1,
                        delimiter: delimiter,
                        complete: (results: any) => {
                            console.log('Detected delimiter:', delimiter)
                            console.log('Detected fields:', results.meta.fields)
                            if (results.meta.fields) {
                                setCsvColumns(results.meta.fields)
                            }
                        }
                    })
                }
            }
        },
    })

    const handleSubmit = () => {
        createProjectMutation.mutate()
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <PageHeader
                back={{ to: '/projects', label: 'Projects' }}
                title="Create new project"
                description="Set up your mass marketing SEO campaign"
            />

            {errors.length > 0 && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                    <div className="space-y-2">
                        {errors.map((error, index) => (
                            <div key={index} className="flex items-start gap-2 text-red-700">
                                <span className="text-red-500 font-bold">✕</span>
                                <span>{error}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <div className="flex items-center gap-2 text-green-700">
                        <span className="text-green-500 font-bold">✓</span>
                        <span>{successMessage}</span>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="surface p-5 sm:p-6">
                    <h2 className="mb-5 text-lg font-semibold tracking-tight text-gray-900">Project Details</h2>
                    <div className="space-y-4">
                        {/* Current Organization Display */}
                        <div>
                            <label className="label">
                                Organization
                            </label>
                            {currentOrganization ? (
                                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                                    <Building2 className="w-5 h-5 text-blue-600" />
                                    <span className="font-medium text-blue-800 dark:text-blue-200">
                                        {currentOrganization.name}
                                    </span>
                                </div>
                            ) : (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800">
                                        No organization selected. Please select an organization from the header.
                                    </p>
                                </div>
                            )}
                            <p className="hint">Project will be created in this organization</p>
                        </div>

                        <div>
                            <label className="label">
                                Project Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="field"
                                placeholder="My SEO Campaign"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}

                            />
                            <p className="hint">Give your project a descriptive name</p>
                        </div>
                        <div>
                            <label className="label">Description</label>
                            <textarea
                                className="field"
                                placeholder="Describe your project..."
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}

                            />
                            <p className="hint">Optional project description</p>
                        </div>

                        {/* Thumbnail Upload */}
                        <div>
                            <ThumbnailUpload
                                onUpload={async (file) => {
                                    setThumbnailFile(file)
                                    toast.success('Thumbnail ready to upload')
                                }}
                            />
                        </div>

                        {/* Categories Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium">Categories</label>
                                {currentOrganization && (
                                    <Link
                                        to="/organizations/$organizationId/categories"
                                        params={{ organizationId: currentOrganization.id }}
                                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Manage Categories
                                    </Link>
                                )}
                            </div>
                            {categories.length > 0 ? (
                                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                    {categories.map((category: Category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => toggleCategory(category.id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${selectedCategoryIds.includes(category.id)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white dark:bg-gray-700 border hover:border-blue-400'
                                                }`}
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: category.color || '#3B82F6' }}
                                            />
                                            {category.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                                    <Tag className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">No categories available</p>
                                    {currentOrganization && (
                                        <Link
                                            to="/organizations/$organizationId/categories"
                                        params={{ organizationId: currentOrganization.id }}
                                            className="text-sm text-blue-600 hover:text-blue-700"
                                        >
                                            Create categories
                                        </Link>
                                    )}
                                </div>
                            )}
                            <p className="hint">Select categories to organize this project</p>
                        </div>
                    </div>
                </div>

                <div className="surface p-5 sm:p-6">
                    <h2 className="mb-5 text-lg font-semibold tracking-tight text-gray-900">
                        Upload Data File
                        {csvFile && <span className="text-sm font-normal text-green-600 ml-2">✓ File uploaded</span>}
                    </h2>
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        {csvFile ? (
                            <div>
                                <p className="text-lg font-semibold text-green-600">{csvFile.name}</p>
                                <p className="text-sm text-gray-500">
                                    {csvColumns.length} column{csvColumns.length !== 1 ? 's' : ''} detected
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{(csvFile.size / 1024).toFixed(2)} KB</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-lg font-semibold mb-2">Drop your CSV or Excel file here</p>
                                <p className="text-sm text-gray-500">or click to browse</p>
                                <p className="text-xs text-gray-400 mt-2">Supports .csv, .xlsx, .xls files</p>
                            </div>
                        )}
                    </div>
                    {csvColumns.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                Detected columns: {csvColumns.join(', ')}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Use these in your template. For columns with spaces, use bracket notation: {'{{[Column Name]}}'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="surface p-5 sm:p-6">
                    <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">HTML Template</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Use variables like <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{'{{columnName}}'}</code> to insert CSV data.
                        {csvColumns.length > 0 && ' Click variable chips below to copy them.'}
                    </p>

                    {csvColumns.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Available Variables (Click to Copy):</p>
                            <div className="flex flex-wrap gap-2">
                                {csvColumns.map(col => {
                                    const varSyntax = formatHandlebarsVar(col)
                                    return (
                                        <button
                                            key={col}
                                            onClick={() => {
                                                navigator.clipboard.writeText(varSyntax)
                                                toast.success(`Copied ${varSyntax}`, { duration: 2000 })
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm flex items-center gap-1 transition-colors"
                                        >
                                            <Copy className="w-3 h-3" />
                                            {varSyntax}
                                        </button>
                                    )
                                })}
                            </div>
                            {csvColumns.some(col => /\s/.test(col)) && (
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                    💡 Columns with spaces use bracket notation: {'{{[Column Name]}}'}
                                </p>
                            )}
                        </div>
                    )}

                    <RichTextEditor
                        value={formData.template}
                        onChange={(html) => setFormData({ ...formData, template: html })}
                        label=""
                    />

                    <div className="space-y-4 mt-4">
                        <div>
                            <label className="label">Title Template</label>
                            <input
                                type="text"
                                className="field"
                                placeholder="{{title}} - My Site"
                                value={formData.titleTemplate}
                                onChange={(e) => setFormData({ ...formData, titleTemplate: e.target.value })}

                            />
                            <p className="hint">
                                Used for page title and SEO. <strong>Columns in this template determine content combinations.</strong> Slug will be generated from the title.
                                {csvColumns.length > 0 && (
                                    <span className="text-blue-600 font-medium">
                                        {' '}Available: {csvColumns.join(', ')}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div>
                            <label className="label">Meta Description Template</label>
                            <textarea
                                className="field"
                                placeholder="{{description}}"
                                rows={2}
                                value={formData.metaDescriptionTemplate}
                                onChange={(e) => setFormData({ ...formData, metaDescriptionTemplate: e.target.value })}

                            />
                            <p className="hint">SEO meta description (150-160 chars recommended)</p>
                        </div>
                        <div>
                            <label className="label">Tags Template</label>
                            <input
                                type="text"
                                className="field"
                                placeholder="{{category}}, {{type}}, SEO"
                                value={formData.tagsTemplate}
                                onChange={(e) => setFormData({ ...formData, tagsTemplate: e.target.value })}

                            />
                            <p className="hint">Comma-separated tags for content organization</p>
                        </div>
                    </div>
                </div>

                <div className="surface p-5 sm:p-6">
                    <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">After generating</h2>
                    <p className="mb-4 text-sm text-gray-500">Choose where the generated articles go.</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                            { draft: false, icon: <Clock className="h-4 w-4" />, title: 'Publish queue', desc: 'Ready for Auto Publish (published one by one with a delay).' },
                            { draft: true, icon: <FileEdit className="h-4 w-4" />, title: 'Save as drafts', desc: 'Kept private. Review them, then publish manually when ready.' },
                        ].map((opt) => (
                            <button
                                key={String(opt.draft)}
                                type="button"
                                onClick={() => setGenerateAsDraft(opt.draft)}
                                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${generateAsDraft === opt.draft ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/15' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${generateAsDraft === opt.draft ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                    {opt.icon}
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-gray-900">{opt.title}</span>
                                    <span className="mt-0.5 block text-sm text-gray-500">{opt.desc}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate({ to: '/projects' })}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleSubmit}
                        disabled={!formData.name || createProjectMutation.isPending}
                    >
                        <Layers />
                        {createProjectMutation.isPending ? 'Processing...' : generateAsDraft ? 'Create & generate drafts' : 'Create & generate'}
                    </button>
                </div>
            </div>
        </div>
    )
}
