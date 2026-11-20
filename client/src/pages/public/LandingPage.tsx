import { formatSeconds, heatOpacity } from '@tracked-links/shared';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { AppFooter, FooterAnchor, FooterLink } from '../../components/AppFooter';
import { ButtonLink } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { LogoMark } from '../../components/LogoMark';
import { PageThumb } from '../../components/PageThumb';
import { ReachBar } from '../../components/ReachBar';
import { StatusChip, type LinkStatus } from '../../components/StatusChip';
import { useAuth } from '../../lib/auth';
import { GITHUB_URL } from '../../lib/config';
import { cx } from '../../lib/cx';
import { scrollToSection } from '../../lib/scrollToSection';
import { useCountUp } from '../../lib/useCountUp';
import { useInViewOnce } from '../../lib/useInViewOnce';
import { usePageTitle } from '../../lib/usePageTitle';
import { HeroArt } from './HeroArt';
import styles from './LandingPage.module.css';

/*
 * Illustrations use fixed sample data. Each one is either labelled "Sample data"
 * or hidden from assistive technology, so it is never mistaken for real numbers.
 */
const SAMPLE_PAGES = [
  { seconds: 48, reach: 1, lines: [55, 90, 82, 60] },
  { seconds: 31, reach: 0.87, lines: [40, 88, 92, 70] },
  { seconds: 16, reach: 0.74, lines: [48, 86, 78, 52] },
  { seconds: 7, reach: 0.61, lines: [36, 90, 66] },
];

const SECTIONS = [
  { id: 'tracking', label: 'How it works' },
  { id: 'links', label: 'Features' },
  { id: 'privacy', label: 'Viewer privacy' },
];

const SHARE_PLACES = ['Email', 'LinkedIn', 'Job portals', 'WhatsApp', 'Referral forms', 'Your portfolio site'];

/** Limits and timings from docs/spec.md, shown as the band of large numbers. */
const FACTS = [
  { value: '10 MB', text: 'largest PDF you can upload' },
  { value: '60 s', text: 'of inactivity and the clock stops, so an open tab isn’t “reading”' },
  { value: '5–10 s', text: 'between updates while someone is reading' },
  { value: '10+', text: 'random characters in every link, so links can’t be guessed' },
];

type Tone = 'accent' | 'heat' | 'faint';

const VIEW_LOG: { time: string; event: string; tone: Tone; detail: string; value: string; detailTone?: Tone; valueTone?: Tone }[] = [
  { time: '11:42:03', event: 'view.started', tone: 'accent', detail: 'priya.s@example.com', value: 'desktop', valueTone: 'faint' },
  { time: '11:42:51', event: 'page.read', tone: 'heat', detail: 'page 1', value: '48s' },
  { time: '11:43:22', event: 'page.read', tone: 'heat', detail: 'page 2', value: '31s' },
  { time: '11:43:38', event: 'page.read', tone: 'heat', detail: 'page 3', value: '16s' },
  { time: '11:43:45', event: 'page.read', tone: 'heat', detail: 'page 4', value: '7s' },
  { time: '11:43:45', event: 'view.ended', tone: 'accent', detail: '4 of 4 pages', value: '1m 42s' },
  { time: '11:43:46', event: 'beacon', tone: 'faint', detail: 'final update saved', value: 'ok', detailTone: 'faint', valueTone: 'accent' },
];

const LINK_STATES = [
  { label: 'Created', className: styles.stateCreated },
  { label: 'Shared', className: styles.stateShared },
  { label: 'Opened', className: styles.stateOpened },
  { label: 'Read 4 of 4', className: styles.stateRead },
  { label: 'Expired', className: styles.stateExpired },
];

interface SampleLink {
  label: string;
  path: string;
  views: number;
  status: LinkStatus;
}

const SAMPLE_LINKS: SampleLink[] = [
  { label: 'TCS application', path: '/v/k3Xp9aQm2Z', views: 9, status: 'active' },
  { label: 'LinkedIn bio', path: '/v/chinmay-resume', views: 7, status: 'active' },
  { label: 'Infosys application', path: '/v/Rt7wLb4nYe', views: 6, status: 'active' },
  { label: 'Wipro referral', path: '/v/8HdQs1VzTc', views: 1, status: 'expired' },
];

const LINK_COLUMNS: Column<SampleLink>[] = [
  { id: 'label', header: 'Label', cell: (link) => <span className={styles.strong}>{link.label}</span> },
  { id: 'path', header: 'Link', cell: (link) => <span className={styles.linkPath}>{link.path}</span> },
  {
    id: 'views',
    header: 'Views',
    align: 'right',
    width: '76px',
    cell: (link) => <span className={styles.linkViews}>{link.views}</span>,
  },
  { id: 'status', header: 'Status', width: '108px', cell: (link) => <StatusChip status={link.status} /> },
];

