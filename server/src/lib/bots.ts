/*
 * Server-side bot filtering, on top of the spec's main defence: a View is only created by
 * the viewer page's own script, which link-preview bots don't run. This catches the rest:
 * crawlers and previewers that do run JavaScript, scripts, and automated browsers.
 * Their views are kept with isBot: true and left out of every number.
 */

/** Every mainstream browser's user agent starts with "Mozilla/5.0". curl, WhatsApp, Slack and scripts don't. */
const BROWSER_PREFIX = /^Mozilla\/5\.0 /;

/**
 * Words crawlers and automation put in a browser-like user agent: Googlebot, LinkedInBot,
 * Discordbot, HeadlessChrome, Chrome-Lighthouse, BingPreview, facebookexternalhit...
 */
const BOT_WORDS = /bot\b|crawl|spider|slurp|headless|lighthouse|phantomjs|preview|externalhit|scanner|validator|archiver/i;

/** Real phones whose model name contains "bot" (Android user agents include the model). */
const PHONE_MODELS_WITH_BOT = /\bcubot\b/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim();
  if (!ua) return true;
  if (!BROWSER_PREFIX.test(ua)) return true;
  return BOT_WORDS.test(ua.replace(PHONE_MODELS_WITH_BOT, ''));
}
