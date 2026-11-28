import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { linkSettingsSummary, type LinkSummary } from '@tracked-links/shared';
import { Button, ButtonLink } from '../../components/Button';
import { CopyButton } from '../../components/CopyButton';
import { useIsDemo } from '../../components/Demo';
import { OwnerShell } from '../../components/OwnerShell';
import { ErrorState, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
import { errorMessage } from '../../lib/api';
import { shareUrl } from '../../lib/config';
import { useCreateLink } from '../../lib/links';
import { usePageTitle } from '../../lib/usePageTitle';
import { useDocument } from '../documents/DocumentPage';
import { LinkForm } from './LinkForm';
import styles from './LinkPages.module.css';

/** /documents/:id/links/new: create a link, then show it ready to copy. */
export default function NewLinkPage() {
  const { id } = useParams();
  const doc = useDocument(id);
  const create = useCreateLink(id);
  const isDemo = useIsDemo();
  const [created, setCreated] = useState<LinkSummary | null>(null);
  // Remounts the form for "Create another link", so it starts empty.
  const [formKey, setFormKey] = useState(0);
  usePageTitle(created ? 'Link ready' : 'New link');

  const subHeader = (
    <SubHeader
      crumbs={[
        { label: 'Documents', to: '/documents' },
        { label: doc.data?.title ?? 'Document', to: `/documents/${id}` },
        { label: 'New link' },
      ]}
    />
  );

  if (doc.isPending) {
    return (
      <OwnerShell subHeader={subHeader}>
        <LoadingState label="Loading the document…" />
      </OwnerShell>
    );
  }
  if (doc.isError) {
    return (
      <OwnerShell subHeader={subHeader}>
        <ErrorState title="This document didn't load" message={errorMessage(doc.error)} onRetry={() => void doc.refetch()} />
      </OwnerShell>
    );
  }

  return (
    <OwnerShell subHeader={subHeader}>
      <div className={styles.layout}>
        {created ? (
          <ReadyCard
            link={created}
            documentId={doc.data.id}
            onAnother={() => {
              setCreated(null);
              setFormKey((key) => key + 1);
            }}
          />
        ) : (
          <LinkForm
            key={formKey}
            title="A new link"
            intro="One link per place you share the document, so you can tell the readers apart."
            submitLabel="Create link"
            cancelTo={`/documents/${doc.data.id}`}
            onSubmit={async (input) => setCreated(await create.mutateAsync(input))}
          />
        )}

        <aside className={styles.aside} aria-label="Share link">
          {created ? (
            <>
              <span className={styles.asideLabel}>Your link is ready to copy</span>
              <span className={styles.url}>{shareUrl(created.slug)}</span>
              <div className={styles.asideActions}>
                <CopyButton text={shareUrl(created.slug)} />
                <ButtonLink to={`/links/${created.id}`} variant="secondary">
                  Open link page
                </ButtonLink>
              </div>
              <span className={styles.caption}>Until someone opens it, the link shows as “Not opened” on your dashboard.</span>
              {isDemo && (
                <span className={styles.caption}>
                  Try it: open the link in a private window and read a page or two, then come back to this document to see
                  your visit.
                </span>
              )}
            </>
          ) : (
            <>
              <span className={styles.asideLabel}>After you create it, the link is ready to copy</span>
              <span className={styles.urlPending}>{shareUrl('…')}</span>
              <Button variant="secondary" disabled>
                Copy
              </Button>
            </>
          )}
        </aside>
      </div>
    </OwnerShell>
  );
}

function ReadyCard({ link, documentId, onAnother }: { link: LinkSummary; documentId: string; onAnother: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Move focus to the confirmation so screen readers announce it and keyboard users start from it.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className={styles.card} aria-labelledby="link-ready-title">
      <div className={styles.cardHead}>
        <h1 id="link-ready-title" ref={headingRef} tabIndex={-1} className={styles.title}>
          “{link.label}” is ready.
        </h1>
        <p className={styles.muted}>
          Copy the link and send it. Views show up on the document as soon as someone opens it.
        </p>
      </div>
      <p>{linkSettingsSummary(link)}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onAnother}>
          Create another link
        </Button>
        <ButtonLink to={`/documents/${documentId}`}>Done</ButtonLink>
      </div>
    </section>
  );
}
