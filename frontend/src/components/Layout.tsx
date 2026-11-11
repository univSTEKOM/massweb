import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../contexts/auth-context';
import { useEffect, useState } from 'react';
import { LogOut, FolderKanban, Shield, FileText, FileEdit, LayoutDashboard, Megaphone } from 'lucide-react';
import { WhatsNewModal, hasSeenWhatsNew } from './WhatsNewModal';
import { OrganizationSwitcher } from './OrganizationSwitcher';

const linkBase =
    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900';
const linkActive = { className: '!bg-blue-50 !text-blue-700' };

function NavLinks({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
    return (
        <>
            <Link to="/projects" className={linkBase} activeProps={linkActive}>
                <LayoutDashboard className="h-4 w-4" />
                Projects
            </Link>
            <Link to="/contents" className={linkBase} activeProps={linkActive}>
                <FileText className="h-4 w-4" />
                Contents
            </Link>
            <Link to="/drafts" className={linkBase} activeProps={linkActive}>
                <FileEdit className="h-4 w-4" />
                Drafts
            </Link>
            {isSuperAdmin && (
                <Link to="/admin/organizations" className={linkBase} activeProps={{ className: '!bg-purple-50 !text-purple-700' }}>
                    <Shield className="h-4 w-4" />
                    Admin
                </Link>
            )}
        </>
    );
}

export default function Layout() {
    const { user, logout, isAuthenticated } = useAuth();
    const [whatsNewOpen, setWhatsNewOpen] = useState(false);
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const isAuthPage = pathname === '/login' || pathname === '/register';

    // Announce new features once per device per release, right after login
    useEffect(() => {
        if (isAuthenticated && !hasSeenWhatsNew()) {
            setWhatsNewOpen(true);
        }
    }, [isAuthenticated]);
    const initials = (user?.name || user?.email || '?')
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    // Login / register render their own full-screen layout
    if (isAuthPage) {
        return <Outlet />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white/85 backdrop-blur-md">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-6">
                            <Link to="/" className="flex shrink-0 items-center gap-2.5">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-sm">
                                    <FolderKanban className="h-4.5 w-4.5 text-white" />
                                </span>
                                <span className="text-lg font-semibold tracking-tight text-gray-900">Massweb</span>
                            </Link>

                            {isAuthenticated && (
                                <>
                                    <span className="hidden h-6 w-px bg-gray-200 md:block" />
                                    <div className="hidden md:block">
                                        <OrganizationSwitcher />
                                    </div>
                                    <div className="hidden items-center gap-1 lg:flex">
                                        <NavLinks isSuperAdmin={user?.isSuperAdmin} />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {isAuthenticated && user ? (
                                <>
                                    <button
                                        onClick={() => setWhatsNewOpen(true)}
                                        className="btn btn-ghost btn-sm text-blue-700 hover:!bg-blue-50 hover:!text-blue-800"
                                        title="What's new"
                                    >
                                        <Megaphone />
                                        <span className="hidden sm:inline">What&apos;s new</span>
                                    </button>
                                    <div className="flex items-center gap-2.5">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                                            {initials}
                                        </span>
                                        <div className="hidden leading-tight sm:block">
                                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                            <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <button onClick={logout} className="btn btn-ghost btn-sm btn-icon hover:!text-red-600" title="Logout" aria-label="Logout">
                                        <LogOut />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="btn btn-ghost btn-sm">
                                        Sign in
                                    </Link>
                                    <Link to="/register" className="btn btn-primary btn-sm">
                                        Sign up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Compact navigation for tablet / mobile */}
                    {isAuthenticated && (
                        <div className="flex items-center gap-2 pb-3 lg:hidden">
                            {/* Kept outside the scroll area so its dropdown is not clipped */}
                            <div className="shrink-0 md:hidden">
                                <OrganizationSwitcher />
                            </div>
                            <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
                                <NavLinks isSuperAdmin={user?.isSuperAdmin} />
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            <main>
                <Outlet />
            </main>

            <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
        </div>
    );
}
