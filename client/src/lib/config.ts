const stripSlash = (url: string) => url.replace(/\/+$/, '');

/** Where the API runs. */
export const API_URL = stripSlash(import.meta.env.VITE_API_URL || 'http://localhost:4000');

/** The public address of this frontend, used to build share links. */
export const PUBLIC_BASE_URL = stripSlash(import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin);

export const shareUrl = (slug: string) => `${PUBLIC_BASE_URL}/v/${slug}`;

/** The project's repository, linked from the landing footer. The link is hidden while unset. */
export const GITHUB_URL = import.meta.env.VITE_GITHUB_URL?.trim() || null;
