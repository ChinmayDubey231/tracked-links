import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  countLabel,
  documentsHeadline,
  formatDate,
  formatDuration,
  relativeTime,
  type DocumentsResponse,
  type DocumentSummary,
} from '@tracked-links/shared';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { OwnerShell } from '../../components/OwnerShell';
import { PageThumb } from '../../components/PageThumb';
import { ErrorState, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
import { UploadDropzone, type UploadDropzoneHandle } from '../../components/UploadDropzone';
import { api, errorMessage } from '../../lib/api';
import { useDocumentUpload } from '../../lib/upload';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './DocumentsPage.module.css';
import { UploadFeedback } from './UploadFeedback';

const columns: Column<DocumentSummary>[] = [
  {
    id: 'preview',
    header: 'Preview',
    hideHeader: true,
    width: '80px',
    cell: (doc) => (
      <span className={styles.thumb}>
        <PageThumb image={doc.thumbnailUrl} />
      </span>
    ),
  },
  {
    id: 'document',
    header: 'Document',
    isRowLink: true,
    cell: (doc) => (
      <span className={styles.docName}>
        <span className={styles.docTitle}>{doc.title}</span>
        <span className={styles.docMeta}>
          {countLabel(doc.pageCount, 'page')}, {countLabel(doc.linkCount, 'link')}, uploaded {formatDate(doc.createdAt)}
        </span>
      </span>
    ),
  },
  {
    id: 'views',
    header: 'Views',
    align: 'right',
    width: '116px',
    cell: (doc) => <span className={styles.views}>{doc.views}</span>,
  },
  {
    id: 'average',
    header: 'Average read',
    align: 'right',
    width: '140px',
    cell: (doc) => <span className={styles.cellText}>{formatDuration(doc.avgReadMs)}</span>,
  },
  {
    id: 'last',
    header: 'Last viewed',
    align: 'right',
    width: '150px',
    cell: (doc) => (
      <span className={styles.cellMuted}>{doc.lastViewedAt ? relativeTime(doc.lastViewedAt) : 'Not yet'}</span>
    ),
  },
];

const STEPS = [
  { title: 'Upload a PDF', hint: 'Start here. Your resume is a good first document.' },
  { title: 'Make one link per place', hint: 'Label each one, such as "TCS application" or "LinkedIn bio".' },
  { title: 'See who read what', hint: 'Opens, devices and reading time per page appear here.' },
];

export default function DocumentsPage() {
  usePageTitle('Documents');
  const dropzone = useRef<UploadDropzoneHandle>(null);
  const upload = useDocumentUpload();
  const query = useQuery({
    queryKey: ['documents'],
    queryFn: ({ signal }) => api<DocumentsResponse>('/documents', { signal }),
  });

  const hasDocuments = (query.data?.documents.length ?? 0) > 0;

  const subHeader = (
    <SubHeader
      crumbs={[{ label: 'Documents' }]}
      actions={
        hasDocuments ? (
          <Button onClick={() => dropzone.current?.open()} disabled={upload.busy}>
            Upload PDF
          </Button>
        ) : undefined
      }
    />
  );

  let content;
  if (query.isPending) {
    content = <LoadingState label="Loading your documents…" />;
  } else if (query.isError) {
    content = (
      <ErrorState
        title="Your documents didn't load"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!hasDocuments) {
    content = (
      <>
        <div className={styles.headline}>
          <h1 className={styles.title}>No documents yet.</h1>
          <p className={styles.subtitle}>Upload your first PDF and you can share a tracked link in under a minute.</p>
        </div>
        <div className={styles.hero}>
          <UploadDropzone
            ref={dropzone}
            variant="hero"
            onFile={upload.start}
            busy={upload.busy}
            feedback={<UploadFeedback state={upload.state} />}
          />
        </div>
        <ol className={styles.steps} aria-label="How it works">
          {STEPS.map((step, index) => (
            <li key={step.title} className={`${styles.step} ${index === 0 ? styles.stepCurrent : ''}`}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepHint}>{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </>
    );
  } else {
    const { title, subtitle } = documentsHeadline(query.data.totals);
    content = (
      <>
        <div className={styles.headline}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <UploadDropzone
          ref={dropzone}
          onFile={upload.start}
          busy={upload.busy}
          feedback={<UploadFeedback state={upload.state} />}
        />
        <DataTable
          caption="Your documents"
          columns={columns}
          rows={query.data.documents}
          rowKey={(doc) => doc.id}
          rowHref={(doc) => `/documents/${doc.id}`}
          minWidth={700}
        />
        <p className={styles.footnote}>Open a document for page-by-page reading analytics.</p>
      </>
    );
  }

  return <OwnerShell subHeader={subHeader}>{content}</OwnerShell>;
}
