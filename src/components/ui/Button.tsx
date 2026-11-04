import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { buttonClasses } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks repeat clicks while something is saving. */
  busy?: boolean;
};

export function Button({
  variant,
  size,
  busy,
  className,
  children,
  disabled,
  type,
  ...rest
}: Props) {
  return (
    <button
      type={type ?? 'button'}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
