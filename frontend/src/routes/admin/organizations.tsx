import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, Pencil, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminOrganizationsApi } from '../../lib/admin-api'
import { EditOrganizationModal } from '../../components/admin/EditOrganizationModal'
import { ManageOrgMembersModal } from '../../components/admin/ManageOrgMembersModal'
import { ActiveBadge, AdminSearch, AdminTable, AdminToolbar, apiError } from '../../components/admin/AdminParts'
import { useConfirm } from '../../components/Modal'
import { formatDate } from '../../components/ui'

export const Route = createFileRoute('/admin/organizations')({
  component: AdminOrganizationsPage,
})

function AdminOrganizationsPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [addingTo, setAddingTo] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-organizations', page, debounced],
    queryFn: async () => (await adminOrganizationsApi.getAll({ page, limit: 20, search: debounced || undefined })).data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-organizations'] })

  const toggleActive = useMutation({
    mutationFn: async (org: any) => adminOrganizationsApi.update(org.id, { isActive: !org.isActive }),
    onSuccess: (_d, org) => {
      refresh()
      toast.success(org.isActive ? 'Organization deactivated' : 'Organization activated')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to update organization')),
  })

  const updateOrg = useMutation({
    mutationFn: async (d: { id: string; name: string }) => adminOrganizationsApi.update(d.id, { name: d.name }),
    onSuccess: () => {
      refresh()
      toast.success('Organization updated')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to update organization')),
  })

  const addMember = useMutation({
    mutationFn: async (d: { orgId: string; email: string; role: string }) => adminOrganizationsApi.addMember(d.orgId, { email: d.email, role: d.role }),
    onSuccess: () => {
      refresh()
      toast.success('Member added')
    },
    onError: (error) => toast.error(apiError(error, 'Failed to add member')),
  })

  const handleToggle = async (org: any) => {
    if (org.isActive) {
      const ok = await confirm({
        title: `Deactivate ${org.name}?`,
        message: `All ${org.memberCount ?? ''} members lose access to its projects until it is activated again.`,
        confirmText: 'Deactivate',
      })
      if (!ok) return
    }
    toggleActive.mutate(org)
  }

  const orgs = data?.data || []

  return (
    <>
      <div className="surface overflow-hidden">
        <AdminToolbar>
          <AdminSearch value={search} onChange={setSearch} placeholder="Search organizations..." />
          {data && <span className="text-sm text-gray-500 tabular-nums sm:ml-auto">{data.total ?? orgs.length} organizations</span>}
        </AdminToolbar>

        <AdminTable
          isLoading={isLoading}
          isEmpty={orgs.length === 0}
          emptyText={debounced ? 'No organizations match your search.' : 'No organizations yet.'}
          page={page}
          totalPages={data?.totalPages || 0}
          onPage={setPage}
          head={
            <tr>
              <th className="px-5 py-2.5">Organization</th>
              <th className="px-3 py-2.5">Members</th>
              <th className="px-3 py-2.5">Projects</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Created</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          }
        >
          {orgs.map((org: any) => (
            <tr key={org.id} className="hover:bg-gray-50/70">
              <td className="px-5 py-3">
                <p className="font-medium text-gray-900">{org.name}</p>
                <p className="font-mono text-xs text-gray-500">{org.slug}</p>
              </td>
              <td className="px-3 py-3 text-gray-600 tabular-nums">{org.memberCount ?? 0}</td>
              <td className="px-3 py-3 text-gray-600 tabular-nums">{org.projectCount ?? 0}</td>
              <td className="px-3 py-3">
                <ActiveBadge active={org.isActive} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-gray-600">{formatDate(org.createdAt)}</td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(org)} title="Rename" aria-label={`Rename ${org.name}`}>
                    <Pencil />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAddingTo(org)} title="Add member" aria-label={`Add member to ${org.name}`}>
                    <UserPlus />
                  </button>
                  <button
                    className={`btn btn-sm ${org.isActive ? 'btn-danger-ghost' : 'text-emerald-700 hover:bg-emerald-50'}`}
                    onClick={() => handleToggle(org)}
                    disabled={toggleActive.isPending}
                  >
                    {org.isActive ? <Ban /> : <CheckCircle2 />}
                    {org.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <EditOrganizationModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        organization={editing}
        onSave={async (d) => { await updateOrg.mutateAsync({ id: editing.id, name: d.name }) }}
      />
      <ManageOrgMembersModal
        isOpen={!!addingTo}
        onClose={() => setAddingTo(null)}
        organizationId={addingTo?.id ?? ''}
        organizationName={addingTo?.name ?? ''}
        onAdd={async (email, role) => { await addMember.mutateAsync({ orgId: addingTo.id, email, role }) }}
      />
    </>
  )
}
