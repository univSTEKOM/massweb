import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { organizationsApi } from '../../lib/api';
import { useOrganization } from '../../contexts/organization-context';
import { PageHeader } from '../../components/ui';

export const Route = createFileRoute('/organizations/create')({
  component: CreateOrganizationPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

function CreateOrganizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentOrganization } = useOrganization();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => (await organizationsApi.create({ name: name.trim() })).data,
    onSuccess: (organization) => {
      // Make the new organization the active one, so every page shows its data
      localStorage.setItem('current_organization_id', organization.id);
      setCurrentOrganization(organization);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success(`Organization "${organization.name}" created`);
      navigate({ to: '/projects' });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create organization'),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={{ to: '/projects', label: 'Projects' }}
        title="Create organization"
        description="Organizations group projects, members, categories and API keys."
      />

      <form
        className="surface p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
      >
        <div className="mb-5 flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-gray-400" />
          <h2 className="section-title">Details</h2>
        </div>
        <label className="label" htmlFor="org-name">Organization name</label>
        <input
          id="org-name"
          className="field"
          placeholder="e.g. Tim Marketing"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <p className="hint">You can rename it later. It becomes your active organization after creation.</p>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => navigate({ to: '/projects' })}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Create organization
          </button>
        </div>
      </form>
    </div>
  );
}
