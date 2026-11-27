/**
 * True when Selenium, Puppeteer or Playwright drives this browser (navigator.webdriver).
 * Sent with the access request; the server records such views as bots and leaves them
 * out of the numbers.
 */
export function isAutomatedBrowser(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}
