import { FileQuestion } from 'lucide-react'

interface EmptyStateProps {
    icon?: React.ReactNode
    title: string
    description: string
    action?: {
        label: string
        onClick: () => void
    }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center py-14 px-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 mb-4">
                {icon || <FileQuestion className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
                {title}
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                {description}
            </p>
            {action && (
                <button onClick={action.onClick} className="btn btn-primary">
                    {action.label}
                </button>
            )}
        </div>
    )
}
