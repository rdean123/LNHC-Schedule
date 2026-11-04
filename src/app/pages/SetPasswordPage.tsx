import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { Field, TextInput } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { useToast } from '../../components/ui/toastContext';
import { setNewPassword } from '../../features/authentication/authService';
import { MIN_PASSWORD_LENGTH } from '../../lib/validation/auth';
import { useAuth } from '../auth';
import { AuthShell } from './LoginPage';

/**
 * Where invitation and reset links land. The link signs the person in with a temporary
 * session; here they choose their password.
 */
export function SetPasswordPage({ kind }: { kind: 'invite' | 'reset' }) {
  const { state } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await setNewPassword(password, confirmation);
      toast.success('Password saved. You’re signed in.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t save your password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <AuthShell>
        <p className="text-muted" role="status">
          Checking your link…
        </p>
      </AuthShell>
    );
  }

  if (state.status !== 'signedIn') {
    return (
      <AuthShell>
        <h2 className="text-3xl">This link has expired</h2>
        <div className="mt-4">
          <Notice tone="warn" title="The link is old or has already been used.">
            {kind === 'invite'
              ? 'Ask your worship leader to send a new invitation.'
              : 'Request a new reset link and use it within the hour.'}
          </Notice>
        </div>
        <Link to="/login" className={buttonClasses('primary', 'md', 'mt-6 w-full')}>
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  const name = state.volunteer?.displayName;
  return (
    <AuthShell>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <h2 className="text-3xl">
          {kind === 'invite' ? `Welcome${name ? `, ${name}` : ''}` : 'Choose a new password'}
        </h2>
        <p className="mb-6 mt-2 text-muted">
          {kind === 'invite'
            ? 'Choose a password to finish setting up your account.'
            : 'You’ll use it the next time you sign in.'}
        </p>
        {error && (
          <div className="mb-4">
            <Notice tone="error" title={error} />
          </div>
        )}
        <Field
          label="New password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`}
        >
          {(c) => (
            <TextInput
              {...c}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label="Confirm password">
          {(c) => (
            <TextInput
              {...c}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" className="w-full" busy={busy}>
          Save password and continue
        </Button>
      </form>
    </AuthShell>
  );
}