const STEPS = [
  {
    title: 'Reader opens the link',
    code: 'POST /v/:slug/access',
    text: 'The view is created by the page’s own script, which preview bots don’t run. The file arrives through a link that expires in minutes.',
  },
  {
    title: 'Pages are timed on screen',
    code: 'IntersectionObserver',
    text: 'Only the page in view gains time, only while the tab is visible, and only until the reader goes idle.',
  },
  {
    title: 'Small updates as they read',
    code: 'heartbeat every 5–10 s',
    text: 'Each update adds only the new seconds, so nothing is double counted.',
  },
  {
    title: 'A final save on close',
    code: 'navigator.sendBeacon',
    text: 'The last stretch of reading is sent even as the tab closes, then it shows on your dashboard.',
  },
];

const VIEWER_FACTS = [
  { label: 'Account needed to view', value: 'No' },
  { label: 'Tracking notice', value: 'In every viewer footer' },
  { label: 'Network address', value: 'Stored hashed only' },
  { label: 'Email', value: 'Only if the link asks' },
  { label: 'Raw file address', value: 'Never exposed' },
];

const STACK = [
  { name: 'React and react-pdf', text: 'The reader and the dashboard, with pages rendered by pdf.js.' },
  { name: 'Node and Express', text: 'JWT sign-in, upload checks and rate limits on every public route.' },
  { name: 'MongoDB', text: 'One record per reading session, updated in place as time adds up.' },
  { name: 'Private storage', text: 'Files are only ever served through short-lived signed links.' },
];

/** Heights in px of the stepped bars behind the closing call to action. */
const CLOSING_BARS = [160, 104, 54, 24];

/**
 * Pinned to the top of the screen. On wide screens the section links and account buttons sit in one row;
 * below 860px they move into a drop-down opened by the Menu button, so the pinned bar stays one row tall.
 */
