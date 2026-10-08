# E-Presence

**QR-code attendance that replaces paper sign-in sheets. Built in Uganda by BrytMa Tech Uganda.**

A lecturer creates a class once and gets a QR code that never changes, so it can be printed and used all semester. At each lecture they start sign-in with a PIN. Students scan the QR, type their Reg No, name and the PIN on the lecturer's screen, and they are signed in. The lecturer sees the list fill up live, then downloads a PDF or CSV, emails it, or prints it. No app to install, no accounts, no server to pay for: it runs on a Google Sheet, Google Apps Script and GitHub Pages.

**Live system:** https://muhumuza684.github.io/E-PRESENT-/lecturer.html

## Start here

| I want to... | Read |
|---|---|
| Use E-Presence as a lecturer | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) |
| Set it up for a new university or client | [docs/CLIENT-SETUP.md](docs/CLIENT-SETUP.md) |
| Share or sell it to clients | [docs/SHARING.md](docs/SHARING.md) |

## What it does

- **One QR for the whole semester.** Print it once. Or switch to a one-time QR for a single session.
- **Session PIN.** Students cannot sign in without the PIN shown on the lecturer's screen. The lecturer can change it at any moment.
- **Live lists.** The list updates by itself while sign-in is open. Every session keeps its own list, so a new session never shows earlier names.
- **Status and Method.** Each row shows Status (Present or Check) and Method (Scanned or Added by hand).
- **Real PDF.** University logo and name, lecturer name, page numbers, signature line, optional cover page and footer text, optional small "Powered by E-Presence" line. A built-in preview shows it before you download.
- **Templates.** Digital list, weekly grid, time in and out, name and signature, or upload a CSV sample whose column headings become the PDF columns.
- **CSV, email and whole-semester table.** One row per student, one column per session, with a total.
- **Add by hand.** Paste rows copied from Google Sheets for people without phones.
- **Branding.** University name, logo, welcome line and colour show on the student page. Themes, light and dark mode, and a back-up and restore for settings.
- **Meetings too.** Choose "Name only" for meetings and workshops.
- **No location tracking.** Only Reg No, name and sign-in time are stored.

## How it is built

| Part | What it is |
|---|---|
| `lecturer.html` | The lecturer app (sidebar pages: Home, QR & PIN, Lists, Student view, Settings, About) |
| `index.html` | The student sign-in page, opened by the QR code |
| `apps-script/Code.gs` | The backend, a Google Apps Script web app that stores everything in a Google Sheet |
| `apps-script/appsscript.json` | Apps Script manifest (Kampala timezone, public web app) |
| `smoke-test.ps1` | Live end-to-end check of a deployed backend |
| `deploy.ps1` | One-command update: deploy, live test, push to GitHub |
| `new-client.ps1` | Sets up a brand-new client: own Sheet, own backend, own pages, live test |
| `update-clients.ps1` | Rolls a new version out to every client |

Lecturer settings (university name, logo, theme, templates) are saved on the lecturer's own device. The university name, logo, colour and welcome line are also saved with the class so students' phones can show them.

## Setup for one organisation (the short version)

1. Create an empty Google Sheet. Extensions > Apps Script. Paste `apps-script/Code.gs`. Apply `appsscript.json`.
2. Deploy > New deployment > Web app (Execute as: Me, access: Anyone). Approve the permissions. Copy the web app URL.
3. Open the web app URL once. It should say `E-Presence is running`. The tabs are created automatically.
4. Put the URL into `index.html` and `lecturer.html` (the `URL_` line near the bottom) and publish both with GitHub Pages.
5. Run `smoke-test.ps1 -Url <web app URL>`.

The easy way for a new client is `new-client.ps1`. See [docs/CLIENT-SETUP.md](docs/CLIENT-SETUP.md).

**Two things learned the hard way:** after changing `Code.gs`, deploy a *new version* of the web app (a plain save keeps the old code running). And never use `?c=` in a web app link: Google reserves it and answers 400, which is why the class link uses `?class=`.

## Data and privacy

- Everything lives in the organisation's own Google Sheet: classes, sessions, and each sign-in (Reg No, name, time). There is no location tracking.
- Anyone with access to that Sheet can see everything in it, so keep it private.
- Tell students what is collected, why, and how long you keep it. In Uganda, make sure your use follows the Data Protection and Privacy Act, 2019.

## Security: what it does and does not do

Designed to be simple, not bulletproof.

- **Does:** needs the session PIN to sign in, locks a device after 5 wrong PINs, flags two people signing in from one phone as Check, strips spreadsheet formula characters from typed text, and keeps lists, PIN changes and exports behind the lecturer's private key.
- **Does not:** stop a student telling a friend the PIN (change the PIN mid-class if that worries you), prove a student is physically in the room, or hide data from anyone who can open the Sheet. The PIN is stored as plain text.

## Known limits

- Built for light use. Every sign-in is processed one at a time, so a very large class signing in at the same second may be slow. It has not been load-tested at scale, so run a real lecture next to paper first.
- Google limits apply: for example about 100 emails a day on a free Google account.
- A lecturer who clears browser data loses their classes in that browser. The attendance data stays in the Sheet and the printed QR keeps working.
- Photo, PDF and Excel sample lists are kept as a reference only. CSV headings can become PDF columns.

## Support

Email: muhumuzabright26@gmail.com

## Credits

Built in Uganda by **BrytMa Tech Uganda**. Copyright (c) 2026 BrytMa Tech Uganda. All rights reserved.
