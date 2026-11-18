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
import { checkEmail, compact, focusFirstError, type FieldErrors } from './validation';

const IDS = { name: undefined, email: 'login-email', password: 'login-password' };

export default function LoginPage() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useDraftEmail();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = compact({ email: checkEmail(email), password: password ? undefined : 'Enter your password.' });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      focusFirstError(found, IDS);
      return;
    }

    setSubmitting(true);
    try {
      // On success the route's redirect wrapper sends the user on to ?next= or /documents.
      await login(email.trim(), password);
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
      page="login"
      title="Log in"
      subtitle="Pick up where your links left off."
      footer={
        <>
          New here?
          <Link to={`/signup${location.search}`} viewTransition>
            Create an account
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        {formError && <FormAlert>{formError}</FormAlert>}
        <Button type="submit" size="lg" block loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
