# Tracked Links

Upload a PDF (usually a resume), create a separate share link for each place you send it, and see how each link gets read: opens, time per page, pages reached and device. Viewers never need an account.

> Build status: **phase 1 of 4 (foundations)** is done. See [Build progress](#build-progress).

## Stack

- **Client:** React 19 + Vite, React Router, TanStack Query, `react-pdf` (pdf.js). CSS Modules on top of the design tokens.
- **Server:** Node + Express 5, JWT auth, bcrypt (`bcryptjs`), Mongoose 9 on MongoDB.
- **Files:** Backblaze B2 through its S3-compatible API (private bucket, short-lived presigned URLs). Any S3-compatible service works, including Cloudflare R2 and AWS S3. In development a local-disk driver serves HMAC-signed, expiring URLs instead.
- **Language:** TypeScript everywhere, with types and formatting rules shared between client and server.

## Repository layout

```
client/   React app (Vite). Deployed to Vercel.
server/   Express API. Deployed to Render.
shared/   Types and pure helpers used by both (durations, relative times, headlines, heat opacity).
design/   Static screen references and design tokens. Open design/screens/index.html in a browser.
docs/     The original product spec.
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

With no `S3_*` values set, uploads are stored in `server/storage/` (gitignored).

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
| `API_BASE_URL`, `PUBLIC_BASE_URL` | server | Public URLs of the API and the frontend. |
| `TRUST_PROXY` | server | `1` on Render, so rate limits see the real client IP. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | server | File storage (Backblaze B2). `S3_REGION` is optional. Without them, files go to local disk, which Render wipes on every restart. |
| `VITE_API_URL` | client | The API URL. |
| `VITE_PUBLIC_BASE_URL` | client | The frontend URL, used to build share links (`[YOUR DOMAIN]/v/<slug>`). |

## Setting up Backblaze B2

The free tier covers 10 GB and needs no card.

1. **Buckets → Create a Bucket.** Bucket names are shared across all B2 accounts, so pick something unique. Set files to **Private**. Leave encryption and object lock off. Copy the bucket name into `S3_BUCKET`, and the **Endpoint** shown under it (for example `s3.us-east-005.backblazeb2.com`) into `S3_ENDPOINT`.
2. **Application Keys → Add a New Application Key.** Limit it to that bucket, with **Read and Write** access. Leave the file name prefix and duration empty. Copy `keyID` into `S3_ACCESS_KEY_ID` and `applicationKey` into `S3_SECRET_ACCESS_KEY`. The secret is shown only once. Do not use the master application key: the S3 API rejects it, and it can delete buckets.
3. **CORS Rules** on the bucket: share the bucket with your frontend's origin (`http://localhost:5173` in development, your Vercel URL in production) and apply the rule to the **S3 Compatible API**. The viewer loads PDFs straight from the bucket, so without this rule they fail to load. Sharing with every origin is also acceptable: a file still cannot be read without a valid signed URL.
4. Run `npm run storage:check -w server`. It reports what is wrong if any step above is off.

Cloudflare R2 or AWS S3 work with the same variables: set `S3_ENDPOINT` to the service's S3 endpoint, and `S3_REGION` to `auto` for R2.

## How the security requirements are met

- **Private files:** the bucket is never public and storage keys never leave the server. Clients only get presigned URLs that expire after `SIGNED_URL_TTL_SECONDS` (default 5 minutes).
- **Uploads:** checked by content (the `%PDF-` header, then parsed with `pdf-lib` to count pages), capped at 10 MB, and rate-limited per account.
- **Auth:** passwords hashed with bcrypt (cost 12). Log-in takes the same time whether or not the email exists, and returns the same message either way. Sign-up and log-in are rate-limited per IP.
- **Ownership:** every document route checks the owner and answers 404 for anything else, so ids can't be probed.
- **CORS** allows only `CLIENT_ORIGIN`; secrets live in environment variables; `helmet` sets security headers.
- **Viewer privacy** (phase 2): only a salted hash of the IP address is stored.

## Build progress

- [x] **Phase 1, foundations:** monorepo, design tokens, shared components, sign-up / log-in with JWT, upload to private storage, Documents screen with real data and the empty state.
- [ ] **Phase 2, links and viewer:** create, edit and switch off links; public viewer with `react-pdf`; email/password gate; access endpoint; heartbeat and beacon tracking.
- [ ] **Phase 3, analytics:** analytics endpoint, Document analytics screen (heatmap, reach, stats, links, recent views), Link views screen.
- [ ] **Phase 4, polish and launch:** replace file, expiry, first-open email (Resend), bot filtering, ~~landing page~~ (built early, matches `design/screens/landing.html`), deployment (Vercel + Render with keep-alive), demo GIF.

## Design references

`design/screens/*.html` are static references with sample data; `design/tokens.json` and `design/tokens.css` hold the colours, type, spacing, radii and shadows. Pixel-level detail is in the Figma file "Tracked Links UI", page "v2, document first". The client's copy of the tokens is [`client/src/styles/tokens.css`](client/src/styles/tokens.css).
