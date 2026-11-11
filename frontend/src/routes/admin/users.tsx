import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Pencil, Shield, UserCheck, UserPlus, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminUsersApi } from '../../lib/admin-api'
import { CreateUserModal } from '../../components/admin/CreateUserModal'
import { EditUserModal } from '../../components/admin/EditUserModal'
import { ActiveBadge, AdminSearch, AdminTable, AdminToolbar, apiError } from '../../components/admin/AdminParts'
import { useConfirm } from '../../components/Modal'
import { formatDate } from '../../components/ui'
import { useAuth } from '../../contexts/auth-context'

export const Route = createFileRoute('/admin/users')({
  component: AdminUsersPage,
})

type Filter = 'all' | 'active' | 'inactive' | 'superadmin'

function AdminUsersPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { user: me } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, debounced, filter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (debounced) params.search = debounced
      if (filter === 'active') params.isActive = true
      if (filter === 'inactive') params.isActive = false
      if (filter === 'superadmin') params.isSuperAdmin = true
      return (await adminUsersApi.getAll(params)).data
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })

  const toggleActive = useMutation({
    mutationFn: async (user: any) => adminUsersApi.update(user.id, { isActive: !user.isActive }),
    onSuccess: (_d, user) => {
      refresh()
      toast.success(user.isActive ? 'User deactivated' : 'User activated')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to update user')),
  })

  const createUser = useMutation({
    mutationFn: async (d: { email: string; password: string; name: string; isSuperAdmin: boolean }) => adminUsersApi.create(d),
    onSuccess: () => {
      refresh()
      toast.success('User created')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to create user')),
  })

  const updateUser = useMutation({
    mutationFn: async (d: { id: string; name?: string; email?: string }) => adminUsersApi.update(d.id, { name: d.name, email: d.email }),
    onSuccess: () => {
      refresh()
      toast.success('User updated')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to update user')),
  })

  const handleToggle = async (user: any) => {
    if (user.isActive) {
      const ok = await confirm({
        title: `Deactivate ${user.name}?`,
        message: `${user.email} will not be able to sign in until the account is activated again.`,
        confirmText: 'Deactivate',
      })
      if (!ok) return
    }
    toggleActive.mutate(user)
  }

  const users = data?.data || []

  return (
    <>
      <div className="surface overflow-hidden">
        <AdminToolbar>
          <AdminSearch value={search} onChange={setSearch} placeholder="Search by name or email..." />
          <div className="flex gap-2">
            <select
              className="field w-full sm:w-44"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as Filter)
                setPage(1)
              }}
              aria-label="Filter users"
            >
              <option value="all">All users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="superadmin">Super admins</option>
            </select>
            <button className="btn btn-primary shrink-0" onClick={() => setShowCreate(true)}>
              <UserPlus /> Add user
            </button>
          </div>
        </AdminToolbar>

        <AdminTable
          isLoading={isLoading}
          isEmpty={users.length === 0}
          emptyText={debounced || filter !== 'all' ? 'No users match your filters.' : 'No users yet.'}
          page={page}
          totalPages={data?.totalPages || 0}
          onPage={setPage}
          head={
            <tr>
              <th className="px-5 py-2.5">User</th>
              <th className="px-3 py-2.5">Organizations</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Created</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          }
        >
          {users.map((user: any) => (
            <tr key={user.id} className="hover:bg-gray-50/70">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium whitespace-nowrap text-gray-900">{user.name}</p>
                  {user.isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-violet-700 ring-1 ring-violet-200 ring-inset">
                      <Shield className="h-3 w-3" /> Super admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{user.email}</p>
              </td>
              <td className="px-3 py-3 text-gray-600 tabular-nums">{user.organizationCount ?? 0}</td>
              <td className="px-3 py-3">
                <ActiveBadge active={user.isActive} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatDate(user.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(user)} title="Edit" aria-label={`Edit ${user.name}`}>
                    <Pencil />
                  </button>
                  {user.id !== me?.id && (
                    <button
                      className={`btn btn-sm ${user.isActive ? 'btn-danger-ghost' : 'text-emerald-700 hover:bg-emerald-50'}`}
                      onClick={() => handleToggle(user)}
                      disabled={toggleActive.isPending}
                    >
                      {user.isActive ? <UserX /> : <UserCheck />}
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <CreateUserModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSave={async (d) => { await createUser.mutateAsync(d) }} />
      <EditUserModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        user={editing}
        onSave={async (d) => { await updateUser.mutateAsync({ id: editing.id, ...d }) }}
      />
    </>
  )
}
