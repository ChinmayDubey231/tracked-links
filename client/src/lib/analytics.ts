import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type DocumentAnalyticsResponse,
  type LinkViewsResponse,
  type SignedFileResponse,
} from '@tracked-links/shared';
import { api } from './api';

/*
 * Keys sit under ['documents', id] and ['links', id], so the invalidations in
 * lib/links.ts and lib/upload.ts refresh them too.
 */
export const analyticsKeys = {
  document: (id: string | undefined, range: AnalyticsRange) => ['documents', id, 'analytics', range] as const,
  linkViews: (id: string | undefined) => ['links', id, 'views'] as const,
};

export function parseRange(value: string | null): AnalyticsRange {
  return ANALYTICS_RANGES.find((range) => range === value) ?? 'all';
}

export function useDocumentAnalytics(id: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: analyticsKeys.document(id, range),
    queryFn: ({ signal }) => api<DocumentAnalyticsResponse>(`/documents/${id}/analytics?range=${range}`, { signal }),
    enabled: Boolean(id),
    // Changing the date range keeps this document's numbers on screen until the new ones arrive.
    placeholderData: (previous) => (previous?.document.id === id ? previous : undefined),
  });
}

export function useLinkViews(id: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: analyticsKeys.linkViews(id),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<LinkViewsResponse>(`/links/${id}/views${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, {
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(id) && enabled,
  });
}

/**
 * A signed URL of the owner's PDF, for page thumbnails. It expires in minutes, so it is
 * fetched fresh on every visit (gcTime 0) and never refetched while the page is open:
 * the file is downloaded once, straight away.
 */
export function useDocumentFileUrl(id: string | undefined) {
  return useQuery({
    queryKey: ['document-file', id],
    queryFn: ({ signal }) => api<SignedFileResponse>(`/documents/${id}/file`, { signal }).then((res) => res.url),
    enabled: Boolean(id),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
