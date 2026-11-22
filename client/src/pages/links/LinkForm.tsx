import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  MAX_LINK_LABEL_LENGTH,
  MIN_LINK_PASSWORD_LENGTH,
  endOfDayIso,
  toDateInputValue,
  type LinkInput,
  type LinkSummary,
} from '@tracked-links/shared';
import { Button, ButtonLink } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { DateField } from '../../components/DateField';
import { FormAlert } from '../../components/States';
import { TextField } from '../../components/TextField';
import { ApiError, errorMessage } from '../../lib/api';
import styles from './LinkPages.module.css';

interface Values {
  label: string;
  requireEmail: boolean;
  usePassword: boolean;
  password: string;
  allowDownload: boolean;
  /** "YYYY-MM-DD" or "" for no expiry. */
  expiry: string;
}

/** Fields that can show an error, in the order they appear. */
const FIELDS = ['label', 'password', 'expiresAt'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

function initialValues(link?: LinkSummary): Values {
  return {
    label: link?.label ?? '',
    requireEmail: link?.requireEmail ?? false,
    usePassword: link?.hasPassword ?? false,
    password: '',
    allowDownload: link?.allowDownload ?? false,
    expiry: link?.expiresAt ? toDateInputValue(link.expiresAt) : '',
  };
}

/**
 * The settings sent to the API. When editing a link that already has a password,
 * an empty password field keeps it (the field is left out of the request).
 */
function toInput(values: Values, hadPassword: boolean): LinkInput {
  const input: LinkInput = {
    label: values.label.trim(),
    requireEmail: values.requireEmail,
    allowDownload: values.allowDownload,
    expiresAt: values.expiry ? endOfDayIso(values.expiry) : null,
  };
  if (!values.usePassword) input.password = null;
  else if (values.password || !hadPassword) input.password = values.password;
  return input;
}

function validate(values: Values, hadPassword: boolean, initialExpiry: string): Errors {
  const errors: Errors = {};
  const label = values.label.trim();
  if (!label) errors.label = 'Enter a label, such as “TCS application”, so you can tell your links apart.';
  else if (label.length > MAX_LINK_LABEL_LENGTH) errors.label = `Use a label of ${MAX_LINK_LABEL_LENGTH} characters or fewer.`;

  const needsPassword = values.usePassword && (!hadPassword || values.password !== '');
  if (needsPassword && values.password.length < MIN_LINK_PASSWORD_LENGTH) {
    errors.password = values.password
      ? `Use at least ${MIN_LINK_PASSWORD_LENGTH} characters for the link password.`
      : 'Enter a password, or untick “Protect with a password”.';
  }

  // An unchanged date may be in the past (an expired link being renamed); a new one may not.
  if (values.expiry && values.expiry !== initialExpiry && values.expiry < toDateInputValue(new Date())) {
    errors.expiresAt = 'Choose a date from today onwards, or leave it empty to keep the link open.';
  }
  return errors;
}

interface LinkFormProps {
  /** The link being edited; leave out to create one. */
  link?: LinkSummary;
  title: string;
  intro: ReactNode;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (input: LinkInput) => Promise<unknown>;
}

/** The New link and Link settings form: label, access options and expiry. */
export function LinkForm({ link, title, intro, submitLabel, cancelTo, onSubmit }: LinkFormProps) {
  const hadPassword = Boolean(link?.hasPassword);
  const [initial] = useState(() => initialValues(link));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingId = useId();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((old) => ({ ...old, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate(values, hadPassword, initial.expiry);
    setErrors(found);
    setFormError(null);
    const firstInvalid = FIELDS.find((key) => found[key]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(toInput(values, hadPassword));
    } catch (error) {
      const fieldErrors: Errors = {};
      if (error instanceof ApiError) {
        for (const key of FIELDS) if (error.fields[key]) fieldErrors[key] = error.fields[key];
      }
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={(event) => void submit(event)} noValidate aria-labelledby={headingId}>
      <div className={styles.cardHead}>
        <h1 id={headingId} className={styles.title}>
          {title}
        </h1>
        <p className={styles.muted}>{intro}</p>
      </div>

      {formError && <FormAlert>{formError}</FormAlert>}

      <TextField
        label="Label"
        large
        data-field="label"
        value={values.label}
        onChange={(event) => set('label', event.target.value)}
        maxLength={MAX_LINK_LABEL_LENGTH + 20}
        autoComplete="off"
        hint="Only you see this. Name it after where you will share it."
        error={errors.label}
      />

      <fieldset className={styles.options}>
        <legend className={styles.legend}>Access</legend>
        <div className={styles.option}>
          <Checkbox
            label="Ask for an email before viewing"
            hint="You will see who opened the link, not only that it was opened."
            checked={values.requireEmail}
            onChange={(event) => set('requireEmail', event.target.checked)}
          />
        </div>
        <div className={styles.option}>
          <Checkbox
            label="Protect with a password"
            hint="Viewers must enter it to open the document."
            checked={values.usePassword}
            onChange={(event) => set('usePassword', event.target.checked)}
          />
          {values.usePassword && (
            <TextField
              className={styles.nested}
              label={hadPassword ? 'New password' : 'Link password'}
              type="text"
              data-field="password"
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
              autoComplete="off"
              spellCheck={false}
              hint={
                hadPassword
                  ? 'Leave empty to keep the current password.'
                  : `At least ${MIN_LINK_PASSWORD_LENGTH} characters. Send it separately from the link.`
              }
              error={errors.password}
            />
          )}
        </div>
        <div className={styles.option}>
          <Checkbox
            label="Allow download"
            hint="Turning this off hides the button. It cannot stop screenshots."
            checked={values.allowDownload}
            onChange={(event) => set('allowDownload', event.target.checked)}
          />
        </div>
        <div className={styles.option}>
          <DateField
            label="Expires on"
            hint="Leave empty to keep the link open until you switch it off."
            data-field="expiresAt"
            value={values.expiry}
            min={values.expiry && values.expiry === initial.expiry ? undefined : toDateInputValue(new Date())}
            onChange={(event) => set('expiry', event.target.value)}
            error={errors.expiresAt}
          />
        </div>
      </fieldset>

      <div className={styles.actions}>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
