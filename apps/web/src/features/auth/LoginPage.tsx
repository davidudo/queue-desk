import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@queuedesk/shared';
import { Button, Card, Input } from '@/components/ui/primitives';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const DEV_ACCOUNTS = [
  { label: 'Admin', email: 'admin@queuedesk.local', password: 'QueueDesk!Admin2026' },
  { label: 'Supervisor', email: 'supervisor@queuedesk.local', password: 'QueueDesk!Super2026' },
  { label: 'Support Agent', email: 'agent1@queuedesk.local', password: 'QueueDesk!Agent2026' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const showQuickLogin = import.meta.env.VITE_ENABLE_DEV_QUICK_LOGIN === 'true';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      await login(values);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Unable to sign in. Please try again.');
      }
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in to QueueDesk</h1>
          <p className="text-sm text-muted-foreground">
            Northstar Cloud · FlowOps customer support
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="agent@queuedesk.local"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {showQuickLogin && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground text-center">
              Synthetic Development Accounts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEV_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValue('email', acc.email);
                    setValue('password', acc.password);
                  }}
                >
                  {acc.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
