import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../../components/Button';
import { FormAlert } from '../../components/States';
import { TextField } from '../../components/TextField';
import { ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { usePageTitle } from '../../lib/usePageTitle';
import { AuthLayout, authStyles as styles } from './AuthLayout';
import { clearDraftEmail, useDraftEmail } from './draftEmail';
import { checkEmail, checkNewPassword, compact, focusFirstError, type FieldErrors } from './validation';

const IDS = { name: 'signup-name', email: 'signup-email', password: 'signup-password' };

/** Not in the design: the Log in layout plus a name field. */
export default function SignupPage() {
  usePageTitle('Create an account');
  const { signup } = useAuth();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useDraftEmail();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = compact({
      name: name.trim() ? undefined : 'Enter your name.',
      email: checkEmail(email),
      password: checkNewPassword(password),
    });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, IDS);
      return;
    }

    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      clearDraftEmail();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields);
        focusFirstError(error.fields, IDS);
      } else {
        setFormError(errorMessage(error));
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      page="signup"
      title="Create an account"
      subtitle="Share your first tracked link in a couple of minutes."
      footer={
        <>
          Already have an account?
          <Link to={`/login${location.search}`} viewTransition>
            Log in
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          id={IDS.name}
          label="Name"
          name="name"
          autoComplete="name"
          placeholder="Your full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          hint="Shown to people you share documents with."
        />
        <TextField
          id={IDS.email}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          id={IDS.password}
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        {formError && <FormAlert>{formError}</FormAlert>}
        <Button type="submit" size="lg" block loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
