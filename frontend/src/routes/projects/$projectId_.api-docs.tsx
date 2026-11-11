import { createFileRoute, redirect } from '@tanstack/react-router';
import { PageHeader } from '../../components/ui';
import { Card } from '@heroui/react';
import { Key, Code as CodeIcon, FileCode, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';

export const Route = createFileRoute('/projects/$projectId_/api-docs')({
  component: ProjectApiDocsPage,
  beforeLoad: async () => {
    if (!localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' });
    }
  },
});

/**
 * Absolute API base URL for copy-paste examples. VITE_API_URL may be relative ("/api")
 * or missing; resolve it against the current site instead of assuming localhost.
 */
function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL || '/api';
  try {
    return new URL(configured, window.location.origin).toString().replace(/\/$/, '');
  } catch {
    return `${window.location.origin}/api`;
  }
}

function ProjectApiDocsPage() {
  const { projectId } = Route.useParams();
  const apiUrl = resolveApiUrl();
  const [activeTab, setActiveTab] = useState<'organization' | 'project'>('organization');
  const [activeCodeTab, setActiveCodeTab] = useState<'org-examples' | 'project-examples'>('org-examples');

  // Fetch project to get organization ID
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}`);
      return res.data;
    },
  });

  const organizationId = project?.organizationId || 'your-org-id';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <PageHeader
          back={{ to: '/projects/$projectId', params: { projectId }, label: project?.name ? `Back to ${project.name}` : 'Back to project' }}
          title="API documentation"
          description={<>Read this project&apos;s published content from your website. Base URL: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs break-all text-gray-800">{apiUrl}</code></>}
        />

        {/* Authentication */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Authentication</h2>
          </div>
          <div className="space-y-4">
            <p>All API requests require an API key. Include your API key in the <code className="px-2 py-1 bg-gray-100 rounded">X-API-Key</code> header:</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              X-API-Key: your-api-key-here
            </pre>
            <p className="text-sm text-gray-600">
              You can create and manage API keys in your organization settings.
            </p>
          </div>
        </Card>

        {/* Endpoints */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCode className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Endpoints</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('organization')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'organization'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <Building2 className="w-4 h-4" />
              Organization
            </button>
            <button
              onClick={() => setActiveTab('project')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === 'project'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <FileCode className="w-4 h-4" />
              Project
            </button>
          </div>

          {/* Organization Endpoints */}
          {activeTab === 'organization' && (
            <div className="space-y-6">
              {/* Get Organization Categories */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/organizations/{"{"}organizationId{"}"}/categories</code>
                </div>
                <p className="text-sm">Get all categories for an organization.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "data": [
    {
      "id": "...",
      "name": "Blog",
      "slug": "blog",
      "description": "Blog posts",
      "color": "#3B82F6"
    }
  ],
  "total": 3
}`}
                  </pre>
                </div>
              </div>

              <hr />

              {/* Get Contents by Category */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/organizations/{"{"}organizationId{"}"}/categories/{"{"}categoryIdOrSlug{"}"}/contents</code>
                </div>
                <p className="text-sm">Get all contents from projects that belong to a specific category. You can use either the category ID or slug.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Query Parameters:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li><code className="px-1 bg-gray-100 rounded text-xs">status</code> - Filter by status (published, pending, failed). Drafts are never returned</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">page</code> - Page number (default: 1)</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">limit</code> - Items per page (default: 50, max: 100)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "data": [
    {
      "id": "...",
      "projectId": "...",
      "title": "...",
      "content": "...",
      "slug": "...",
      "publishStatus": "published",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}`}
                  </pre>
                </div>
              </div>

              <hr />

              {/* Get Organization Projects */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/organizations/{"{"}organizationId{"}"}/projects</code>
                </div>
                <p className="text-sm">Get all projects for an organization.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "data": [
    {
      "id": "...",
      "name": "My Project",
      "description": "...",
      "thumbnailUrl": "...",
      "categories": [
        { "id": "...", "name": "Blog", "slug": "blog", "color": "#3B82F6" }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 5
}`}
                  </pre>
                </div>
              </div>

              <hr />

              {/* Get Organization Contents */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/organizations/{"{"}organizationId{"}"}/contents</code>
                </div>
                <p className="text-sm">Get all contents for an organization with pagination and filtering.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Query Parameters:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li><code className="px-1 bg-gray-100 rounded text-xs">projectId</code> - Optional, filter by specific project</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">status</code> - Filter by status (published, pending, failed). Drafts are never returned</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">page</code> - Page number (default: 1)</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">limit</code> - Items per page (default: 50, max: 100)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "data": [
    {
      "id": "...",
      "projectId": "...",
      "title": "...",
      "content": "...",
      "slug": "...",
      "metaDescription": "...",
      "tags": "...",
      "thumbnailUrl": "...",
      "publishStatus": "published",
      "publishedAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50,
  "totalPages": 2
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Project Endpoints */}
          {activeTab === 'project' && (
            <div className="space-y-6">
              {/* Get Project Contents */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/projects/{"{"}projectId{"}"}/contents</code>
                </div>
                <p className="text-sm">Get all contents for a specific project with pagination and filtering.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Query Parameters:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li><code className="px-1 bg-gray-100 rounded text-xs">status</code> - Filter by status (published, pending, failed). Drafts are never returned</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">page</code> - Page number (default: 1)</li>
                    <li><code className="px-1 bg-gray-100 rounded text-xs">limit</code> - Items per page (default: 50, max: 100)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "data": [
    {
      "id": "...",
      "title": "...",
      "content": "...",
      "slug": "...",
      "publishStatus": "published",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50,
  "totalPages": 2
}`}
                  </pre>
                </div>
              </div>

              <hr />

              {/* Get Single Content */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                  <code className="text-sm break-all">/public/contents/{"{"}idOrSlug{"}"}</code>
                </div>
                <p className="text-sm">Get a single content item by ID or Slug.</p>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                    {`{
  "id": "...",
  "title": "...",
  "content": "...",
  "slug": "...",
  "publishStatus": "published",
  "createdAt": "2024-01-01T00:00:00.000Z"
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Code Examples */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CodeIcon className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Code Examples</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveCodeTab('org-examples')}
              className={`px-4 py-2 border-b-2 transition-colors ${activeCodeTab === 'org-examples'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Organization API
            </button>
            <button
              onClick={() => setActiveCodeTab('project-examples')}
              className={`px-4 py-2 border-b-2 transition-colors ${activeCodeTab === 'project-examples'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Project API
            </button>
          </div>

          {activeCodeTab === 'org-examples' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">JavaScript - Get All Contents from Organization</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`const fetchOrgContents = async () => {
  const response = await fetch(
    '${apiUrl}/public/organizations/${organizationId}/contents?status=published&page=1&limit=10',
    {
      headers: {
        'X-API-Key': 'your-api-key-here'
      }
    }
  );
  
  const data = await response.json();
  console.log(data);
};

fetchOrgContents();`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">JavaScript - Get Contents from Specific Project in Organization</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`const fetchOrgProjectContents = async () => {
  const response = await fetch(
    '${apiUrl}/public/organizations/${organizationId}/contents?projectId=${projectId}&status=published',
    {
      headers: {
        'X-API-Key': 'your-api-key-here'
      }
    }
  );
  
  const data = await response.json();
  console.log(data);
};

fetchOrgProjectContents();`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Python - List All Projects and Their Contents</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`import requests

headers = {
    'X-API-Key': 'your-api-key-here'
}

# First, get all projects
projects_response = requests.get(
    '${apiUrl}/public/organizations/${organizationId}/projects',
    headers=headers
)
projects = projects_response.json()['data']

# Then, get contents for each project
for project in projects:
    contents_response = requests.get(
        '${apiUrl}/public/organizations/${organizationId}/contents',
        headers=headers,
        params={'projectId': project['id'], 'status': 'published'}
    )
    contents = contents_response.json()
    print(f"Project: {project['name']}, Contents: {contents['total']}")`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">cURL - Get Organization Projects</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`curl -H "X-API-Key: your-api-key-here" \\
  "${apiUrl}/public/organizations/${organizationId}/projects"`}
                </pre>
              </div>
            </div>
          )}

          {activeCodeTab === 'project-examples' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">JavaScript (Fetch API)</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`const fetchContents = async () => {
  const response = await fetch(
    '${apiUrl}/public/projects/${projectId}/contents?status=published&page=1&limit=10',
    {
      headers: {
        'X-API-Key': 'your-api-key-here'
      }
    }
  );
  
  const data = await response.json();
  console.log(data);
};

fetchContents();`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Python (Requests)</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`import requests

headers = {
    'X-API-Key': 'your-api-key-here'
}

params = {
    'status': 'published',
    'page': 1,
    'limit': 10
}

response = requests.get(
    '${apiUrl}/public/projects/${projectId}/contents',
    headers=headers,
    params=params
)

data = response.json()
print(data)`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">cURL</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                  {`curl -H "X-API-Key: your-api-key-here" \\
  "${apiUrl}/public/projects/${projectId}/contents?status=published&page=1&limit=10"`}
                </pre>
              </div>
            </div>
          )}
        </Card>

        {/* Your IDs Reference */}
        <Card className="p-6 bg-blue-50 border border-blue-200">
          <div className="space-y-3">
            <h3 className="font-semibold text-blue-900">📌 Your Reference IDs</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Organization ID:</span>
                <code className="px-2 py-1 bg-blue-100 rounded text-xs">{organizationId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Project ID:</span>
                <code className="px-2 py-1 bg-blue-100 rounded text-xs">{projectId}</code>
              </div>
            </div>
          </div>
        </Card>

        {/* Best Practices */}
        <Card className="p-6 bg-purple-50 border border-purple-200">
          <div className="space-y-3">
            <h3 className="font-semibold text-purple-900">💡 Best Practices</h3>
            <ul className="text-sm text-purple-800 space-y-2 list-disc list-inside">
              <li>Use <strong>Organization API</strong> to fetch content from multiple projects at once</li>
              <li>Use <strong>Project API</strong> when you need content from a specific project only</li>
              <li>Cache responses when possible to reduce API calls</li>
              <li>Use pagination with appropriate limit values</li>
              <li>Filter by status to get only the content you need</li>
              <li>Implement error handling for rate limits and network issues</li>
              <li>Keep your API keys secure - never commit them to version control</li>
              <li>Use environment variables to store API keys in your applications</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
