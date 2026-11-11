import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
interface ModalProps {
    open: boolean
    onClose: () => void
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    footer?: ReactNode
    size?: 'sm' | 'md' | 'lg'
    /** false: Esc / backdrop click do nothing (e.g. while showing a secret that is shown only once) */
    dismissible?: boolean
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

/** Accessible modal: Esc / backdrop click closes, body scroll is locked, bottom sheet on mobile. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissible && onClose()
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose, dismissible])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={dismissible ? onClose : undefined} />
            <div className={`relative flex max-h-[92vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
                    </div>
                    {dismissible && (
                        <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon -mr-2 shrink-0" aria-label="Close">
                            <X />
                        </button>
                    )}
                </div>
                {children && <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3.5 sm:px-6">{footer}</div>}
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Confirm dialog (replaces window.confirm)                            */
/* ------------------------------------------------------------------ */
interface ConfirmOptions {
    title: string
    message?: ReactNode
    confirmText?: string
    cancelText?: string
    tone?: 'danger' | 'primary'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null)
    const resolver = useRef<((value: boolean) => void) | null>(null)

    const confirm = useCallback<ConfirmFn>((opts) => {
        setOptions(opts)
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve
        })
    }, [])

    const settle = (value: boolean) => {
        resolver.current?.(value)
        resolver.current = null
        setOptions(null)
    }

    const danger = (options?.tone ?? 'danger') === 'danger'

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal
                open={!!options}
                onClose={() => settle(false)}
                size="sm"
                title={
                    <span className="flex items-center gap-2.5">
                        {danger && (
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                            </span>
                        )}
                        {options?.title}
                    </span>
                }
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => settle(false)}>
                            {options?.cancelText ?? 'Cancel'}
                        </button>
                        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => settle(true)} autoFocus>
                            {options?.confirmText ?? 'Confirm'}
                        </button>
                    </>
                }
            >
                {options?.message && <div className="text-sm leading-relaxed text-gray-600">{options.message}</div>}
            </Modal>
        </ConfirmContext.Provider>
    )
}

/** `if (await confirm({ title: 'Delete?', confirmText: 'Delete' })) { ... }` */
export function useConfirm(): ConfirmFn {
    const ctx = useContext(ConfirmContext)
    if (!ctx) {
        // Fallback outside the provider (should not happen in the app)
        return async (o) => window.confirm(o.title)
    }
    return ctx
}
