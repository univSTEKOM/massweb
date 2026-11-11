import { createFileRoute, useNavigate, Link, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Key, Loader2, LogOut, Pencil, Tags, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { organizationsApi, projectsApi } from '../../lib/api';
import { useOrganization } from '../../contexts/organization-context';
import { useAuth } from '../../contexts/auth-context';
import { PageHeader, formatDate } from '../../components/ui';
import { useConfirm } from '../../components/Modal';

export const Route = createFileRoute('/organizations/$organizationId/settings')({
  component: OrganizationSettingsPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

function OrganizationSettingsPage() {
  const { organizationId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { switchOrganization, organizations } = useOrganization();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [organizationName, setOrganizationName] = useState('');

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => (await organizationsApi.getById(organizationId)).data,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', organizationId],
    queryFn: async () => (await projectsApi.getAll(organizationId)).data,
  });

  const isOwner = user?.id === organization?.ownerId;
  const projectCount = projects?.length ?? 0;
  const hasProjects = projectCount > 0;
  const memberCount = organization?.members?.length ?? 0;

  const goToAnotherOrg = () => {
    const otherOrgs = organizations.filter((o) => o.id !== organizationId);
    if (otherOrgs.length > 0) switchOrganization(otherOrgs[0].id);
    navigate({ to: '/projects' });
  };

  const updateMutation = useMutation({
    mutationFn: async () => organizationsApi.update(organizationId, { name: organizationName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization updated');
      setIsEditing(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update organization'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => organizationsApi.delete(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization deleted');
      goToAnotherOrg();
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete organization'),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => organizationsApi.leaveOrganization(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('You left the organization');
      goToAnotherOrg();
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to leave organization'),
  });

  const startEditing = () => {
    setOrganizationName(organization?.name ?? '');
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (hasProjects) return;
    const ok = await confirm({
      title: `Delete "${organization?.name}"?`,
      message: 'All members lose access. This action cannot be undone.',
      confirmText: 'Delete organization',
    });
    if (ok) deleteMutation.mutate();
  };

  const handleLeave = async () => {
    const ok = await confirm({
      title: `Leave "${organization?.name}"?`,
      message: 'You will lose access to its projects and content until someone adds you again.',
      confirmText: 'Leave organization',
    });
    if (ok) leaveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!organization) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500">Organization not found</div>;
  }

  const sections = [
    { to: '/organizations/$organizationId/members', icon: Users, title: 'Members', desc: `${memberCount} ${memberCount === 1 ? 'person' : 'people'} with access` },
    { to: '/organizations/$organizationId/categories', icon: Tags, title: 'Categories', desc: 'Group projects for the public API' },
    { to: '/organizations/$organizationId/api-keys', icon: Key, title: 'API keys', desc: 'Programmatic access to your content' },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader back={{ to: '/projects', label: 'Projects' }} title="Organization settings" description={organization.name} />

      {/* Sub-sections */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sections.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={title}
            to={to}
            params={{ organizationId }}
            className="surface group flex items-center gap-3 p-4 transition hover:border-gray-300 hover:shadow-sm"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">{title}</span>
              <span className="block truncate text-xs text-gray-500">{desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:text-gray-500" />
          </Link>
        ))}
      </div>

      {/* Details */}
      <div className="surface mb-6 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-gray-400" />
          <h2 className="section-title">Details</h2>
        </div>

        <dl className="divide-y divide-gray-100">
          <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-gray-500 sm:w-40">Name</dt>
            <dd className="flex-1">
              {isEditing ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (organizationName.trim()) updateMutation.mutate();
                  }}
                >
                  <input
                    className="field"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    autoFocus
                    aria-label="Organization name"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={!organizationName.trim() || updateMutation.isPending}>
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-900">{organization.name}</span>
                  <button className="btn btn-secondary btn-sm" onClick={startEditing}>
                    <Pencil /> Edit
                  </button>
                </div>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center">
            <dt className="text-sm text-gray-500 sm:w-40">Slug</dt>
            <dd className="font-mono text-sm text-gray-700">{organization.slug}</dd>
          </div>
          <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center">
            <dt className="text-sm text-gray-500 sm:w-40">Projects</dt>
            <dd className="text-sm text-gray-700 tabular-nums">{projectCount}</dd>
          </div>
          <div className="flex flex-col gap-1 pt-4 sm:flex-row sm:items-center">
            <dt className="text-sm text-gray-500 sm:w-40">Created</dt>
            <dd className="text-sm text-gray-700">{formatDate(organization.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-white">
        <div className="border-b border-red-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
        </div>
        {isOwner ? (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete organization</p>
              <p className="text-sm text-gray-500">
                {hasProjects
                  ? `Delete its ${projectCount} project${projectCount === 1 ? '' : 's'} first.`
                  : 'Permanently delete this organization.'}
              </p>
            </div>
            <button className="btn btn-danger" onClick={handleDelete} disabled={hasProjects || deleteMutation.isPending}>
              <Trash2 /> Delete
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-sm font-medium text-gray-900">Leave organization</p>
              <p className="text-sm text-gray-500">You will lose access to its projects and content.</p>
            </div>
            <button className="btn btn-secondary text-red-600" onClick={handleLeave} disabled={leaveMutation.isPending}>
              <LogOut /> Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
