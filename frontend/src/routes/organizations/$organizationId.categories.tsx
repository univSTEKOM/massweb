import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoriesApi } from '../../lib/api';
import type { Category } from '../../lib/api';
import { PageHeader } from '../../components/ui';
import { Modal, useConfirm } from '../../components/Modal';

export const Route = createFileRoute('/organizations/$organizationId/categories')({
  component: OrganizationCategoriesPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#84CC16'];
const EMPTY_FORM = { name: '', description: '', color: CATEGORY_COLORS[0] };

function OrganizationCategoriesPage() {
  const { organizationId } = Route.useParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // null = closed, 'new' = create, otherwise the category being edited
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', organizationId],
    queryFn: async () => (await categoriesApi.getByOrganization(organizationId)).data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['categories', organizationId] });
  const close = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { name: form.name.trim(), description: form.description.trim() || undefined, color: form.color };
      if (editing === 'new') return categoriesApi.create({ organizationId, ...data });
      return categoriesApi.update((editing as Category).id, data);
    },
    onSuccess: () => {
      refresh();
      toast.success(editing === 'new' ? 'Category created' : 'Category updated');
      close();
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to save category'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      refresh();
      toast.success('Category deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete category'),
  });

  const openEdit = (category: Category) => {
    setForm({ name: category.name, description: category.description || '', color: category.color || CATEGORY_COLORS[0] });
    setEditing(category);
  };

  const handleDelete = async (category: Category) => {
    const ok = await confirm({
      title: `Delete "${category.name}"?`,
      message: 'Projects keep their content but are no longer grouped under this category.',
      confirmText: 'Delete category',
    });
    if (ok) deleteMutation.mutate(category.id);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        back={{ to: '/organizations/$organizationId/settings', params: { organizationId }, label: 'Organization settings' }}
        title="Categories"
        description="Group projects so websites can fetch content per category through the public API."
        actions={
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditing('new'); }}>
            <Plus /> New category
          </button>
        }
      />

      <div className="surface overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : categories.length === 0 ? (
          <div className="mx-auto max-w-sm px-4 py-14 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Tags className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-gray-900">No categories yet</h3>
            <p className="mt-1 text-sm text-gray-500">Create categories such as &ldquo;Blog&rdquo; or &ldquo;Layanan&rdquo; to organize projects.</p>
            <button className="btn btn-primary btn-sm mt-5" onClick={() => { setForm(EMPTY_FORM); setEditing('new'); }}>
              <Plus /> New category
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((category: Category) => (
              <li key={category.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${category.color || '#3B82F6'}1A`, color: category.color || '#3B82F6' }}
                >
                  <Tags className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{category.name}</p>
                  <p className="truncate text-sm text-gray-500">
                    <span className="font-mono text-xs">{category.slug}</span>
                    {category.description && <span> · {category.description}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(category)} title="Edit" aria-label={`Edit ${category.name}`}>
                    <Pencil />
                  </button>
                  <button
                    className="btn btn-danger-ghost btn-sm btn-icon"
                    onClick={() => handleDelete(category)}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing === 'new' ? 'New category' : 'Edit category'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={close}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="animate-spin" />}
              {editing === 'new' ? 'Create category' : 'Save changes'}
            </button>
          </>
        }
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name.trim()) saveMutation.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="cat-name">Name</label>
            <input id="cat-name" className="field" placeholder="e.g. Blog" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="cat-desc">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="cat-desc" className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <span className="label">Color</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition ${form.color === color ? 'ring-2 ring-gray-900' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                >
                  {form.color === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
