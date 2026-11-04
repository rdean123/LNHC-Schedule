/**
 * The logo's cross as a quiet decorative motif, with a soft glow behind it. Decorative only:
 * hidden from assistive technology and from phones, where it would crowd the text.
 */
export function CrossMotif({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute hidden md:block ${className}`}>
      <div className="relative h-44 w-28">
        <div className="absolute left-[2.1rem] top-0 h-40 w-[1.875rem] rounded-md bg-linear-to-b from-cross-light to-cross opacity-90 shadow-[0_0_60px_24px_rgb(255_255_255/0.75)]" />
        <div className="absolute left-0 top-9 h-[1.875rem] w-24 rounded-md bg-linear-to-b from-cross-light to-cross opacity-90" />
      </div>
    </div>
  );
}
