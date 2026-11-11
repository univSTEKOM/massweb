import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth Types
export interface User {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    members?: any[];
    createdAt: string;
    updatedAt: string;
}

// Category type for project organization - cache bust 2025-12-18
export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
    organization?: Organization;
}

// Types
export interface Project {
    id: string;
    name: string;
    description?: string;
    organizationId: string;
    template: string;
    titleTemplate?: string;
    metaDescriptionTemplate?: string;
    tagsTemplate?: string;
    publishDelaySeconds: number;
    thumbnailUrl?: string;
    categories?: Category[];
    createdAt: string;
    updatedAt: string;
}

export type PublishStatus = 'draft' | 'pending' | 'published' | 'failed';

/** Statuses a user can move content to manually. */
export type ManualPublishStatus = 'draft' | 'pending' | 'published';

export interface ProjectStats {
    totalContents: number;
    publishedContents: number;
    pendingContents: number;
    draftContents: number;
    failedContents: number;
}

export interface CsvColumn {
    id: string;
    projectId: string;
    columnName: string;
    columnType: string;
    columnOrder: number;
}

export interface CsvRow {
    id: string;
    projectId: string;
    rowData: Record<string, string>;
    rowOrder: number;
}

export interface GeneratedContent {
    id: string;
    projectId: string;
    content: string;
    title: string;
    metaDescription?: string;
    tags?: string;
    thumbnailUrl?: string;
    slug: string;
    publishStatus: PublishStatus;
    publishedAt?: string;
    createdAt: string;
}

