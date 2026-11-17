# Edu-Assist

Edu-Assist is a responsive student study workspace. It brings academic documents, module and exam planning, past-paper practice, quizzes, study chat, group goals, and learning progress into one lightweight website. The first version is designed for Visual Studio Code and can be previewed with Live Server; account features require the included Node.js server.

## Languages and technology

| Area | Technology |
| --- | --- |
| Website structure | HTML5 |
| Styling and responsive layout | CSS3 |
| Frontend interactions | Vanilla JavaScript with ES modules |
| Account and static-file server | Node.js built-in modules, JavaScript |
| Email verification (optional) | Resend REST API, called only by the server |
| Browser-side demo data | `localStorage` and JSON sample data |

There is no frontend framework, bundler, or third-party Node package required. The study chat currently uses local demo responses; it is not connected to an AI model.

## What you can do

- Browse the overview dashboard and sample academic documents.
- Add local file names to your library, search them, filter by document type, and remove entries. This demo records file metadata in your browser; it does not upload or read the contents of selected files.
- Match question papers and memorandums that share a subject label.
- Create study tasks and sessions, update their progress bars, mark them done, and review weekly progress.
- Complete four sample five-question quizzes and view saved results.
- Use the local study helper for guided study suggestions. It is not connected to an AI model.
- Follow a clear **qualification → module → topic → resource → practice** learning map.
- Add module codes, exam dates, daily study time, and topics; build a suggested revision schedule weighted toward topics marked “unsure” or “need help.”
- Practise sample past-paper questions one at a time, reveal a memo explanation, and rate your confidence.
- Use the dedicated study chat for simple explanations, worked-example prompts, flashcards, or a self-check. Demo replies stream into the chat gradually.
- Review a personal study activity stream.
- Create study groups, track shared goals, and export/import a text invite code containing a group snapshot.
- Turn on low-data mode. The app shell can be cached by its service worker after the first visit from Live Server or another localhost/HTTPS server.
- Switch between light and dark themes. Your preferences and demo data persist in local storage.
- Register with an email address and password, activate the account with a six-digit verification code, and log in or out. Account-specific learning data uses a separate browser-local storage scope.

## Run in Visual Studio Code

1. Install Node.js 20 or newer, then open the `Edu-Assist` folder in Visual Studio Code.
2. Open the VS Code terminal in the project folder and run `npm start`.
3. Visit `http://127.0.0.1:3000`. The app and account API run together.
4. To use **Live Server**, leave `npm start` running, then right-click `index.html` and choose **Open with Live Server**. Keep the same hostname for both pages (for example, use `127.0.0.1` for both).

By default, the server uses **console verification mode** for local development: it prints the code to the VS Code terminal and does not send email. To send real activation emails:

1. Copy `.env.example` to `.env`.
2. Set `EMAIL_MODE=resend`, add your Resend API key to `RESEND_API_KEY`, and set `EMAIL_FROM` to a sender address on a domain verified with Resend.
3. Set `APP_ORIGIN` to the site origin (for example, `http://127.0.0.1:3000`) and restart `npm start`.

The Resend key stays in the server environment. Do not paste it into frontend code. Codes expire after 10 minutes; the server limits verification attempts and resend requests.

The static Live Server preview can still open the UI, but **register, verify, log in, and log out need the Node server** at port 3000. Opening `index.html` directly as a `file://` URL is not supported.

## Project structure

```text
Edu-Assist/
├── index.html                 # App shell and navigation
├── README.md                  # Setup and feature guide
├── package.json               # Node start scripts; no third-party packages
├── .env.example               # Email sender configuration template
├── server/
│   └── index.js               # Static server, registration, verification, sessions
├── data/
│   └── sample-data.js         # Sample documents, tasks, sessions, quizzes
├── manifest.webmanifest       # Installable app metadata
├── service-worker.js          # Offline app-shell cache
├── docs/
│   └── ARCHITECTURE.md        # Backend and integration roadmap
└── src/
    ├── app.js                 # Rendering, navigation, and interactions
    ├── features.js            # Learning map, modules, practice, chat, stream, groups
    ├── features.css           # New feature views
    ├── styles.css             # Responsive UI and themes
    └── services/
        ├── api.js             # Auth API calls + local demo study replies
        └── storage.js         # Browser local-storage adapter
```

The server creates `server-data/users.json` locally on first start. It is blocked from static web access and excluded from version control.

## Data and privacy

The MVP stores task, session, document metadata, quiz scores, modules, confidence ratings, chat history, groups, activity and preferences in browser `localStorage`. Account passwords are hashed by the Node server; sessions use an HttpOnly cookie. The account database is a local JSON file and in-memory sessions are cleared when the server restarts, so use a managed auth/database service before deployment. Email codes are actually emailed only when a verified email sender is configured; default console mode prints them to the server terminal for local testing. Sample documents and past-paper questions are illustrative, not official exam content. Adding a file stores its name and metadata only; file contents are not uploaded or persisted. Study-group invite codes transfer a snapshot manually; they do not provide live collaboration. The service worker caches the app shell after the first visit and requires Live Server/localhost or HTTPS; opening via `file://` cannot provide offline caching. Reset demo data from the **Help** button.

Do not put private API keys, Supabase service-role keys, or other secrets in HTML, CSS, JavaScript, or any file served to the browser. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before connecting external services.

## Sample project test flow

1. Open **My documents**, search for “Software Development”, then choose **Question paper** or **Memorandum**.
2. Use **Match papers & memos** to see the subject-based match.
3. Add a document entry, then remove it.
4. Open **Past-paper practice**, answer a sample question, reveal its memo, and rate confidence.
5. Add a module and exam date under **Modules & exams**, then build a revision plan.
6. Open **Study planner**, add a task and session, and mark a task complete.
7. Start a quiz, answer all five questions, and rate your confidence in the result dialog.
8. In **Study chat**, choose a help style and send a question to see a streamed local demo reply.
9. Create a **Study group**, add a goal, then export and import a group snapshot.
10. Adjust a task or session progress slider and confirm its status changes between **Not started**, **In progress**, and **Done**.
11. Register a test account. In default console mode, copy the six-digit code from the VS Code terminal into the verification form; with Resend configured, use the code sent to email.
12. Log out and log in again; account learning data should stay in its own browser-local scope. Refresh to confirm it persists.
13. After the first visit, you can also test the app shell offline on localhost.

## Current limits

This is a learning MVP, not a production student records platform. Real email delivery requires a verified Resend sender and server-side configuration; default development mode prints codes in the server terminal. User records are in a local JSON file and sessions are temporary in memory. Demo helper replies are local prompt templates and stream for presentation; they are not generated by an AI model. Paper questions are illustrative, matching compares exact subject labels, and upload selection does not upload content. Study groups exchange snapshots, not live updates. Use a managed identity provider, persistent database, password recovery, and durable session store before deployment.
