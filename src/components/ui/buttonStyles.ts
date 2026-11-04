export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-control border font-semibold no-underline transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out disabled:transform-none disabled:border-line disabled:bg-draft-50 disabled:text-muted disabled:shadow-none motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover hover:shadow-md hover:shadow-brand/25',
  secondary:
    'border-line-strong bg-surface text-deep hover:bg-wash hover:shadow-sm hover:shadow-deep/10',
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
