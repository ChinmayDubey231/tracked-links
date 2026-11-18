import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { countLabel, formatBytes, formatDate, type DocumentResponse } from '@tracked-links/shared';
import { ButtonLink } from '../../components/Button';
import { OwnerShell } from '../../components/OwnerShell';
import { ErrorState, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
import { api, errorMessage } from '../../lib/api';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './DocumentsPage.module.css';

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: ({ signal }) => api<DocumentResponse>(`/documents/${id}`, { signal }).then((res) => res.document),
    enabled: Boolean(id),
  });
}

/**
 * /documents/:id. The analytics screen (design/screens/document-analytics.html)
 * is built in phase 3; for now this shows the document's details.
 */
export default function DocumentPage() {
  const { id } = useParams();
  const query = useDocument(id);
  usePageTitle(query.data?.title ?? 'Document');

  const subHeader = (
    <SubHeader
      crumbs={[{ label: 'Documents', to: '/documents' }, { label: query.data?.title ?? 'Document' }]}
      actions={query.data ? <ButtonLink to={`/documents/${query.data.id}/links/new`}>New link</ButtonLink> : undefined}
    />
  );

  return (
    <OwnerShell subHeader={subHeader}>
      {query.isPending ? (
        <LoadingState label="Loading the document…" />
      ) : query.isError ? (
        <ErrorState title="This document didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className={styles.headline}>
            <h1 className={styles.title}>{query.data.title}</h1>
            <p className={styles.subtitle}>
              {countLabel(query.data.pageCount, 'page')}, {formatBytes(query.data.sizeBytes)}, uploaded{' '}
              {formatDate(query.data.createdAt)}.
            </p>
          </div>
          <p className={styles.footnote}>Page-by-page reading analytics for this document arrive in phase 3.</p>
        </>
      )}
    </OwnerShell>
  );
}
