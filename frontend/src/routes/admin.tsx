import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Briefcase, Building2, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '../contexts/auth-context'
import { PageHeader } from '../components/ui'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

const TABS = [
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/jobs', label: 'Publish jobs', icon: Briefcase },
] as const

function AdminLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (!user?.isSuperAdmin) {
      navigate({ to: '/projects' })
    } else if (pathname === '/admin' || pathname === '/admin/') {
      // /admin has no page of its own: open the first tab
      navigate({ to: '/admin/organizations', replace: true })
    }
  }, [user, navigate, pathname])

  if (!user?.isSuperAdmin) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Super admin" description="Manage every organization, user and publish job in the system." />

      <div className="-mx-1 mb-6 overflow-x-auto px-1">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-gray-500 transition hover:text-gray-800"
              activeProps={{ className: '!bg-white !text-gray-900 shadow-sm' }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  )
}
