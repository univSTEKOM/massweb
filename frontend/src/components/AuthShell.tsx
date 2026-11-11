import { Link } from '@tanstack/react-router'
import { CheckCircle2, Eye, EyeOff, FileEdit, FolderKanban, Layers, Zap } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
    const [visible, setVisible] = useState(false)
    return (
        <div className="relative">
            <input {...props} type={visible ? 'text' : 'password'} className={`field pr-10 ${props.className ?? ''}`} />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 transition-colors hover:text-gray-700"
                aria-label={visible ? 'Hide password' : 'Show password'}
                tabIndex={-1}
            >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    )
}

const HIGHLIGHTS = [
    { icon: Layers, text: 'Generate thousands of SEO pages from CSV data' },
    { icon: FileEdit, text: 'Park articles as drafts and publish manually' },
    { icon: Zap, text: 'Delayed auto-publish to stay under the radar' },
]

interface AuthShellProps {
    title: string
    subtitle: ReactNode
    children: ReactNode
    footer?: ReactNode
}

/** Split-screen layout shared by the login and register pages. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
    return (
        <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Brand panel */}
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 p-12 text-white lg:flex lg:flex-col">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                        backgroundSize: '44px 44px',
                        maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
                    }}
                />
                <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-purple-400/30 blur-3xl" />

                <Link to="/" className="relative flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                        <FolderKanban className="h-5 w-5" />
                    </span>
                    <span className="text-lg font-semibold tracking-tight">Massweb</span>
                </Link>

                <div className="relative my-auto max-w-md">
                    <h2 className="text-4xl leading-tight font-semibold tracking-tight">
                        Mass marketing SEO, under control.
                    </h2>
                    <p className="mt-4 text-base text-blue-100">
                        Generate, review and publish content at scale from one dashboard.
                    </p>
                    <ul className="mt-10 space-y-4">
                        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3 text-sm text-blue-50">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                                    <Icon className="h-4 w-4" />
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative flex items-center gap-2 text-xs text-blue-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Secure sign-in · your data stays in your organization
                </p>
            </aside>

            {/* Form panel */}
            <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
                <Link to="/" className="flex items-center gap-2.5 lg:hidden">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-sm">
                        <FolderKanban className="h-4 w-4 text-white" />
                    </span>
                    <span className="text-lg font-semibold tracking-tight text-gray-900">Massweb</span>
                </Link>

                <div className="mx-auto my-auto w-full max-w-sm py-10">
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
                    <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
                    <div className="mt-8">{children}</div>
                    {footer && <div className="mt-8 text-center text-sm text-gray-500">{footer}</div>}
                </div>

                <p className="text-center text-xs text-gray-400">© {new Date().getFullYear()} Massweb</p>
            </main>
        </div>
    )
}
