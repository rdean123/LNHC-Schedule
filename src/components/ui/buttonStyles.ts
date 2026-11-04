export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-control border font-semibold no-underline transition-colors duration-150 disabled:border-line disabled:bg-draft-50 disabled:text-muted';

const variants: Record<ButtonVariant, string> = {
  primary: 'border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover',
  secondary: 'border-line-strong bg-surface text-deep hover:bg-wash',
  quiet: 'border-transparent bg-transparent text-brand hover:bg-wash',
  danger: 'border-danger bg-surface text-danger hover:bg-danger-50',
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-base',
  sm: 'min-h-9 px-3 text-sm',
};

/** Class names so a router Link or <a> can look exactly like a button. */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra = '',
) {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}
