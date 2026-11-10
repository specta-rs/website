/**
 * The nav brand. Right-clicking it opens the brand assets page, matching the
 * old site's easter egg.
 */
export function SpectaLogo() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold"
      onContextMenu={(event) => {
        event.preventDefault();
        window.location.href = "/docs/brand";
      }}
    >
      <img src="/assets/specta.png" alt="Specta Logo" className="h-8 w-12" />
      <span>Specta</span>
    </a>
  );
}
