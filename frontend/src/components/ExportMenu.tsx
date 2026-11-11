import { FileJson, FileSpreadsheet, FileArchive } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface ExportMenuProps {
    projectId: string
    projectName: string
    totalContents: number
}

export function ExportMenu({ projectId, projectName, totalContents }: ExportMenuProps) {
    const [exporting, setExporting] = useState<string | null>(null)

    const handleExport = async (format: 'csv' | 'json' | 'html-zip') => {
        if (totalContents === 0) {
            toast.error('No content to export')
            return
        }

        setExporting(format)
        try {
            const response = await fetch(
                `/api/content-generator/projects/${projectId}/export?format=${format}`
            )

            if (!response.ok) {
                throw new Error('Export failed')
            }

            const blob = await response.blob()
            const extension = format === 'html-zip' ? 'zip' : format
            const filename = `${projectName}-export.${extension}`

            // Download file
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)

            toast.success(`Exported as ${format.toUpperCase()}`)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export content')
        } finally {
            setExporting(null)
        }
    }

    const items: { format: 'csv' | 'json' | 'html-zip'; label: string; icon: React.ReactNode }[] = [
        { format: 'csv', label: 'CSV', icon: <FileSpreadsheet /> },
        { format: 'json', label: 'JSON', icon: <FileJson /> },
        { format: 'html-zip', label: 'HTML ZIP', icon: <FileArchive /> },
    ]

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <button
                    key={item.format}
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleExport(item.format)}
                    disabled={!!exporting || totalContents === 0}
                    title={`Export as ${item.label}`}
                >
                    {item.icon}
                    {exporting === item.format ? 'Exporting...' : item.label}
                </button>
            ))}
        </div>
    )
}
