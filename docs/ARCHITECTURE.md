# Edu-Assist architecture and next steps

## Current MVP

```text
Browser
├── index.html + src/styles.css       Interface and responsive layout
├── src/app.js                        UI state, account forms and interactions
├── src/features.js                   learning map, module plans, practice, chat, stream, groups
├── src/features.css                  feature view layouts
├── data/sample-data.js               Seed content for first run
└── src/services/
    ├── storage.js                    localStorage adapter
    └── api.js                         same-origin auth API + demo study helper

Local Node server (`server/index.js`)
├── static app hosting
├── email registration + one-time code verification
├── password hashing (scrypt) + HttpOnly session cookie
└── local user store (`server-data/users.json`, excluded from static hosting)
```

The frontend requires no package dependencies or build step. `npm start` runs the built-in Node HTTP server, serves the app and exposes the auth API on the same origin. `Live Server` can still serve the frontend while the Node API runs on port 3000. Account registration can use a local console code for development or send mail through the server-side Resend integration (`RESEND_API_KEY` and a verified `EMAIL_FROM`). No secret is embedded in browser files.

The account server hashes passwords with Node's scrypt, stores only a hash of short-lived verification codes, limits attempts, and sets a SameSite HttpOnly session cookie. User records are in a local JSON file; sessions are in memory and end if the server restarts. This is a learning MVP, not a production identity service. For deployment, replace JSON and memory session storage with a managed identity provider and durable database/session store, enable HTTPS, configure rate limits at the edge, provide password reset and account recovery, and review the security controls.

After the app checks the existing session, the frontend selects an account-specific local-storage namespace. Learning records remain in that browser and are not uploaded to the account server. Logging out returns to the guest namespace without deleting either local data set.

The service worker precaches the HTML, styles and JavaScript app shell after the first localhost/HTTPS visit. It uses a cache-first strategy for same-origin static assets, then falls back to the cached app entry on a network failure. It does not cache external sites or provide shared state while offline. Low-data mode suppresses decorative effects and uses system fonts.

The learning map presents the information hierarchy as qualification → module → topic → resource → practice. Module records include module code, exam date, daily available minutes, topics and confidence ratings. The plan generator creates local study-session suggestions and prioritises topics marked for help or review. Tasks and study sessions have editable progress sliders; quizzes and topics show their completion/confidence progress.

The past-paper practice view currently uses illustrative built-in prompts and explanations. The chat demonstrates streaming by revealing a local template response in small chunks; no model API is called. Study groups support local goals plus manual import/export snapshots. These boundaries can later be replaced with protected backend services.

## Suggested secure evolution

```text
Web client ── authenticated HTTPS ──> Node.js API
                                          ├── Supabase Auth (student identity)
                                          ├── Supabase Postgres (tasks, sessions, metadata)
                                          ├── Supabase Storage (private document objects)
                                          └── AI provider (server-side request only)
```

### Stage 1: backend foundation

- Add a separate Node.js service, for example under `server/`, with validated request schemas and environment-based secrets.
- Keep the browser client limited to public configuration and a Supabase publishable/anon key when using Supabase directly. Enforce row-level security (RLS) on every student-owned table. Never ship the Supabase service-role key.
- Prefer an API server for privileged operations, file processing, and AI calls. Configure CORS narrowly, add rate limits, and return only data the signed-in student is permitted to access.
- Use environment variables for secrets on the server and provide `.env.example` with placeholder names only. Add `.env` to `.gitignore` before introducing credentials.

### Stage 2: Supabase data and files

Possible tables:

- `profiles`: `id` references the authenticated user; display and course preferences.
- `documents`: owner id, object path, display name, MIME type, size, subject, type, upload timestamp, processing status.
- `tasks`: owner id, title, subject, due date, completion state.
- `study_sessions`: owner id, title, subject, start/end, completion state.
- `quiz_attempts`: owner id, quiz id, score, total, completion timestamp. Avoid storing answer keys in client-visible tables.

Use private storage buckets, size/type validation, signed access where needed, and RLS policies scoped to `auth.uid()`. A server or trusted edge function should inspect uploads and update processing status.

### Stage 3: real AI study assistant

Change `api.askAssistant()` to call an authenticated endpoint such as `POST /api/assistant`. The endpoint should verify the user's session, apply request limits, retrieve only documents the user can access, and call the AI provider with a server-held key. Return a concise answer and citations or source references when retrieval is added. Do not expose AI keys, service-role credentials, or unrestricted database access to the browser.

### Stage 4: document understanding and matching

Upload files through a protected flow, then extract text server-side using an allowlisted file-processing pipeline. Match papers and memorandums using normalized subject, year, module code, and paper number; present uncertain matches for student confirmation. Keep original uploads private and provide clear deletion controls.

## Frontend integration points

- `src/services/storage.js`: replace or complement browser-local persistence with an authenticated data service.
- `src/services/api.js`: replace the demo response with calls to your own backend.
- `src/app.js`: keep UI actions calling service functions so backend adoption does not require rebuilding the page structure.
- `data/sample-data.js`: useful as local demo fixtures; do not treat sample records as real student data.

## Before real students use it

Add authentication, server-side authorization, database RLS, upload validation, rate limiting, input validation, privacy/retention controls, accessibility review, error handling, and production hosting with HTTPS. Review applicable data-protection and education requirements before storing identifiable student records.
