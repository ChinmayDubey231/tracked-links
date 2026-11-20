import { Link } from 'react-router';
import { PublicShell, Prose } from '../../components/PublicShell';
import { usePageTitle } from '../../lib/usePageTitle';

/* Help and Terms are placeholders until they are designed. Privacy states what is tracked. */

export function HelpPage() {
  usePageTitle('Help');
  return (
    <PublicShell>
      <Prose>
        <h1>Help</h1>
        <p>Tracked Links lets you share a PDF with a separate link for each place you send it, and see how each link gets read.</p>
        <h2>Getting started</h2>
        <ul>
          <li>Upload a PDF from the Documents page. PDFs up to 10 MB are accepted.</li>
          <li>Create a link for each place you share it, such as "TCS application" or "LinkedIn bio".</li>
          <li>Open a document to see views, reading time per page and how far readers got.</li>
        </ul>
        <h2>Reading time</h2>
        <p>
          Time counts only while the document is open in a visible tab and the reader is active. It pauses after about a
          minute without scrolling or moving the pointer.
        </p>
        <p>
          More help will be added here. For now, see the <Link to="/privacy">privacy page</Link> for exactly what is
          recorded.
        </p>
      </Prose>
    </PublicShell>
  );
}

export function PrivacyPage() {
  usePageTitle('Privacy');
  return (
    <PublicShell>
      <Prose>
        <h1>Privacy</h1>
        <p>
          Documents shared through Tracked Links record how they are read, so the person who shared them can see it. A
          note on every shared document says so.
        </p>
        <h2>What is recorded when you open a shared document</h2>
        <ul>
          <li>
            <strong>Opens:</strong> each time the document is opened, with the date and time.
          </li>
          <li>
            <strong>Time per page:</strong> active reading time on each page, counted only while the tab is visible and
            you are active.
          </li>
          <li>
            <strong>Pages reached:</strong> the furthest page you scrolled to.
          </li>
          <li>
            <strong>Device, browser and operating system:</strong> for example "Desktop, Chrome, Windows".
          </li>
          <li>
            <strong>A hashed network address:</strong> your IP address is combined with a secret value and scrambled
            one way before it is stored. The raw address is never saved. It is used to count distinct readers.
          </li>
          <li>
            <strong>Your email address,</strong> only if the link asks for one before showing the document.
          </li>
        </ul>
        <h2>What is not recorded</h2>
        <ul>
          <li>No tracking cookies and no advertising trackers.</li>
          <li>Nothing about other websites you visit.</li>
        </ul>
        <h2>Files</h2>
        <p>
          Uploaded PDFs are kept in private storage. Readers get a link to the file that expires after a few minutes, so
          the stored file address is never shared.
        </p>
      </Prose>
    </PublicShell>
  );
}

export function TermsPage() {
  usePageTitle('Terms');
  return (
    <PublicShell>
      <Prose>
        <h1>Terms</h1>
        <p>Tracked Links is a personal project. Terms of use will be published here.</p>
        <p>Only upload documents you have the right to share.</p>
      </Prose>
    </PublicShell>
  );
}

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <PublicShell>
      <Prose>
        <h1>We couldn't find that page.</h1>
        <p>
          The address may be mistyped, or the page may have moved. Go to the <Link to="/">home page</Link> or your{' '}
          <Link to="/documents">documents</Link>.
        </p>
      </Prose>
    </PublicShell>
  );
}
