# Tracked Links

Upload a PDF (usually a resume), create a separate share link for each place you send it, and see how each link gets read: opens, time per page, pages reached and device. Viewers never need an account.

> Build status: **all four phases are built and live at [trackedlinks.vercel.app](https://trackedlinks.vercel.app).** What's left is recording a demo GIF. See [Build progress](#build-progress).

## Stack

- **Client:** React 19 + Vite, React Router, TanStack Query, `react-pdf` (pdf.js). CSS Modules on top of the design tokens.
- **Server:** Node + Express 5, JWT auth, bcrypt (`bcryptjs`), Mongoose 9 on MongoDB.
- **Files:** Backblaze B2 through its S3-compatible API (private bucket, short-lived presigned URLs). Any S3-compatible service works, including Cloudflare R2 and AWS S3. In development a local-disk driver serves HMAC-signed, expiring URLs instead.
- **Email:** Resend, through its HTTP API (no SDK).
- **Hosting:** Vercel for the client, Render for the API, MongoDB Atlas for the database. All on free plans.
- **Language:** TypeScript everywhere, with types and formatting rules shared between client and server.

## Repository layout

```
client/       React app (Vite). Deployed to Vercel.
server/       Express API. Deployed to Render.
shared/       Types and pure helpers used by both (durations, relative times, headlines, heat opacity).
design/       Static screen references and design tokens. Open design/screens/index.html in a browser.
docs/         The original product spec.
.github/      CI (type-check, test, build) and the keep-alive ping.
render.yaml   Render Blueprint for the API.
```

## Running it locally

**Prerequisites:** Node 20.19 or newer, and MongoDB (a local `mongod` or a free Atlas cluster).

```bash
npm install

# Server config: copy the example, then set JWT_SECRET and IP_HASH_SALT.
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # paste as JWT_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"   # paste as IP_HASH_SALT

# Optional: client config (the defaults point at localhost:4000).
cp client/.env.example client/.env.local

npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000 (health check at `/health`)

With no `S3_*` values set, uploads are stored in `server/storage/` (gitignored). With no `RESEND_API_KEY`, the first-open email is printed in the API's console instead of sent.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API and the client together, with reload on change. |
| `npm test` | Unit tests (`shared`) and API integration tests (`server`, needs MongoDB). |
| `npm run typecheck` | Type-checks every workspace. |
| `npm run build` | Builds the API to `server/dist` and the client to `client/dist`. |
| `npm run storage:check -w server` | Tests the `S3_*` settings against the real bucket: upload, signed read, CORS, privacy, delete. |

Server tests use the database in `MONGODB_URI_TEST`, defaulting to `mongodb://127.0.0.1:27017/tracked-links-test`, and drop it when they finish.

## Environment variables

Every variable is listed, with comments, in [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). The ones you must set for production:

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | server | Atlas connection string. |
| `JWT_SECRET` | server | At least 32 random characters. |
| `IP_HASH_SALT` | server | Salt for hashing viewer IP addresses. |
| `CLIENT_ORIGIN` | server | The frontend URL; CORS allows only this origin. |
| `PUBLIC_BASE_URL` | server | The frontend URL, used for the link in the first-open email. |
| `API_BASE_URL` | server | The API's public URL. Not needed on Render, which sets `RENDER_EXTERNAL_URL`. |
| `TRUST_PROXY` | server | `1` on Render, so rate limits see the real client IP. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | server | File storage (Backblaze B2). `S3_REGION` is optional. Without them, files go to local disk, which Render wipes on every restart. |
| `RESEND_API_KEY`, `EMAIL_FROM` | server | The first-open email. Without a key the email is only printed in the log. |
| `VITE_API_URL` | client | The API URL. |
| `VITE_PUBLIC_BASE_URL` | client | The frontend URL, used to build share links (`[YOUR DOMAIN]/v/<slug>`). |

In production the API refuses to start while `CLIENT_ORIGIN`, `PUBLIC_BASE_URL` or `API_BASE_URL` is still a localhost address, and says which one to fix.

## Setting up Backblaze B2

The free tier covers 10 GB and needs no card.

1. **Buckets → Create a Bucket.** Bucket names are shared across all B2 accounts, so pick something unique. Set files to **Private**. Leave encryption and object lock off. Copy the bucket name into `S3_BUCKET`, and the **Endpoint** shown under it (for example `s3.us-east-005.backblazeb2.com`) into `S3_ENDPOINT`.
2. **Application Keys → Add a New Application Key.** Limit it to that bucket, with **Read and Write** access. Leave the file name prefix and duration empty. Copy `keyID` into `S3_ACCESS_KEY_ID` and `applicationKey` into `S3_SECRET_ACCESS_KEY`. The secret is shown only once. Do not use the master application key: the S3 API rejects it, and it can delete buckets.
3. **CORS Rules** on the bucket: share the bucket with your frontend's origin (`http://localhost:5173` in development, your Vercel URL in production) and apply the rule to the **S3 Compatible API**. The viewer loads PDFs straight from the bucket, so without this rule they fail to load. Sharing with every origin is also acceptable: a file still cannot be read without a valid signed URL.
4. Run `npm run storage:check -w server`. It reports what is wrong if any step above is off.

Cloudflare R2 or AWS S3 work with the same variables: set `S3_ENDPOINT` to the service's S3 endpoint, and `S3_REGION` to `auto` for R2.

## Deploying

The API goes on Render and the client on Vercel, both on free plans. You also need free accounts on MongoDB Atlas, Backblaze B2 and Resend. Choose the Vercel project name before you start: the frontend's address will be `https://<project-name>.vercel.app`, and the API won't start without it.

1. **MongoDB Atlas.** Create a free cluster and a database user. Under **Network Access**, allow `0.0.0.0/0`: Render's free plan has no fixed outgoing IP address. Copy the connection string and add a database name after the host, for example `…mongodb.net/tracked-links?retryWrites=true&w=majority`.
2. **Backblaze B2.** Follow [Setting up Backblaze B2](#setting-up-backblaze-b2), with the Vercel address in the CORS rule.
3. **Resend.** Create an API key. The default sender, `onboarding@resend.dev`, only delivers to the address your Resend account uses, which is enough while you are the only user. To email anyone else, verify a domain in Resend and set `EMAIL_FROM` to an address on it.
4. **Render.** Choose **New → Blueprint**, then this repository. Render reads [`render.yaml`](render.yaml), generates `JWT_SECRET` and `IP_HASH_SALT`, and asks once for the rest: `MONGODB_URI`, `CLIENT_ORIGIN` and `PUBLIC_BASE_URL` (both the Vercel address, with no trailing slash), the four `S3_*` values and `RESEND_API_KEY`. The region is Singapore, the closest to an Atlas cluster in Mumbai. If your database is somewhere else, change the region in `render.yaml` before the first deploy, because Render can't move a service later. When the deploy finishes, open `https://<service>.onrender.com/health`.
5. **Vercel.** Choose **Add New → Project**, import this repository and set **Root Directory** to `client`. Vercel detects Vite. Add `VITE_API_URL` (the Render address), `VITE_PUBLIC_BASE_URL` (the Vercel address) and, if you want the GitHub link on the landing page, `VITE_GITHUB_URL`. Then deploy. These values are built into the bundle, so redeploy after changing any of them.
6. **Keep-alive.** Render's free plan puts the API to sleep after 15 minutes without traffic, and waking it takes about a minute. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add `API_URL` with the Render address. [`keep-alive.yml`](.github/workflows/keep-alive.yml) then pings `/health` every 10 minutes from about 7:30 am to 12:30 am Indian time. That's about 530 hours a month, which leaves room in the 750 free hours Render gives a whole workspace. Overnight, the first open takes about a minute. To keep it awake around the clock, change the cron hours `2-18` to `*` (about 744 hours, so only if it's your only free service). GitHub sometimes starts scheduled runs late, and turns them off in a public repository after 60 days with no activity.

After that:

- Every pull request and every push to `main` runs [CI](.github/workflows/ci.yml): type-check, tests against MongoDB 7, build.
- Render deploys the API only after CI passes, and only when `server/`, `shared/`, the root package files or `render.yaml` changed.
- Vercel skips a build when nothing in `client/`, `shared/` or the lockfile changed. [`client/vercel.json`](client/vercel.json) also sends every route to the app and adds the security headers listed below.

## How the security requirements are met

- **Private files:** the bucket is never public and storage keys never leave the server. Clients only get presigned URLs that expire after `SIGNED_URL_TTL_SECONDS` (default 5 minutes).
- **Uploads:** checked by content (the `%PDF-` header, then parsed with `pdf-lib` to count pages), capped at 10 MB, and rate-limited per account.
- **Auth:** passwords hashed with bcrypt (cost 12). Log-in takes the same time whether or not the email exists, and returns the same message either way. Sign-up and log-in are rate-limited per IP.
- **Ownership:** every document route checks the owner and answers 404 for anything else, so ids can't be probed.
- **CORS** allows only `CLIENT_ORIGIN`; secrets live in environment variables; `helmet` sets security headers on the API.
- **Frontend headers:** Vercel sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns off camera, microphone and location. Share links (`/v/…`) also get `X-Robots-Tag: noindex`, so search engines don't list them.
- **Rate limits:** besides the limits named in this list, heartbeats, public link reads and every owner route (`/documents`, `/links`) have their own ceilings, set well above normal use, so a script or a stuck loop can't hammer the database.
- **Share links:** slugs are 10 random letters and digits. Link passwords are hashed with bcrypt, and `POST /v/:slug/access` is rate-limited per IP, so passwords can't be guessed quickly.
- **No views from link previews:** WhatsApp, LinkedIn and Slack fetch links to build previews but don't run JavaScript. A View is only created when the viewer page calls `POST /v/:slug/access`, never by the page request.
- **Bots that do run JavaScript** (`server/src/lib/bots.ts`): a View is marked as a bot when the user agent doesn't look like a browser's, when it names a crawler or headless browser (Googlebot, LinkedInBot, HeadlessChrome, Lighthouse and others), or when the viewer reports `navigator.webdriver`, which Selenium, Puppeteer and Playwright set. Bot views are kept with `isBot: true` but left out of every number, and they never trigger the first-open email.
- **Reading time can't be faked from outside:** each View gets a token, and heartbeats without it are refused. One heartbeat adds at most two minutes.
- **Viewer privacy:** only a salted hash of the IP address is stored. The gate and the reader both say that views and reading time are recorded, with a link to what is tracked. The owner opening their own link is not recorded.
- **"Allow download" off** hides the button and the server issues no download URL. It is a deterrent only: the PDF is still shown, and screenshots can't be stopped.

## How reading time is measured

The viewer follows `docs/spec.md` section 7 (code in `client/src/pages/viewer/tracker.ts`):

1. The viewer calls `POST /v/:slug/access`, which creates the View with one entry per page.
2. An `IntersectionObserver` picks the page with the most height on screen.
3. Every second, time goes to that page, but only while the tab is visible (Page Visibility API) and the reader has scrolled, moved the pointer or pressed a key in the last 60 seconds.
4. Every 10 seconds a heartbeat sends the time added since the last one; the server adds it with `$inc`.
5. When the tab is hidden or closed, `navigator.sendBeacon` sends what is left. Heartbeats go as `text/plain` so the browser can send them to the API's origin without a CORS preflight, which a beacon cannot do.

## How the numbers are worked out

The server computes every figure from View records (`server/src/lib/analytics.ts`). Views with no active reading time are left out, so a page that was opened and closed straight away doesn't count. So are views marked as bots. `GET /documents/:id/analytics` gets the stats and the per-page numbers in a single aggregate query with `$facet`.

- **Unique viewers:** distinct emails where the link asked for one, otherwise distinct hashed network addresses.
- **Average time on page p:** all time spent on page p, divided by the number of views that reached page p. A quick skim by someone who stopped early doesn't drag down the pages they never saw.
- **Reach for page p:** the share of views whose furthest page was p or later.
- **Heat shading:** `0.6 × min(average seconds, 50) / 50`, never below 0.06.
- **Headline:** the biggest drop in average time between one page and the next ("Reading time falls after page two."). With fewer than 3 views it says there aren't enough views yet.
- **Read in full / Stopped at page n:** taken from the link's **latest** view. If that view reached the last page, the link is "Read in full". Otherwise it is "Stopped at page n", where n is the furthest page that view reached. The latest view is used because it shows where things stand now, and because the Link screen puts the chip next to "Latest view: … read 3 of 4 pages".
- **Date range** (All time, 30 or 7 days) covers the headline, the heatmap and the stats. The Links card and Recent views always cover all time, so each link's view count matches its own Link screen.
- **Not opened:** a link that is on, hasn't expired and has no views. The Documents screen names the one sent longest ago.

## First-open email

The first time someone reads a link, its owner gets an email saying who opened it (their email if the link asked for one, otherwise "Someone") and which document, with a button to the link's views. The code is in `server/src/lib/firstOpen.ts`.

- "Read" means the same as on the dashboard: the link's first view with some reading time that isn't a bot. Opening the page and leaving straight away sends nothing, and neither does the owner's own preview.
- One email per link. `Link.notifiedAt` is claimed in a single atomic update before sending, so two tabs opening at once send one email, and Resend gets an idempotency key as well. If sending fails, the claim is released and the link's next reader triggers the email.
- The heartbeat that triggers it answers straight away. The email goes out in the background, and the server waits for any still sending before it shuts down.

## Replacing a file

**Replace file** on the document page uploads a new PDF in place of the old one. The title, the links and their settings stay, so everyone who already has a link opens the new file at the same address. The document's `version` goes up and the page shows when it was replaced.

Earlier views are kept. Each one remembers the page count of the version it read, so "read 3 of 4 pages" stays true after the file changes, while the heatmap and reach are drawn on the current file. If two tabs replace the same document at once, the second is told to reload, so no stored file is left behind.

## Demo account

**Try the demo** on the landing page and the log-in page gives each visitor a private copy of a sample account, with no sign-up. It belongs to Neha Verma, a fictional frontend engineer, and holds a resume, a portfolio and certificates with three weeks of reading history. That history covers every state the app shows: read in full, stopped early, not opened, expired, switched off, and links that ask for an email. The view times are counted back from when the demo starts, so the dashboard always looks recent.

- Visitors can do everything except upload, replace or delete files. They can make links, open them in a private window, and watch their own visit arrive.
- Each sandbox is deleted after 24 hours. Every record in it carries `demoExpiresAt`, and a TTL index on each collection has MongoDB delete it at that time, so no cleanup job is needed. Links and views made during the demo get the same date. The session token expires at the same moment.
- Demo links never send the first-open email. Their owner's address is on the reserved `.invalid` domain, so nothing could be delivered there anyway.
- Sandboxes share the same three PDFs, which are put in storage once per server start. Starting a demo is limited to 10 an hour per IP address, and to 500 sandboxes alive at once.

The code is in `server/src/lib/demo.ts`, with the sample data in `demoTemplate.ts`. The PDFs and thumbnails are in `server/assets/demo`, printed from the HTML in `server/assets/demo/source` (A4, no margins, backgrounds on). Every page says it is a sample with fictional names.

## Build progress

- [x] **Phase 1, foundations:** monorepo, design tokens, shared components, sign-up / log-in with JWT, upload to private storage, Documents screen with real data and the empty state.
- [x] **Phase 2, links and viewer:** create, edit and switch off links; link expiry; public viewer with `react-pdf`; email/password gate; access endpoint; heartbeat and beacon tracking.
- [x] **Phase 3, analytics:** analytics endpoint, Document analytics screen (heatmap, reach, stats, links, recent views), Link views screen with paginated views, "Not opened" follow-up nudge on Documents.
- [ ] **Phase 4, polish and launch:**
  - [x] Replace file, keeping every link's address.
  - [x] First-open email through Resend.
  - [x] Bot filtering on the server.
  - [x] Rate limits on every route, and security headers on the frontend.
  - [x] Landing page (built early).
  - [x] Deployment setup: Render Blueprint, Vercel config, CI, keep-alive ping.
  - [x] Demo account: a private sample sandbox per visitor, deleted after 24 hours.
  - [x] Live deployment: [trackedlinks.vercel.app](https://trackedlinks.vercel.app), with the API on Render.
  - [ ] Demo GIF.

## Design references

`design/screens/*.html` are static references with sample data; `design/tokens.json` and `design/tokens.css` hold the colours, type, spacing, radii and shadows. Pixel-level detail is in the Figma file "Tracked Links UI", page "v2, document first". The client's copy of the tokens is [`client/src/styles/tokens.css`](client/src/styles/tokens.css).
