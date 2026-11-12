# Tracked document links: full details

## 1. What it is

A web app where you upload a PDF, such as a resume, generate share links, and see how each link gets read: how many opens, when, on what device, and how long on each page. It's a small version of products like DocSend and Papermark.

## 2. User flows

**Owner (you)**
1. Sign up and log in.
2. Upload a PDF.
3. Create links for it, each with a label such as "TCS application" or "LinkedIn bio".
4. Share the links.
5. Check the dashboard for views and reading time.

**Viewer (recruiter)**
1. Opens the link.
2. Optionally enters an email or password, if you turned that on.
3. Reads the PDF in your viewer page.
4. Never sees a dashboard or needs an account.

## 3. Features

**MVP**
- Email and password auth
- PDF upload (PDF only, about 10 MB cap)
- Multiple links per document, each with a label
- In-browser PDF viewer
- Tracking of opens, time per page, device and browser
- Dashboard per document and per link

**Version 2**
- Email notification when a link is first opened
- Link expiry date and on/off switch
- Password-protected links
- An "enter your email to view" gate
- Download on/off
- Replacing the file without changing the link, so an updated resume keeps the same URL

**Stretch**
- Country from IP
- Custom slugs like `/v/chinmay-resume`
- Weekly summary email

## 4. Tech stack

- **Frontend:** React, with `react-pdf` (built on pdf.js) for the viewer and Recharts for the charts.
- **Backend:** Node and Express, with JWT auth.
- **Database:** MongoDB Atlas.
- **File storage:** Cloudinary, S3 or Cloudflare R2, kept private and served through signed URLs.
- **Email:** Resend or Nodemailer.
- **IDs:** `nanoid` for link slugs.

## 5. Data model

```
User
  _id, name, email, passwordHash, createdAt

Document
  _id, ownerId, title, fileKey, pageCount,
  sizeBytes, createdAt

Link
  _id, documentId, ownerId, slug, label,
  requireEmail, passwordHash, expiresAt,
  allowDownload, isActive, createdAt

View   (one per reading session)
  _id, linkId, documentId, viewerEmail,
  startedAt, lastSeenAt, totalDurationMs,
  pages: [{ page, durationMs }],
  maxPageReached, device, browser, os,
  country, ipHash
```

Index `Link.slug` (unique), `View.linkId` and `View.documentId`.

## 6. API

**Owner, authenticated**
- `POST /auth/signup`, `POST /auth/login`
- `POST /documents` (upload), `GET /documents`, `DELETE /documents/:id`
- `POST /documents/:id/links`, `PATCH /links/:id`, `DELETE /links/:id`
- `GET /documents/:id/analytics`

**Viewer, public**
- `GET /v/:slug` returns the title and whether an email or password is needed.
- `POST /v/:slug/access` checks the gate, creates a View, and returns a `viewId` plus a short-lived signed file URL.
- `POST /views/:viewId/heartbeat` receives time-per-page updates.

## 7. How tracking works

1. The viewer page loads and calls `/access`, which creates the View record.
2. An `IntersectionObserver` detects which page is currently on screen.
3. A timer adds time to that page only while the tab is visible, using the Page Visibility API.
4. Counting pauses after about 60 seconds without scrolling or mouse movement, so an abandoned tab doesn't count as an hour of reading.
5. Every 5 to 10 seconds the client sends a heartbeat with the time added since the last one, and the server applies it with `$inc`.
6. When the page closes, `navigator.sendBeacon` sends the final update, since normal requests get cancelled on unload.

## 8. Dashboard

- **Per document:** total views, unique viewers, average reading time, and the share of views that reached the last page.
- **Per page:** a bar chart of average time, which shows which resume section gets attention.
- **Per link:** a list of views with time, duration and device, so you can compare "TCS" against "Infosys".

## 9. Hard parts and how to handle them

- **Preview bots:** WhatsApp, LinkedIn and Slack fetch links to build previews. Create the View from the client-side call, not the page request, since bots don't run JavaScript.
- **File leakage:** never expose the storage URL. Issue signed URLs that expire in a few minutes.
- **Guessable links:** use slugs of at least 10 random characters.
- **Upload abuse:** check the file type by content and not just the extension, cap the size, and rate limit uploads.
- **Gate brute force:** rate limit `/access` and hash link passwords with bcrypt.
- **Privacy:** store a hash of the IP, not the raw IP, and add a short "this document tracks views" note in the viewer footer.
- **Disabling downloads:** this is only a deterrent, since anyone can screenshot. Say so if asked in an interview.

## 10. Deployment

- **Frontend:** Vercel.
- **Backend:** recruiters shouldn't wait on a sleeping free server when they open your resume. Either run the API as serverless functions on Vercel, or host it on Render and keep it awake with a scheduled ping.
- **Database and files:** Atlas free tier, plus the Cloudinary or R2 free tier.
- **Config:** keep secrets in environment variables and restrict CORS to your frontend domain.

## 11. Build plan (about 4 weeks part-time)

- **Week 1:** auth, upload, storage, and a basic viewer page.
- **Week 2:** links, the access endpoint, and heartbeat tracking.
- **Week 3:** analytics queries and the dashboard charts.
- **Week 4:** gates, expiry, notifications, bot filtering, deployment and a README with a demo GIF.

## 12. For your resume

- "Built a document-sharing platform with per-link view analytics and page-level reading time, using React, Node and MongoDB."
- "Implemented visibility-aware time tracking with heartbeat and beacon APIs, and filtered link-preview bots from the analytics."
- "Secured file access with short-lived signed URLs, plus password, email and expiry gates on links."

Add real numbers once you've used it, such as how many links you shared and how many views you tracked.

## 13. Interview questions to prepare for

- How do you measure time on a page accurately?
- What happens if the user closes the tab mid-read?
- How do you stop someone from sharing the raw file URL?
- How would this scale to a million views? (Batch the heartbeats and pre-aggregate the stats.)
- Why MongoDB over SQL here?

