import { useParams } from 'react-router';
import { AppFooter } from '../components/AppFooter';
import { LogoMark } from '../components/LogoMark';
import { OwnerShell } from '../components/OwnerShell';
import { SubHeader } from '../components/SubHeader';
import { usePageTitle } from '../lib/usePageTitle';
import { useDocument } from './documents/DocumentPage';
import styles from './documents/DocumentsPage.module.css';

/* Screens that later phases replace. They keep the routes and navigation working in the meantime. */

/** /documents/:id/links/new, built in phase 2. */
export function NewLinkPlaceholder() {
  const { id } = useParams();
  const doc = useDocument(id);
  usePageTitle('New link');
  return (
    <OwnerShell
      subHeader={
        <SubHeader
          crumbs={[
            { label: 'Documents', to: '/documents' },
            { label: doc.data?.title ?? 'Document', to: `/documents/${id}` },
            { label: 'New link' },
          ]}
        />
      }
    >
      <div className={styles.headline}>
        <h1 className={styles.title}>A new link</h1>
        <p className={styles.subtitle}>Creating share links is built in phase 2.</p>
      </div>
    </OwnerShell>
  );
}

/** /links/:id, built in phase 3. */
export function LinkViewsPlaceholder() {
  usePageTitle('Link views');
  return (
    <OwnerShell subHeader={<SubHeader crumbs={[{ label: 'Documents', to: '/documents' }, { label: 'Link' }]} />}>
      <div className={styles.headline}>
        <h1 className={styles.title}>Link views</h1>
        <p className={styles.subtitle}>The list of views for each link is built in phase 3.</p>
      </div>
    </OwnerShell>
  );
}

/** /v/:slug, the public viewer, built in phase 2. */
export function ViewerPlaceholder() {
  usePageTitle('Shared document');
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-rule)' }}>
        <div
          className="container"
          style={{ minHeight: 78, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 18 }}>
            <LogoMark />
            Tracked Links
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Shared document</span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container" style={{ flex: '1 0 auto', paddingTop: 48, paddingBottom: 48 }}>
        <div className={styles.headline}>
          <h1 className={styles.title}>Shared document</h1>
          <p className={styles.subtitle}>The document viewer is built in phase 2.</p>
        </div>
      </main>
      <AppFooter variant="viewer" />
    </div>
  );
}
