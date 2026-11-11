import { useState } from 'react';
import { useNavigate, Link, createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '../contexts/auth-context';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { AuthShell, PasswordField } from '../components/AuthShell';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
  beforeLoad: async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      throw redirect({ to: '/projects' });
    }
  },
});

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [signupDisabled, setSignupDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordMismatch = formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName || undefined,
      });
      navigate({ to: '/projects' });
    } catch (error: any) {
      const message = error?.response?.data?.message;
      // Check if registration is disabled
      if (typeof message === 'string' && message.includes('disabled')) {
        setSignupDisabled(true);
      } else {
        setError(Array.isArray(message) ? message.join(', ') : message || 'Unable to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start generating and publishing content with Massweb."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </>
      }
    >
      {signupDisabled && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="mb-1 text-sm font-semibold text-red-900">Registration disabled</h3>
            <p className="text-sm text-red-700">
              New user registration is currently disabled by the administrator. Please contact support for access.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            className="field h-11"
            placeholder="Your name"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="field h-11"
            placeholder="you@company.com"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <PasswordField
              id="password"
              className="h-11"
              placeholder="Create a password"
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm</label>
            <PasswordField
              id="confirmPassword"
              className={`h-11 ${passwordMismatch ? '!border-red-400 focus:!ring-red-500/15' : ''}`}
              placeholder="Repeat password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />
          </div>
        </div>
        {passwordMismatch && <p className="-mt-2 text-xs text-red-600">Passwords do not match.</p>}

        <div className="border-t border-gray-100 pt-4">
          <label className="label" htmlFor="org">
            Organization name <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="org"
            type="text"
            className="field h-11"
            placeholder="Your company or team"
            autoComplete="organization"
            value={formData.organizationName}
            onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
          />
          <p className="hint">Create your first organization now, or do it later.</p>
        </div>

        <button type="submit" className="btn btn-primary btn-lg mt-2 w-full" disabled={isLoading || signupDisabled}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> Creating account...
            </>
          ) : (
            <>
              Create account <ArrowRight />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
