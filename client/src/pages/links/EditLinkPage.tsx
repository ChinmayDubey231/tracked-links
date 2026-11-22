import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { countLabel } from '@tracked-links/shared';
import { Button } from '../../components/Button';
import { CopyButton } from '../../components/CopyButton';
import { OwnerShell } from '../../components/OwnerShell';
import { ErrorState, FormAlert, LoadingState } from '../../components/States';
import { SubHeader } from '../../components/SubHeader';
import { errorMessage } from '../../lib/api';
import { shareUrl } from '../../lib/config';
import { useDeleteLink, useLink, useUpdateLink } from '../../lib/links';
import { usePageTitle } from '../../lib/usePageTitle';
import { LinkForm } from './LinkForm';
import styles from './LinkPages.module.css';

/** /links/:id/edit: change a link's label and access settings, or delete it. The address stays the same. */
export default function EditLinkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useLink(id);
  const update = useUpdateLink(id);
  usePageTitle(query.data ? `Settings for ${query.data.link.label}` : 'Link settings');

  const subHeader = (
    <SubHeader
      crumbs={[
        { label: 'Documents', to: '/documents' },
        ...(query.data
          ? [
              { label: query.data.document.title, to: `/documents/${query.data.document.id}` },
              { label: query.data.link.label, to: `/links/${query.data.link.id}` },
            ]
          : []),
        { label: 'Settings' },
      ]}
    />
  );

  if (query.isPending) {
    return (
      <OwnerShell subHeader={subHeader}>
        <LoadingState label="Loading the link…" />
      </OwnerShell>
    );
  }
  if (query.isError) {
    return (
      <OwnerShell subHeader={subHeader}>
        <ErrorState title="This link didn't load" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      </OwnerShell>
    );
  }

  const { link, document } = query.data;
  return (
    <OwnerShell subHeader={subHeader}>
      <div className={styles.layout}>
        <LinkForm
          link={link}
          title="Link settings"
          intro="Changes apply to the same address, so there is no need to send the link again."
          submitLabel="Save changes"
          cancelTo={`/links/${link.id}`}
          onSubmit={async (input) => {
            await update.mutateAsync(input);
            navigate(`/links/${link.id}`);
          }}
        />
        <aside className={styles.aside} aria-label="This link">
          <span className={styles.asideLabel}>This link</span>
          <span className={styles.url}>{shareUrl(link.slug)}</span>
          <div className={styles.asideActions}>
            <CopyButton text={shareUrl(link.slug)} />
          </div>
          <DeleteLink link={link} onDeleted={() => navigate(`/documents/${document.id}`, { replace: true })} />
        </aside>
      </div>
    </OwnerShell>
  );
}

function DeleteLink({
  link,
  onDeleted,
}: {
  link: { id: string; documentId: string; label: string; views: number };
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteLink(link);

  return (
    <div className={styles.danger}>
      <span className={styles.asideLabel}>Delete</span>
      {confirming ? (
        <>
          <p className={styles.dangerText} role="alert">
            Delete “{link.label}”{link.views > 0 ? ` and its ${countLabel(link.views, 'view')}` : ''}? Anyone who opens it
            will be told it doesn’t exist. This can’t be undone.
          </p>
          {remove.isError && <FormAlert>{errorMessage(remove.error)}</FormAlert>}
          <div className={styles.asideActions}>
            <Button
              className={styles.dangerButton}
              loading={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}
            >
              Delete link
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={remove.isPending}>
              Keep it
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.caption}>
            Removes the link and the views recorded through it. To stop new views but keep the history, switch the link
            off instead.
          </p>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete link…
          </Button>
        </>
      )}
    </div>
  );
}