function LandingHeader({ signedIn }: { signedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape or a tap outside the header closes the drop-down.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  function goToSection(event: MouseEvent<HTMLAnchorElement>) {
    setMenuOpen(false);
    scrollToSection(event);
  }

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={cx('container', styles.headerInner)}>
        <Link to="/" className={styles.brand}>
          <LogoMark />
          Tracked Links
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="landing-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon open={menuOpen} />
          Menu
        </button>
        <nav id="landing-nav" aria-label="Main" className={cx(styles.nav, menuOpen && styles.navOpen)}>
          {SECTIONS.map((section) => (
            <Link key={section.id} to={`#${section.id}`} className={styles.navLink} onClick={goToSection}>
              {section.label}
            </Link>
          ))}
          <div className={styles.navActions}>
            {signedIn ? (
              <ButtonLink to="/documents">Your documents</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary" className={styles.headerSecondary}>
                  Log in
                </ButtonLink>
                <ButtonLink to="/signup">Create an account</ButtonLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default function LandingPage() {
  usePageTitle(null);
  const signedIn = useAuth().status === 'authenticated';
  const startTo = signedIn ? '/documents' : '/signup';

  return (
    <div className={styles.page}>
      <LandingHeader signedIn={signedIn} />

      <main id="main" tabIndex={-1} className={styles.main}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <svg aria-hidden="true" className={styles.heroLines} viewBox="840 0 440 440" width="440" height="440">
            <path d="M842 18L1222 430" opacity="0.4" />
            <path d="M857 18L1237 430" opacity="0.18" />
          </svg>
          <div className={cx('container', styles.heroInner)}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              PDF tracking for your job search
            </span>
            <div className={styles.heroMain}>
              <div className={styles.heroCopy}>
                <h1 id="hero-title" className={styles.heroTitle}>
                  See what happens <span className={styles.heroAccent}>after you hit send.</span>
                </h1>
                <p className={styles.heroLead}>Know which pages a recruiter read, and which ones they skipped.</p>
                <div className={styles.heroActions}>
                  <ButtonLink to={startTo} className={styles.cta}>
                    <UploadIcon />
                    {signedIn ? 'Go to your documents' : 'Start tracking your PDF'}
                  </ButtonLink>
                  <ButtonLink to="#tracking" variant="secondary" className={styles.cta} onClick={scrollToSection}>
                    See how it works
                  </ButtonLink>
                </div>
                <span className={styles.heroNote}>Viewers don’t need an account.</span>
              </div>
              <HeroArt className={styles.heroArt} />
            </div>

            <HeroSamples />

            <ul className={styles.points}>
              <li className={styles.point}>
                <strong className={styles.pointTitle}>Tracking for job seekers</strong>
                <span className={styles.pointText}>
                  Share your résumé as a link and see which pages get read, and for how long.
                </span>
              </li>
              <li className={styles.point}>
                <strong className={styles.pointTitle}>Honest reading time</strong>
                <span className={styles.pointText}>
                  Time counts only while a page is on screen and the reader is active.
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className={cx('container', styles.places)} aria-labelledby="places-title">
          <p id="places-title" className={styles.placesLabel}>
            Paste it anywhere
          </p>
          <ul className={styles.placeList}>
            {SHARE_PLACES.map((place) => (
              <li key={place} className={styles.chip}>
                {place}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.band} aria-label="Limits and timings">
          <ul className={cx('container', styles.facts)}>
            {FACTS.map((fact) => (
              <li key={fact.value} className={styles.fact}>
                <span className={styles.factValue}>{fact.value}</span>
                <span className={styles.factText}>{fact.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={cx('container', styles.section)} aria-labelledby="pages-title">
          <div className={styles.sectionIntro}>
            <h2 id="pages-title" className={styles.sectionTitle}>
              Every open, page by page. Not just a view count.
            </h2>
            <p className={styles.sectionLead}>
              Each visit becomes a record of which pages were on screen and for how long. Your dashboard rolls those
              records up into a heatmap you can read in a second.
            </p>
          </div>
          <div className={styles.split}>
            <HeatmapCard />
            <ViewLog />
          </div>
        </section>

        <section id="links" className={styles.band} aria-labelledby="links-title">
          <div className={cx('container', styles.bandInner)}>
            <div className={styles.bandCopy}>
              <h2 id="links-title" className={styles.sectionTitle}>
                One link per place. Each with its own life.
              </h2>
              <p className={styles.sectionLead}>
                Label a link after where it goes, so “TCS application” and “LinkedIn bio” are counted apart. Ask for an
                email, add a password, set an expiry, or switch a link off.
              </p>
              <ol aria-label="Link states" className={styles.states}>
                {LINK_STATES.map((state, index) => (
                  <li key={state.label} className={styles.state}>
                    <span className={cx(styles.stateChip, state.className)}>{state.label}</span>
                    {index < LINK_STATES.length - 1 && (
                      <span aria-hidden="true" className={styles.stateArrow}>
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.tableWrap}>
              <DataTable
                caption="Sample links for one document"
                columns={LINK_COLUMNS}
                rows={SAMPLE_LINKS}
                rowKey={(link) => link.path}
                minWidth={520}
              />
            </div>
          </div>
        </section>

        <section id="tracking" className={cx('container', styles.section)} aria-labelledby="tracking-title">
          <div className={styles.sectionIntro}>
            <h2 id="tracking-title" className={styles.sectionTitle}>
              Honest numbers, by design.
            </h2>
            <p className={styles.sectionLead}>
              Link previews in chat apps never count as views, idle tabs stop the clock, and the last few seconds are
              saved even when the reader closes the tab.
            </p>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.stepCard}>
                <span aria-hidden="true" className={styles.stepNumber}>
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <code className={styles.code}>{step.code}</code>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className={styles.band} aria-labelledby="privacy-title">
          <div className={cx('container', styles.privacyInner)}>
            <div className={styles.privacyCopy}>
              <h2 id="privacy-title" className={styles.sectionTitle}>
                Fair to the people who read your document.
              </h2>
              <p className={styles.sectionLead}>
                Recruiters open your link like any other. They’re told it’s tracked, and nothing about them is kept that
                they didn’t choose to give.
              </p>
            </div>
            <dl className={styles.privacyFacts}>
              {VIEWER_FACTS.map((fact) => (
                <div key={fact.label} className={styles.privacyRow}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={cx('container', styles.section, styles.stackSection)} aria-labelledby="stack-title">
          <h2 id="stack-title" className={styles.stackTitle}>
            Under the hood
          </h2>
          <ul className={styles.stack}>
            {STACK.map((item) => (
              <li key={item.name} className={styles.stackCard}>
                <span className={styles.strong}>{item.name}</span>
                <span className={styles.stackText}>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div aria-hidden="true" className={styles.closingBars}>
            {CLOSING_BARS.map((height) => (
              <span key={height} className={styles.closingBar} style={{ height }} />
            ))}
          </div>
          <div className={cx('container', styles.closingInner)}>
            <h2 id="closing-title" className={styles.closingTitle}>
              Send your next application with a link you can follow.
            </h2>
            <Link to={startTo} className={styles.inverseButton}>
              {signedIn ? 'Go to your documents' : 'Create an account'}
            </Link>
          </div>
        </section>
      </main>

      <AppFooter
        before={
          <>
            <FooterLink to="#tracking" onClick={scrollToSection}>
              How it works
            </FooterLink>
            <FooterLink to="#privacy" onClick={scrollToSection}>
              Viewer privacy
            </FooterLink>
          </>
        }
        after={
          GITHUB_URL && (
            <FooterAnchor href={GITHUB_URL} external>
              GitHub
            </FooterAnchor>
          )
        }
      />
    </div>
  );
}

/** Three lines, or a cross while the drop-down is open. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

/** Two sample cards under the hero: one link read in full, one not opened yet. */
/** `--delay` for a staggered CSS animation; the stylesheet reads it as animation-delay. */
function delayStyle(ms: number) {
  return { '--delay': `${ms}ms` } as CSSProperties;
}

/** Sample reading session in the hero card: 1m 42s across all 4 pages. */
const HERO_SECONDS = 102;

/*
 * Hero card, once on screen: the reading time counts up to 1m 42s while the four page bars fill one after
 * another ("N of 4" ticks with each bar), then the "Read in full" chip appears.
 */
const HERO_BAR_START = 250;
const HERO_BAR_STEP = 250;
const HERO_BAR_FILL = 300;
const HERO_FINALE = HERO_BAR_START + 3 * HERO_BAR_STEP + HERO_BAR_FILL + 100;

function HeroSamples() {
  const readRef = useRef<HTMLDivElement>(null);
  const play = useInViewOnce(readRef, 0.5);
  const seconds = useCountUp(HERO_SECONDS, play, { duration: 1300, delay: HERO_BAR_START });
  const pagesReached = useCountUp(SAMPLE_PAGES.length, play, {
    // Ticks as each bar finishes filling.
    delay: HERO_BAR_START + HERO_BAR_FILL - HERO_BAR_STEP,
    duration: SAMPLE_PAGES.length * HERO_BAR_STEP,
    stepped: true,
  });

  return (
    <figure className={styles.samples}>
      <figcaption className={styles.samplesCaption}>
        <span className={styles.samplesTitle}>Know what happens after you hit send</span>
        <span className={styles.caption}>Sample data</span>
      </figcaption>
      <div className={styles.sampleCards}>
        <div ref={readRef} className={cx(styles.sampleCard, styles.sampleRead, play ? styles.play : styles.waiting)}>
          <div className={styles.sampleHead}>
            <span className={styles.sampleTitle}>See how your resume is read</span>
            <span className={cx(styles.chipBrand, styles.finale)} style={delayStyle(HERO_FINALE)}>
              Read in full
            </span>
          </div>
          <span className={styles.sampleLabel}>TCS application</span>
          <div className={styles.sampleStats}>
            <span className={styles.sampleStat}>
              <span className={styles.sampleNumber}>
                <span aria-hidden="true">{formatSeconds(seconds * 1000)}</span>
                <span className="visually-hidden">{formatSeconds(HERO_SECONDS * 1000)}</span>
              </span>
              <span className={styles.sampleStatLabel}>Time spent reading</span>
            </span>
            <span className={styles.sampleStat}>
              <span className={styles.sampleNumber}>
                <span aria-hidden="true">
                  {pagesReached} of {SAMPLE_PAGES.length}
                </span>
                <span className="visually-hidden">
                  {SAMPLE_PAGES.length} of {SAMPLE_PAGES.length}
                </span>
              </span>
              <span className={styles.sampleStatLabel}>Pages reached</span>
            </span>
            <span className={styles.sampleStat}>
              <span className={cx(styles.sampleNumber, styles.sampleNumberSmall)}>2 hours ago</span>
              <span className={styles.sampleStatLabel}>Latest activity</span>
            </span>
          </div>
          <div role="img" aria-label="All 4 pages reached" className={styles.segments}>
            {SAMPLE_PAGES.map((_, index) => (
              <span key={index} className={styles.segment}>
                <span className={styles.segmentBar} style={delayStyle(HERO_BAR_START + index * HERO_BAR_STEP)} />
                Page {index + 1}
              </span>
            ))}
          </div>
          <div className={styles.sampleFoot}>
            <span className={styles.muted}>Shared with priya.s@example.com</span>
            <span className={cx(styles.sampleFootStrong, styles.finale)} style={delayStyle(HERO_FINALE)}>
              All pages reached
            </span>
          </div>
        </div>

        <div className={cx(styles.sampleCard, styles.sampleFollow)}>
          <span className={styles.sampleTitle}>Know when to follow up</span>
          <span className={styles.sampleFollowLink}>Accenture application</span>
          <span className={styles.chipPlain}>Not opened</span>
          <p className={styles.followText}>
            Sent 3 days ago. Your resume hasn’t been opened yet — a good time to check in.
          </p>
          {/* Looks like the dashboard's button, but this is an illustration, so it does nothing. */}
          <span aria-hidden="true" className={styles.fakeButton}>
            Prepare a follow-up
          </span>
        </div>
      </div>
    </figure>
  );
}

/*
 * The heatmap and the view log play as one story once on screen: a log line appears every LOG_STEP ms,
 * and as each "page.read" line appears (log lines 2 to 5), that page's heat, seconds and reach bar fill in.
 */
const LOG_STEP = 250;
const HEAT_FILL = 600;
const heatDelay = (pageIndex: number) => (pageIndex + 1) * LOG_STEP;

function HeatmapCard() {
  const ref = useRef<HTMLDivElement>(null);
  const play = useInViewOnce(ref, 0.5);

  return (
    <div ref={ref} className={cx(styles.card, play ? styles.play : styles.waiting)}>
      <div className={styles.cardTop}>
        <span className={styles.cardFile}>Resume and projects.pdf</span>
        <span className={styles.sampleChip}>Sample data</span>
      </div>
      <span className={styles.cardHeadline}>Reading time falls after page two.</span>
      <div
        role="img"
        aria-label={`Sample heatmap: ${SAMPLE_PAGES.length} pages shaded by average reading time, ${SAMPLE_PAGES.map((page) => page.seconds).join(', ')} seconds, reached by ${SAMPLE_PAGES.map((page) => Math.round(page.reach * 100)).join(', ')} percent of views.`}
        className={styles.heatmap}
      >
        {SAMPLE_PAGES.map((page, index) => (
          <HeatPage key={index} page={page} index={index} play={play} />
        ))}
      </div>
    </div>
  );
}

/** One page of the sample heatmap. The seconds count up while the heat and reach bar fill in. */
function HeatPage({ page, index, play }: { page: (typeof SAMPLE_PAGES)[number]; index: number; play: boolean }) {
  const seconds = useCountUp(page.seconds, play, { duration: HEAT_FILL, delay: heatDelay(index) });
  return (
    <div className={styles.heatPage} style={delayStyle(heatDelay(index))}>
      <PageThumb
        image={<PageSketch lines={page.lines} />}
        opacity={heatOpacity(page.seconds)}
        overlayClassName={styles.heatOverlay}
      />
      <span className={styles.heatSeconds}>{formatSeconds(seconds * 1000)}</span>
      <span className={styles.heatReach}>
        Page {index + 1} · {Math.round(page.reach * 100)}% reached
      </span>
      <ReachBar value={page.reach} fillClassName={styles.reachGrow} />
    </div>
  );
}

/** One reading session as the events the viewer page sends; plays out line by line once on screen. */
function ViewLog() {
  const ref = useRef<HTMLDivElement>(null);
  const play = useInViewOnce(ref, 0.5);

  return (
    <div ref={ref} className={cx(styles.log, play ? styles.play : styles.waiting)}>
      <div className={styles.logTop}>
        <span>view log · TCS application</span>
        <span>sample</span>
      </div>
      <div className={styles.logScroll} role="region" aria-label="Sample view log" tabIndex={0}>
        <ol className={styles.logList}>
          {VIEW_LOG.map((entry, index) => (
            <li key={index} className={styles.logRow} style={delayStyle(index * LOG_STEP)}>
              <span aria-hidden="true" className={styles.logLine}>
                {index + 1}
              </span>
              <span className={styles.faint}>{entry.time}</span>
              <span className={styles[entry.tone]}>{entry.event}</span>
              <span className={entry.detailTone && styles[entry.detailTone]}>{entry.detail}</span>
              <span className={entry.valueTone && styles[entry.valueTone]}>{entry.value}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** A page drawn with a heading bar and text lines; widths in percent. */
function PageSketch({ lines }: { lines: number[] }) {
  return (
    <span className={styles.sketch}>
      {lines.map((width, index) => (
        <span key={index} className={index === 0 ? styles.sketchHeading : styles.sketchLine} style={{ width: `${width}%` }} />
      ))}
    </span>
  );
}
