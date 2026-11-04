import { Eye, EyeOff, Info } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { CrossMotif } from '../../components/ui/CrossMotif';
import { skyBackground } from '../../components/ui/skyBackground';
import { Field, TextInput } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { requestPasswordReset, signIn } from '../../features/authentication/authService';
import { useAuth } from '../auth';

type Mode = 'signin' | 'reset' | 'sent';

/** The seal, the headline and the sign-in card. Shared with the set-password page. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section
        aria-label="Lipa New Hope Church"
        className="relative flex flex-col justify-between gap-8 overflow-hidden p-6 md:p-12"
        style={skyBackground}
      >
        <CrossMotif className="right-12 top-8" />
        <img
          src="/lnhc-logo.png"
          alt="Lipa New Hope Church Ministries International seal"
          width="88"
          height="88"
          className="size-22 rounded-full ring-4 ring-white"
        />
        <div>
          <h1 className="max-w-[14ch] text-[clamp(2.25rem,1.4rem+3vw,3.5rem)] text-deep">
            Know where you serve this Sunday.
          </h1>
          <p className="mt-6 hidden max-w-[34ch] font-display text-lg italic md:block">
            The Gospel… the power of God unto salvation to all who believe.
          </p>
        </div>
        <p className="text-sm text-muted">
          Altamirano St., Mataas na Lupa, Lipa City · (043) 726 6667
        </p>
      </section>
      <main className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { state } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? (state.role === 'admin' ? '/admin' : '/')} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await requestPasswordReset(email, `${window.location.origin}/reset-password`);
        setMode('sent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      {mode === 'sent' ? (
        <div>
          <h2 className="text-3xl">Check your email</h2>
          <div className="mt-4">
            <Notice
              tone="success"
              title="If an account exists for that address, a reset link is on its way."
            >
              The link works for a limited time. If nothing arrives in a few minutes, check your
              spam folder.
            </Notice>
          </div>
          <Button className="mt-6 w-full" onClick={() => setMode('signin')}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          <h2 className="text-3xl">{mode === 'signin' ? 'Sign in' : 'Reset your password'}</h2>
          <p className="mb-6 mt-2 text-muted">
            {mode === 'signin'
              ? 'Use the email your worship leader invited.'
              : 'We’ll email you a link to choose a new one.'}
          </p>

          {error && (
            <div className="mb-4">
              <Notice tone="error" title={error} />
            </div>
          )}

          <Field label="Email">
            {(c) => (
              <TextInput
                {...c}
                type="email"
                autoComplete="username"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          {mode === 'signin' && (
            <Field label="Password">
              {(c) => (
                <div className="relative">
                  <TextInput
                    {...c}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1 grid size-9 place-items-center rounded-control text-muted hover:bg-wash hover:text-deep"
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </Field>
          )}

          <Button type="submit" variant="primary" className="w-full" busy={busy}>
            {mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </Button>

          <p className="mt-4 text-sm">
            <button
              type="button"
              className="text-brand underline underline-offset-2"
              onClick={() => {
                setError(null);
                setMode(mode === 'signin' ? 'reset' : 'signin');
              }}
            >
              {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
            </button>
          </p>

          {mode === 'signin' && (
            <div className="mt-6 flex gap-3 rounded-panel bg-wash px-4 py-3 text-sm text-brand-hover">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Accounts are created by invitation. If you don’t have one yet, ask your worship
                leader to invite you.
              </p>
            </div>
          )}

          {import.meta.env.MODE === 'demo' && (
            <p className="mt-6 rounded-panel border border-line bg-surface p-3 text-sm text-muted">
              Preview accounts (any password): <strong>rden@lnhc.example</strong> (volunteer) or{' '}
              <strong>admin@lnhc.example</strong> (administrator).
            </p>
          )}
        </form>
      )}
    </AuthShell>
  );
}
