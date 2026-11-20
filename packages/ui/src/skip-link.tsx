export const PAGE_START_ID = "page-start";

/**
 * First focusable element on every page; jumps keyboard users past repeated navigation.
 * Preceded by an invisible, script-focusable page-start marker: after client-side navigation
 * RouteFocusReset focuses the marker, so the next Tab lands here — exactly like a fresh load.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <>
      <span id={PAGE_START_ID} tabIndex={-1} className="sr-only outline-none" />
      <a
        href={`#${targetId}`}
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-raised"
      >
        Skip to main content
      </a>
    </>
  );
}
