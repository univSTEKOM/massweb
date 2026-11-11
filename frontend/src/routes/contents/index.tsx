import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@heroui/react';
import { contentApi, categoriesApi } from '../../lib/api';
import type { Category } from '../../lib/api';
import { useOrganization } from '../../contexts/organization-context';
import { Search, FileText, Tag, FolderOpen, X, Filter, Plus } from 'lucide-react';
import { ContentTable, ContentBulkBar } from '../../components/ContentTable';
import { PageHeader, Pagination, formatNumber } from '../../components/ui';
import { toggleInSet } from '../../lib/content-actions';

export const Route = createFileRoute('/contents/')({
  component: ContentsPage,
});

function ContentsPage() {
  const { currentOrganization } = useOrganization();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const res = await categoriesApi.getByOrganization(currentOrganization.id);
      return res.data;
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: contentsData, isLoading } = useQuery({
    queryKey: ['org-contents', currentOrganization?.id, page, statusFilter, categoryFilter, projectFilter, debouncedSearch],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const res = await contentApi.searchOrganizationContents(currentOrganization.id, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        projectId: projectFilter !== 'all' ? projectFilter : undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      });
      return res.data;
    },
    enabled: !!currentOrganization?.id,
  });

  const projectNames = useMemo(
    () => Object.fromEntries((contentsData?.projects ?? []).map((p) => [p.id, p.name])),
    [contentsData?.projects],
  );

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setProjectFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    resetPaging();
  };

  const toggleAll = (ids: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || projectFilter !== 'all' || debouncedSearch;

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-900">No organization selected</h2>
        <p className="mt-1 text-sm text-gray-500">Please select an organization from the header to view contents.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <PageHeader
        title="All contents"
        description={`Browse every article in ${currentOrganization.name}`}
        actions={
          <>
            {contentsData && (
              <div className="mr-3 text-right">
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">{formatNumber(contentsData.total)}</p>
                <p className="text-xs text-gray-500">articles</p>
              </div>
            )}
            <Link to="/contents/new" className="btn btn-primary">
              <Plus /> New article
            </Link>
          </>
        }
      />

      <div className="surface overflow-hidden">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_12rem_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field pl-9"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPaging(); }}
              className="field pl-9"
            >
              <option value="all">All status</option>
              <option value="draft">Draft</option>
              <option value="pending">Queued</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="relative">
            <Tag className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); resetPaging(); }}
              className="field pl-9"
            >
              <option value="all">All categories</option>
              {categories.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <FolderOpen className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={projectFilter}
              onChange={(e) => { setProjectFilter(e.target.value); resetPaging(); }}
              className="field pl-9"
            >
              <option value="all">All projects</option>
              {contentsData?.projects.map((proj) => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters ? (
            <button onClick={clearFilters} className="btn btn-ghost">
              <X /> Clear
            </button>
          ) : (
            <span className="hidden lg:block" />
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !contentsData || contentsData.contents.length === 0 ? (
          <div className="mx-auto max-w-sm px-4 py-14 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900">No contents found</h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Create a project and generate content to get started.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-secondary btn-sm mt-5">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <ContentTable
              contents={contentsData.contents}
              selected={selected}
              onToggle={(id) => setSelected((prev) => toggleInSet(prev, id))}
              onToggleAll={toggleAll}
              projectNames={projectNames}
            />
            <Pagination page={page} totalPages={contentsData.totalPages} onChange={setPage} />
          </>
        )}
      </div>

      <ContentBulkBar selected={selected} onClear={() => setSelected(new Set())} />
    </div>
  );
}
