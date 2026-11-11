import { useEffect, useState } from 'react'
import { Check, Loader2, Search, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { adminUsersApi } from '../../lib/admin-api'
import { Modal } from '../Modal'

interface ManageOrgMembersModalProps {
    isOpen: boolean
    onClose: () => void
    organizationId: string
    organizationName: string
    onAdd: (email: string, role: string) => Promise<void>
}

type Role = 'org_admin' | 'org_member'
interface UserHit {
    id: string
    name: string
    email: string
}

export function ManageOrgMembersModal({ isOpen, onClose, organizationName, onAdd }: ManageOrgMembersModalProps) {
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [selectedUser, setSelectedUser] = useState<UserHit | null>(null)
    const [role, setRole] = useState<Role>('org_member')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300)
        return () => clearTimeout(t)
    }, [search])

    const { data: usersData, isFetching } = useQuery({
        queryKey: ['search-users', debounced],
        queryFn: async () => (await adminUsersApi.getAll({ search: debounced, limit: 10 })).data,
        enabled: isOpen && debounced.length >= 2 && !selectedUser,
    })
    const users: UserHit[] = usersData?.data || []

    const reset = () => {
        setSearch('')
        setDebounced('')
        setSelectedUser(null)
        setRole('org_member')
    }

    const close = () => {
        reset()
        onClose()
    }

    const handleAdd = async () => {
        if (!selectedUser) return
        setIsLoading(true)
        try {
            await onAdd(selectedUser.email, role)
            reset()
        } catch {
            // the caller shows the error
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal
            open={isOpen}
            onClose={close}
            title="Add member"
            description={`Add an existing user to ${organizationName}.`}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={close}>Close</button>
                    <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedUser || isLoading}>
                        {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus />}
                        Add member
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className="label" htmlFor="om-search">User</label>
                    {selectedUser ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">{selectedUser.name}</p>
                                <p className="truncate text-xs text-gray-500">{selectedUser.email}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser(null)}>Change</button>
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="om-search"
                                    className="field pl-9"
                                    placeholder="Search by name or email (min. 2 characters)"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {debounced.length >= 2 && (
                                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200">
                                    {isFetching ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                        </div>
                                    ) : users.length === 0 ? (
                                        <p className="px-3 py-4 text-center text-sm text-gray-500">No users found</p>
                                    ) : (
                                        users.map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => setSelectedUser(user)}
                                                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-gray-50"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-medium text-gray-900">{user.name}</span>
                                                    <span className="block truncate text-xs text-gray-500">{user.email}</span>
                                                </span>
                                                <Check className="h-4 w-4 shrink-0 text-transparent" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div>
                    <label className="label" htmlFor="om-role">Role</label>
                    <select id="om-role" className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                        <option value="org_member">Member</option>
                        <option value="org_admin">Admin</option>
                    </select>
                </div>
            </div>
        </Modal>
    )
}
