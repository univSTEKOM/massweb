import { useState } from 'react';
import { useNavigate, Link, createFileRoute, redirect } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { AuthShell, PasswordField } from '../components/AuthShell';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      throw redirect({ to: '/projects' });
    }
  },
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(formData);
      navigate({ to: '/projects' });
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message === 'Invalid credentials'
            ? 'Email or password is incorrect.'
            : message || 'Unable to sign in. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your projects and content."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="field h-11"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordField
            id="password"
            className="h-11"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> Signing in...
            </>
          ) : (
            <>
              Sign in <ArrowRight />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
