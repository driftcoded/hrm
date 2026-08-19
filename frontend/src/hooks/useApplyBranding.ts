import { useEffect } from 'react';
import { useBranding } from './useBranding';

/** Matches the `<link rel="icon">` baked into index.html. */
const DEFAULT_FAVICON_HREF = '/favicon.svg';
const DEFAULT_FAVICON_TYPE = 'image/svg+xml';

/**
 * Applies branding (company name, favicon) to the browser tab, site-wide.
 * Must run regardless of auth state — the tab needs to reflect the
 * configured name/icon even on `/login`, before any token exists.
 */
export function useApplyBranding(): void {
  const { data: branding } = useBranding();

  useEffect(() => {
    if (!branding) {
      return;
    }

    document.title = branding.companyName;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    if (branding.faviconUrl) {
      link.href = branding.faviconUrl;
      // Uploaded favicons can be JPEG/PNG/WEBP — drop the hardcoded SVG
      // `type` from index.html and let the browser sniff the real one.
      link.removeAttribute('type');
    } else {
      link.href = DEFAULT_FAVICON_HREF;
      link.type = DEFAULT_FAVICON_TYPE;
    }
  }, [branding]);
}
