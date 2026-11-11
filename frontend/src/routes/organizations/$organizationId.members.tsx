import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Loader2, Shield, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { organizationsApi } from '../../lib/api';
import { PageHeader } from '../../components/ui';
import { Modal, useConfirm } from '../../components/Modal';

export const Route = createFileRoute('/organizations/$organizationId/members')({
  component: OrganizationMembersPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

// Must match the backend enum values (lowercase)
type Role = 'org_admin' | 'org_member';

interface Member {
  id: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function OrganizationMembersPage() {
  const { organizationId } = Route.useParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('org_member');

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => (await organizationsApi.getById(organizationId)).data,
  });
  const members: Member[] = (organization?.members as Member[]) || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['organization', organizationId] });
  const errorMessage = (error: any, fallback: string) => error.response?.data?.message || fallback;

  const addMember = useMutation({
    mutationFn: async () => (await organizationsApi.addMember(organizationId, { email: email.trim(), role })).data,
    onSuccess: () => {
      refresh();
      toast.success('Member added');
      setShowAdd(false);
      setEmail('');
      setRole('org_member');
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Failed to add member')),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) =>
      (await organizationsApi.updateMemberRole(organizationId, userId, role)).data,
    onSuccess: () => {
      refresh();
      toast.success('Role updated');
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Failed to update role')),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => (await organizationsApi.removeMember(organizationId, userId)).data,
    onSuccess: () => {
      refresh();
      toast.success('Member removed');
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Failed to remove member')),
  });

  const handleRemove = async (member: Member) => {
    const ok = await confirm({
      title: `Remove ${member.user.name}?`,
      message: `${member.user.email} will lose access to ${organization?.name ?? 'this organization'}.`,
      confirmText: 'Remove member',
    });
    if (ok) removeMember.mutate(member.userId);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={{ to: '/organizations/$organizationId/settings', params: { organizationId }, label: 'Organization settings' }}
        title="Members"
        description={organization ? `People who can access ${organization.name}` : undefined}
        actions={
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <UserPlus /> Add member
          </button>
        }
      />

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="section-title">Current members</h2>
          <span className="text-sm text-gray-500 tabular-nums">{members.length}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-500">No members yet. Add members to get started.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((member) => {
              const isOwner = member.userId === organization?.ownerId;
              return (
                <li key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                      {initials(member.user.name || member.user.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{member.user.name}</p>
                      <p className="truncate text-sm text-gray-500">{member.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset">
                        <Crown className="h-3 w-3" /> Owner
                      </span>
                    ) : (
                      <>
                        <div className="relative">
                          <Shield className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                          <select
                            className="field h-9 w-36 pl-8 text-sm"
                            value={member.role}
                            disabled={updateRole.isPending}
                            onChange={(e) => updateRole.mutate({ userId: member.userId, role: e.target.value as Role })}
                            aria-label={`Role of ${member.user.name}`}
                          >
                            <option value="org_member">Member</option>
                            <option value="org_admin">Admin</option>
                          </select>
                        </div>
                        <button
                          className="btn btn-danger-ghost btn-sm btn-icon"
                          onClick={() => handleRemove(member)}
                          disabled={removeMember.isPending}
                          title="Remove member"
                          aria-label={`Remove ${member.user.name}`}
                        >
                          <Trash2 />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        <strong className="font-medium text-gray-700">Admins</strong> can manage members, categories and API keys.{' '}
        <strong className="font-medium text-gray-700">Members</strong> can work on projects and content.
      </p>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add member"
        description="The person must already have a Massweb account."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!email.trim() || addMember.isPending}
              onClick={() => addMember.mutate()}
            >
              {addMember.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Add member
            </button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) addMember.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="member-email">Email address</label>
            <input
              id="member-email"
              type="email"
              className="field"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="member-role">Role</label>
            <select id="member-role" className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="org_member">Member</option>
              <option value="org_admin">Admin</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
