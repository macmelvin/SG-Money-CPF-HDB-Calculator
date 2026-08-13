import { useEffect } from "react";

/**
 * Sets document.title and the meta description for the current page.
 *
 * This runs client-side, which is enough for Googlebot (it executes JS before
 * indexing) but NOT enough on its own for rich snippets or for crawlers that
 * don't run JS. The prerender step (scripts/prerender.mjs) captures the DOM
 * *after* this hook has run and bakes the result into static HTML per route,
 * so the meta tags below end up in the actual served HTML too.
 */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const fullTitle = `${title} | SG Money`;
    document.title = fullTitle;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
}
