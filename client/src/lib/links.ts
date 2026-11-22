import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LinkDetailResponse,
  LinkInput,
  LinkResponse,
  LinksResponse,
  LinkSummary,
  LinkUpdate,
} from '@tracked-links/shared';
import { api } from './api';

export const linkKeys = {
  forDocument: (documentId: string | undefined) => ['documents', documentId, 'links'] as const,
  detail: (id: string | undefined) => ['links', id] as const,
};

export function useDocumentLinks(documentId: string | undefined) {
  return useQuery({
    queryKey: linkKeys.forDocument(documentId),
    queryFn: ({ signal }) => api<LinksResponse>(`/documents/${documentId}/links`, { signal }).then((res) => res.links),
    enabled: Boolean(documentId),
  });
}

export function useLink(id: string | undefined) {
  return useQuery({
    queryKey: linkKeys.detail(id),
    queryFn: ({ signal }) => api<LinkDetailResponse>(`/links/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

/** Refreshes everything that shows link counts or settings: the document, its links and the Documents list. */
function useInvalidateLinks() {
  const queryClient = useQueryClient();
  return (link: Pick<LinkSummary, 'id' | 'documentId'>) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents'] }),
      queryClient.invalidateQueries({ queryKey: linkKeys.detail(link.id) }),
    ]);
}

export function useCreateLink(documentId: string | undefined) {
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (input: LinkInput) =>
      api<LinkResponse>(`/documents/${documentId}/links`, { method: 'POST', body: input }).then((res) => res.link),
    onSuccess: (link) => invalidate(link),
  });
}

export function useUpdateLink(id: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (update: LinkUpdate) =>
      api<LinkResponse>(`/links/${id}`, { method: 'PATCH', body: update }).then((res) => res.link),
    onSuccess: (link) => {
      // Show the new settings straight away; the refetch then fills in anything else.
      queryClient.setQueryData<LinkDetailResponse>(linkKeys.detail(link.id), (old) => (old ? { ...old, link } : old));
      return invalidate(link);
    },
  });
}

export function useDeleteLink(link: Pick<LinkSummary, 'id' | 'documentId'> | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/links/${link?.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: linkKeys.detail(link?.id) });
      return queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
