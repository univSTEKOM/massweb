import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Key, Loader2, Plus, RefreshCw, ShieldCheck, Ban, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateApiKeyModal, KeyReveal } from '../../components/CreateApiKeyModal';
import { Modal, useConfirm } from '../../components/Modal';
import { PageHeader, formatDate } from '../../components/ui';

export const Route = createFileRoute('/organizations/$organizationId/api-keys')({
  component: ApiKeysPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: { name: string };
}

const STATUS_ERRORS: Record<number, string> = {
  401: 'Your session expired. Please sign in again.',
  403: 'You do not have permission to manage API keys for this organization.',
  404: 'API key or organization not found.',
};

async function request(url: string, method: string, organizationId?: string) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: organizationId ? JSON.stringify({ organizationId }) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(STATUS_ERRORS[response.status] || data?.message || 'Request failed');
  }
  return response.json().catch(() => null);
}

function keyState(key: ApiKey): { label: string; cls: string } {
  if (!key.isActive) return { label: 'Revoked', cls: 'bg-red-50 text-red-700 ring-red-200' };
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return { label: 'Expired', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
}

function ApiKeysPage() {
  const { organizationId } = Route.useParams();
  const confirm = useConfirm();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshed, setRefreshed] = useState<{ key: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    try {
      setApiKeys(await request(`/api/api-keys/organization/${organizationId}`, 'GET'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRefresh = async (key: ApiKey) => {
    const ok = await confirm({
      title: `Regenerate "${key.name}"?`,
      message: 'The current key stops working immediately. Update every app that uses it.',
      confirmText: 'Regenerate key',
    });
    if (!ok) return;
    run(key.id, async () => {
      const data = await request(`/api/api-keys/${key.id}/refresh`, 'PATCH', organizationId);
      setRefreshed({ key: data.plainKey, name: key.name });
      toast.success('API key regenerated');
      loadApiKeys();
    });
  };

  const handleRevoke = async (key: ApiKey) => {
    const ok = await confirm({
      title: `Revoke "${key.name}"?`,
      message: 'Requests using this key will be rejected. You can still delete it afterwards.',
      confirmText: 'Revoke key',
    });
    if (!ok) return;
    run(key.id, async () => {
      await request(`/api/api-keys/${key.id}/revoke`, 'PATCH', organizationId);
      toast.success('API key revoked');
      loadApiKeys();
    });
  };

  const handleDelete = async (key: ApiKey) => {
    const ok = await confirm({
      title: `Delete "${key.name}"?`,
      message: 'This permanently removes the key. This action cannot be undone.',
      confirmText: 'Delete key',
    });
    if (!ok) return;
    run(key.id, async () => {
      await request(`/api/api-keys/${key.id}`, 'DELETE', organizationId);
      toast.success('API key deleted');
      loadApiKeys();
    });
  };

  const actions = (key: ApiKey) => (
    <div className="flex items-center gap-1">
      {key.isActive && (
        <>
          <button className="btn btn-ghost btn-sm" disabled={busyId === key.id} onClick={() => handleRefresh(key)} title="Regenerate key">
            <RefreshCw /> Regenerate
          </button>
          <button className="btn btn-ghost btn-sm text-amber-700 hover:bg-amber-50" disabled={busyId === key.id} onClick={() => handleRevoke(key)} title="Revoke">
            <Ban /> Revoke
          </button>
        </>
      )}
      <button className="btn btn-danger-ghost btn-sm btn-icon" disabled={busyId === key.id} onClick={() => handleDelete(key)} title="Delete" aria-label={`Delete ${key.name}`}>
        <Trash2 />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={{ to: '/organizations/$organizationId/settings', params: { organizationId }, label: 'Organization settings' }}
        title="API keys"
        description="Keys let your websites read published content through the public API."
        actions={
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus /> Create API key
          </button>
        }
      />

      <div className="surface overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="mx-auto max-w-sm px-4 py-14 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Key className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-gray-900">No API keys yet</h3>
            <p className="mt-1 text-sm text-gray-500">Create a key to fetch content from your website or app.</p>
            <button className="btn btn-primary btn-sm mt-5" onClick={() => setIsCreateOpen(true)}>
              <Plus /> Create API key
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Expires</th>
                  <th className="px-3 py-2.5">Last used</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apiKeys.map((key) => {
                  const state = keyState(key);
                  return (
                    <tr key={key.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{key.name}</p>
                        <p className="text-xs text-gray-500">
                          Created {formatDate(key.createdAt)} by {key.createdBy?.name || 'Unknown'}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${state.cls}`}>{state.label}</span>
                      </td>
                      <td className="px-3 py-3.5 text-gray-600">{key.expiresAt ? formatDate(key.expiresAt) : 'Never'}</td>
                      <td className="px-3 py-3.5 text-gray-600">{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">{actions(key)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {apiKeys.map((key) => {
                const state = keyState(key);
                return (
                  <li key={key.id} className="space-y-2 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{key.name}</p>
                        <p className="text-xs text-gray-500">by {key.createdBy?.name || 'Unknown'} · {formatDate(key.createdAt)}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${state.cls}`}>{state.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Expires {key.expiresAt ? formatDate(key.expiresAt) : 'never'} · Last used {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'never'}
                    </p>
                    <div className="-ml-2">{actions(key)}</div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium text-gray-900">Keep keys safe</p>
          <p className="mt-0.5">
            Never put keys in public code. Use a separate key per environment, set an expiration, and regenerate a key right away if it leaks.
          </p>
        </div>
      </div>

      <CreateApiKeyModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={loadApiKeys} organizationId={organizationId} />

      <Modal
        open={!!refreshed}
        onClose={() => setRefreshed(null)}
        dismissible={false}
        title="New key generated"
        footer={
          <button className="btn btn-primary" onClick={() => setRefreshed(null)}>
            I&apos;ve saved it
          </button>
        }
      >
        {refreshed && <KeyReveal value={refreshed.key} warning={`The old key for "${refreshed.name}" no longer works and this one will not be shown again.`} />}
      </Modal>
    </div>
  );
}
