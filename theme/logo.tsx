/**
 * The nav brand. Right-clicking it opens the brand assets page, matching the
 * old site's easter egg.
 */
export function SpectaLogo() {
  return (
    <a
      href="/"
      aria-label="Specta home"
      className="group inline-flex items-center gap-2.5"
      onContextMenu={(event) => {
        event.preventDefault();
        window.location.href = "/docs/brand";
      }}
    >
      <span className="flex h-8 w-11 items-center justify-center rounded-[10px] border border-sp-accent-line bg-sp-accent-soft transition-colors group-hover:border-sp-accent">
        <img
          src="/assets/specta.png"
          alt="Specta Logo"
          className="h-6 w-9 object-contain transition-transform duration-200 group-hover:scale-105"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.015em] text-fd-foreground">
          Specta
        </span>
        <span className="mt-1 font-mono text-[9px] font-medium tracking-[0.14em] text-fd-muted-foreground uppercase">
          Rust ecosystem
        </span>
      </span>
    </a>
  );
}