// Projects API
export const projectsApi = {
    getAll: (organizationId?: string) => {
        const params = organizationId ? `?organizationId=${organizationId}` : '';
        return api.get<Project[]>(`/projects${params}`);
    },
    getById: (id: string) => api.get<Project>(`/projects/${id}`),
    getStats: (id: string) => api.get<ProjectStats>(`/projects/${id}/stats`),
    create: (data: Partial<Project> & { categoryIds?: string[] }) => api.post<Project>('/projects', data),
    update: (id: string, data: Partial<Project> & { categoryIds?: string[] }) => api.put<Project>(`/projects/${id}`, data),
    delete: (id: string) => api.delete(`/projects/${id}`),
    uploadThumbnail: (id: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<Project>(`/projects/${id}/thumbnail`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    deleteThumbnail: (id: string) => api.delete<Project>(`/projects/${id}/thumbnail`),
};

export const csvApi = {
    upload: (projectId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<{
            columns: CsvColumn[];
            rowCount: number;
            totalCombinations: number;
        }>(`/csv/projects/${projectId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000, // 2 minutes for large CSV uploads
        });
    },
    getData: (projectId: string) => api.get<{
        columns: CsvColumn[];
        rows: CsvRow[];
    }>(`/csv/projects/${projectId}`),
};

export const uploadsApi = {
    uploadThumbnail: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<{ url: string }>('/uploads/thumbnail', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

export const contentApi = {
    generate: (projectId: string, options: { asDraft?: boolean } = {}) =>
        api.post<{ jobId: string; totalRows: number }>(`/content-generator/projects/${projectId}/generate`, options),
    generateSync: (projectId: string, options: { asDraft?: boolean } = {}) => api.post<{ generatedCount: number }>(
        `/content-generator/projects/${projectId}/generate-sync`,
        options,
        { timeout: 300000 } // 5 minutes for large content generation
    ),
    getContents: (projectId: string, page: number = 1, limit: number = 20, status?: string, search?: string) =>
        api.get<{
            contents: GeneratedContent[];
            total: number;
            page: number;
            totalPages: number;
        }>(`/content-generator/projects/${projectId}/contents`, {
            params: { page, limit, status, search },
        }),
    getById: (id: string) => api.get<GeneratedContent>(`/content-generator/contents/${id}`),
    update: (id: string, data: Partial<GeneratedContent>) => api.put<GeneratedContent>(`/content-generator/contents/${id}`, data),
    delete: (id: string) => api.delete(`/content-generator/contents/${id}`),
    /** Manual status change for selected items. 'published' goes live immediately (outside the auto-publish queue). */
    bulkStatus: (contentIds: string[], status: ManualPublishStatus) =>
        api.post<{ updated: number }>(`/content-generator/contents/bulk-status`, { contentIds, status }),
    bulkDelete: (contentIds: string[]) =>
        api.post<{ deleted: number }>(`/content-generator/contents/bulk-delete`, { contentIds }),
    /** Mass status change for a whole project, e.g. all pending -> draft. */
    projectBulkStatus: (projectId: string, from: PublishStatus, to: ManualPublishStatus) =>
        api.post<{ updated: number }>(`/content-generator/projects/${projectId}/bulk-status`, { from, to }),
    publish: (projectId: string, delaySeconds?: number) => api.post<{ jobId: string }>(`/content-generator/projects/${projectId}/publish`, { delaySeconds }),
    publishSync: (projectId: string, delaySeconds?: number) => api.post<{ published: number }>(`/content-generator/projects/${projectId}/publish-sync`, { delaySeconds }),
    unpublish: (contentIds: string[]) => api.post<{ unpublished: number }>(`/content-generator/contents/unpublish`, { contentIds }),
    publishAsync: (projectId: string, delaySeconds?: number) => api.post<{ jobId: string }>(`/content-generator/projects/${projectId}/publish-async`, { delaySeconds }),
    getJobStatus: (jobId: string) => api.get<{ jobId: string; type: string; state: string; progress: number }>(`/content-generator/jobs/${jobId}`),
    getPublishJobStatus: (jobId: string) => api.get<{
        id: string;
        projectId: string;
        status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
        totalContents: number;
        processedCount: number;
        delaySeconds: number;
        errorMessage?: string;
    }>(`/content-generator/publish-jobs/${jobId}`),
    pausePublishJob: (jobId: string) => api.post(`/content-generator/publish-jobs/${jobId}/pause`),
    resumePublishJob: (jobId: string) => api.post(`/content-generator/publish-jobs/${jobId}/resume`),
    cancelPublishJob: (jobId: string) => api.post(`/content-generator/publish-jobs/${jobId}/cancel`),
    getActivePublishJob: (projectId: string) => api.get<{
        id: string;
        projectId: string;
        status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
        totalContents: number;
        processedCount: number;
        delaySeconds: number;
    } | null>(`/content-generator/projects/${projectId}/active-publish-job`),
    getOverallStats: (organizationId?: string) => {
        const params = organizationId ? `?organizationId=${organizationId}` : '';
        return api.get<{
            totalProjects: number;
            totalContent: number;
            publishedContent: number;
            pendingContent: number;
            draftContent: number;
            failedContent: number;
            activeJobs: number;
            completedJobsToday: number;
        }>(`/content-generator/overall-stats${params}`);
    },
    searchOrganizationContents: (
        organizationId: string,
        options: {
            projectId?: string;
            categoryId?: string;
            status?: string;
            search?: string;
            page?: number;
            limit?: number;
        } = {}
    ) => {
        const params = new URLSearchParams();
        if (options.projectId) params.append('projectId', options.projectId);
        if (options.categoryId) params.append('categoryId', options.categoryId);
        if (options.status) params.append('status', options.status);
        if (options.search) params.append('search', options.search);
        if (options.page) params.append('page', options.page.toString());
        if (options.limit) params.append('limit', options.limit.toString());

        return api.get<{
            contents: GeneratedContent[];
            projects: { id: string; name: string; categories: Category[] }[];
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        }>(`/content-generator/organizations/${organizationId}/contents?${params.toString()}`);
    },
};

// Auth API
export const authApi = {
    login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
    register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
    me: () => api.get<User>('/auth/me'),
    logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    },
};

// Organizations API
export const organizationsApi = {
    getAll: () => api.get<Organization[]>('/organizations'),
    getById: (id: string) => api.get<Organization>(`/organizations/${id}`),
    create: (data: { name: string }) => api.post<Organization>('/organizations', data),
    update: (id: string, data: { name: string }) => api.patch<Organization>(`/organizations/${id}`, data),
    delete: (id: string) => api.delete(`/organizations/${id}`),
    addMember: (id: string, data: { email: string; role: string }) =>
        api.post(`/organizations/${id}/members`, data),
    updateMemberRole: (id: string, userId: string, role: string) =>
        api.patch(`/organizations/${id}/members/${userId}`, { role }),
    removeMember: (id: string, userId: string) =>
        api.delete(`/organizations/${id}/members/${userId}`),
    leaveOrganization: (id: string) =>
        api.post(`/organizations/${id}/leave`),
};

// Categories API
export const categoriesApi = {
    getByOrganization: (organizationId: string) => api.get<Category[]>(`/categories/organization/${organizationId}`),
    getById: (id: string) => api.get<Category>(`/categories/${id}`),
    create: (data: { organizationId: string; name: string; description?: string; color?: string }) =>
        api.post<Category>('/categories', data),
    update: (id: string, data: { name?: string; description?: string; color?: string }) =>
        api.patch<Category>(`/categories/${id}`, data),
    delete: (id: string) => api.delete(`/categories/${id}`),
};

