import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { AccessRequest, AccessResponse, PublicLinkResponse } from '@tracked-links/shared';
import { AppFooter } from '../../components/AppFooter';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/States';
import { LogoMark } from '../../components/LogoMark';
import { api, ApiError, errorMessage } from '../../lib/api';
import { cx } from '../../lib/cx';
import { usePageTitle } from '../../lib/usePageTitle';
import { isAutomatedBrowser } from './automation';
import { loadReader, preloadReader } from './loadReader';
import { ViewerGate } from './ViewerGate';
import styles from './Viewer.module.css';

// pdf.js is large: it loads alongside the access request, never before the gate appears.
const Reader = lazy(loadReader);

/** Keeps shared documents out of search results while the viewer is open. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/** Header, centred content and the "views are recorded" footer: the gate and its loading and error states. */
export function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.gateShell}>
      <header className={styles.gateHeader}>
        <div className={cx('container', styles.gateHeaderInner)}>
          <span className={styles.brand}>
            <LogoMark />
            Tracked Links
          </span>
          <span className={styles.headerNote}>Shared document</span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.gateBody}>
        {children}
      </main>
      <AppFooter variant="viewer" />
    </div>
  );
}

const PROBLEMS: Record<string, string> = {
  link_off: 'This link is switched off',
  link_expired: 'This link has expired',
  link_not_found: 'This link doesn’t exist',
  not_found: 'This link doesn’t exist',
  rate_limited: 'Too many attempts',
  network: 'Can’t reach Tracked Links',
};

/** Why the document can't be shown, and what to do. Offers a retry only when trying again could help. */
export function ViewerProblem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const code = error instanceof ApiError ? error.code : undefined;
  const title = (code && PROBLEMS[code]) || 'This document didn’t load';
  const canRetry = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
  return (
    <section className={styles.gateCard} role="alert" aria-labelledby="viewer-problem">
      <h1 id="viewer-problem" className={styles.gateTitle}>
        {title}
      </h1>
      <p className={styles.muted}>{errorMessage(error)}</p>
      {canRetry && onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}

/** Opens a link that has no gate straight away. Runs once, even under StrictMode, so it starts one View. */
function AutoOpen({ slug, onAccess }: { slug: string; onAccess: (access: AccessResponse) => void }) {
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);

  const open = useCallback(() => {
    setError(null);
    preloadReader();
    const body: AccessRequest = { automated: isAutomatedBrowser() };
    api<AccessResponse>(`/v/${encodeURIComponent(slug)}/access`, { method: 'POST', body }).then(onAccess, setError);
  }, [slug, onAccess]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    open();
  }, [open]);

  return (
    <GateShell>
      {error ? <ViewerProblem error={error} onRetry={open} /> : <LoadingState label="Opening the document…" />}
    </GateShell>
  );
}

/**
 * /v/:slug, public. Shows the gate when the link asks for an email or password, then the reader.
 * The View is created by POST /v/:slug/access from this page, never by the page request itself,
 * because link-preview bots fetch pages but don't run JavaScript.
 */
export default function ViewerPage() {
  const { slug = '' } = useParams();
  const [access, setAccess] = useState<AccessResponse | null>(null);
  useNoIndex();

  const info = useQuery({
    queryKey: ['viewer', slug],
    queryFn: ({ signal }) => api<PublicLinkResponse>(`/v/${encodeURIComponent(slug)}`, { auth: false, signal }),
    staleTime: Infinity,
  });
  usePageTitle(access?.title ?? info.data?.title ?? 'Shared document');

  if (access) {
    return (
      <Suspense
        fallback={
          <GateShell>
            <LoadingState label="Opening the document…" />
          </GateShell>
        }
      >
        <Reader slug={slug} access={access} />
      </Suspense>
    );
  }

  if (info.isPending) {
    return (
      <GateShell>
        <LoadingState label="Loading the document…" />
      </GateShell>
    );
  }

  if (info.isError) {
    return (
      <GateShell>
        <ViewerProblem error={info.error} onRetry={() => void info.refetch()} />
      </GateShell>
    );
  }

  if (info.data.requireEmail || info.data.requirePassword) {
    return (
      <GateShell>
        <ViewerGate slug={slug} info={info.data} onAccess={setAccess} />
      </GateShell>
    );
  }

  return <AutoOpen slug={slug} onAccess={setAccess} />;
}
