import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { cx } from '../../lib/cx';
import { ReaderFrame, ZoomGroup } from './ReaderFrame';
import styles from './Viewer.module.css';

export type LoadingStep = 'link' | 'file' | 'pages';

const STEPS: { key: LoadingStep; label: string; slowHint: string }[] = [
  {
    key: 'link',
    label: 'Opening the link',
    // The API sleeps when nobody has used it for a while; waking it takes up to a minute.
    slowHint: 'Still working on it. After a quiet spell, opening can take up to a minute.',
  },
  {
    key: 'file',
    label: 'Downloading the document',
    slowHint: 'Still downloading. On a slow connection this takes a little longer.',
  },
  {
    key: 'pages',
    label: 'Preparing the pages',
    slowHint: 'Almost there. Long documents take a moment to prepare.',
  },
];

/** How long a step runs before the card explains the wait. */
const SLOW_AFTER_MS = 6000;

/** True once the same step has been running for a while. Starts again when the step changes. */
function useSlow(step: LoadingStep) {
  const [slowStep, setSlowStep] = useState<LoadingStep | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlowStep(step), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [step]);
  return slowStep === step;
}

/** Lines of the placeholder page, loosely a resume: name, then headed sections. Widths in %. */
const SHEET: { kind: 'title' | 'section' | 'line' | 'gap'; width?: number }[] = [
  { kind: 'title', width: 46 },
  { kind: 'line', width: 64 },
  { kind: 'gap' },
  { kind: 'section', width: 22 },
  { kind: 'line', width: 94 },
  { kind: 'line', width: 88 },
  { kind: 'line', width: 91 },
  { kind: 'line', width: 58 },
  { kind: 'gap' },
  { kind: 'section', width: 28 },
  { kind: 'line', width: 90 },
  { kind: 'line', width: 96 },
  { kind: 'line', width: 72 },
  { kind: 'gap' },
  { kind: 'section', width: 18 },
  { kind: 'line', width: 86 },
  { kind: 'line', width: 52 },
];

/**
 * A page-shaped placeholder where the document will appear, with a card saying what is
 * happening: the step, the download percentage when the size is known, and a note if it is slow.
 */
export function LoadingSheet({ step, progress = null }: { step: LoadingStep; progress?: number | null }) {
  const index = STEPS.findIndex((item) => item.key === step);
  const current = STEPS[index]!;
  const slow = useSlow(step);
  const percent = step === 'file' && progress !== null ? Math.round(progress * 100) : null;

  return (
    <div className={styles.loadingSheet}>
      <div className={styles.sheetLines} aria-hidden="true">
        {SHEET.map((item, key) =>
          item.kind === 'gap' ? (
            <span key={key} className={styles.sheetGap} />
          ) : (
            <span
              key={key}
              className={cx(styles.sheetLine, item.kind === 'title' && styles.sheetTitle, item.kind === 'section' && styles.sheetSection)}
              style={{ width: `${item.width}%` }}
            />
          ),
        )}
      </div>

      <div className={styles.loadingCardWrap}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingHead}>
            <span className={styles.loadingSpinner} aria-hidden="true" />
            {/* Only the step and the note are announced: a running percentage would be noisy. */}
            <p className={styles.loadingLabel} role="status">
              {current.label}…{slow && <span className="visually-hidden"> {current.slowHint}</span>}
            </p>
            {percent !== null && (
              <span className={styles.loadingPercent} aria-hidden="true">
                {percent}%
              </span>
            )}
          </div>

          <div className={styles.stepMeter} aria-hidden="true">
            {STEPS.map((item, stepIndex) => (
              <span
                key={item.key}
                className={cx(styles.stepSegment, stepIndex < index && styles.stepDone)}
              >
                {stepIndex === index &&
                  (percent !== null ? (
                    <span className={styles.stepFill} style={{ width: `${percent}%` }} />
                  ) : (
                    <span className={styles.stepSweep} />
                  ))}
              </span>
            ))}
          </div>

          <p className={styles.loadingMeta} aria-hidden="true">
            Step {index + 1} of {STEPS.length}
          </p>
          {slow && (
            <p className={styles.loadingHint} aria-hidden="true">
              {current.slowHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The whole reader in its loading state, for the moments before the reader itself has loaded:
 * the link's details, the access request and the reader's code. Same header as the reader.
 */
export function ViewerLoading({
  step,
  title,
  pageCount,
  allowDownload = false,
}: {
  step: LoadingStep;
  title?: string;
  pageCount?: number;
  allowDownload?: boolean;
}) {
  return (
    <ReaderFrame
      title={title}
      pageLabel={pageCount ? `Page 1 of ${pageCount}` : undefined}
      loading
      controls={
        <>
          <ZoomGroup />
          {allowDownload && <Button disabled>Download</Button>}
        </>
      }
    >
      <div className={styles.pages}>
        <LoadingSheet step={step} />
      </div>
    </ReaderFrame>
  );
}
