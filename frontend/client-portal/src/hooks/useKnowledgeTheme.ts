import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchPublicKnowledgeTheme } from '../lib/api/knowledge-theme.api.js';

// Injects the admin's custom CSS/JS (see «Настройки → Тема базы знаний» in
// operator-app) into the page — call this from every public FAQ page
// (FaqPage, FaqArticlePage), never from the authenticated ticket-portal
// surface, which isn't the customer's own branded help-center.
export function useKnowledgeTheme() {
  const { data: theme } = useQuery({
    queryKey: ['public-knowledge-theme'],
    queryFn: fetchPublicKnowledgeTheme,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!theme?.customCss) return;
    const style = document.createElement('style');
    style.setAttribute('data-knowledge-theme', 'custom-css');
    style.textContent = theme.customCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [theme?.customCss]);

  useEffect(() => {
    if (!theme?.customJs) return;
    // Sandboxed with `allow-scripts` only (no `allow-same-origin`) — the
    // admin's script gets an opaque, isolated origin with its own
    // localStorage/DOM, so it can never reach THIS page's localStorage
    // (where auth.store.ts keeps a logged-in client's access/refresh
    // tokens) or the real page's DOM. This page is public and reachable by
    // an already-authenticated client too (Help link, bookmark) — running
    // the script same-origin (the previous behavior) meant any customJs
    // edit, malicious or from a compromised admin account, could exfiltrate
    // a live client session the moment they visited /faq. Full-viewport +
    // pointer-events:none so an inert script (analytics/tracking init —
    // the documented use case, see the settings page's own
    // "console.log('faq loaded')" placeholder) never blocks clicks on the
    // real FAQ page underneath; a script needing a visible/clickable widget
    // isn't supported by this sandbox.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-knowledge-theme', 'custom-js');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('title', 'custom-knowledge-theme-script');
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;pointer-events:none;';
    // `</script` inside the admin's own source would otherwise prematurely
    // close this srcdoc's inline <script> tag.
    const escapedJs = theme.customJs.replace(/<\/script/gi, '<\\/script');
    iframe.srcdoc = `<!doctype html><html><body><script>${escapedJs}</script></body></html>`;
    document.body.appendChild(iframe);
    return () => {
      iframe.remove();
    };
  }, [theme?.customJs]);
}
