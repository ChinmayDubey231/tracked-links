import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { countLabel, type AccessRequest, type AccessResponse, type PublicLinkResponse } from '@tracked-links/shared';
import { Button } from '../../components/Button';
import { FormAlert } from '../../components/States';
import { TextField } from '../../components/TextField';
import { api, ApiError, errorMessage } from '../../lib/api';
import { isAutomatedBrowser } from './automation';
import styles from './Viewer.module.css';

type Errors = Partial<Record<'email' | 'password', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A sketch of a page beside the form (design/screens/viewer-gate.html). Decorative. */
function PagePreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <span className={styles.previewHeading} />
      {[90, 82, 88, 60, 34, 86, 74].map((width, index) => (
        <span key={index} className={styles.previewLine} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

/** Asks for the email and/or password a link requires, then opens the document. */
export function ViewerGate({
  slug,
  info,
  onAccess,
}: {
  slug: string;
  info: PublicLinkResponse;
  onAccess: (access: AccessResponse) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const found: Errors = {};
    if (info.requireEmail) {
      if (!email.trim()) found.email = 'Enter your email address to open this document.';
      else if (!EMAIL_PATTERN.test(email.trim())) found.email = 'Enter a valid email address, like name@company.com.';
    }
    if (info.requirePassword && !password) found.password = 'Enter the password that came with the link.';
    setErrors(found);
    setFormError(null);
    const firstInvalid = (['email', 'password'] as const).find((key) => found[key]);
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const body: AccessRequest = { automated: isAutomatedBrowser() };
    if (info.requireEmail) body.email = email.trim();
    if (info.requirePassword) body.password = password;

    setSubmitting(true);
    try {
      onAccess(await api<AccessResponse>(`/v/${encodeURIComponent(slug)}/access`, { method: 'POST', body }));
    } catch (error) {
      if (error instanceof ApiError && (error.fields.email || error.fields.password)) {
        setErrors({ email: error.fields.email, password: error.fields.password });
        form.querySelector<HTMLElement>(`[name="${error.fields.email ? 'email' : 'password'}"]`)?.focus();
      } else {
        setFormError(error);
      }
      setSubmitting(false);
    }
  };

  return (
    <>
      <PagePreview />
      <section className={styles.gateCard} aria-labelledby="gate-title">
        <div className={styles.gateHead}>
          <span className={styles.muted}>{info.ownerName} shared a document with you</span>
          <h1 id="gate-title" className={styles.gateTitle}>
            {info.title}
          </h1>
          <span className={styles.muted}>{countLabel(info.pageCount, 'page')}</span>
        </div>

        <form className={styles.gateForm} onSubmit={(event) => void submit(event)} noValidate>
          {formError !== null && <FormAlert>{errorMessage(formError)}</FormAlert>}
          {info.requireEmail && (
            <TextField
              label="Your email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              hint="The owner asked for an email before showing this document."
              error={errors.email}
            />
          )}
          {info.requirePassword && (
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="off"
              placeholder="Sent to you with the link"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
            />
          )}
          <Button type="submit" size="lg" block loading={submitting}>
            View document
          </Button>
        </form>

        <p className={styles.trackingNote}>
          This document tracks views and reading time.{' '}
          <Link to="/#privacy" className={styles.trackingLink}>
            What’s tracked
          </Link>
        </p>
      </section>
    </>
  );
}
