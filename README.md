# E-Presence

**QR-code attendance that replaces paper sheets. Built in Uganda by BrytMa Tech Uganda.**

A lecturer starts a session and shows a QR code. Students scan it with their own phones, enter their Reg No and PIN, and are marked present. The lecturer gets the list as a CSV file, a PDF, or by email. No app to install and no server to pay for: it runs on a Google Sheet, Google Apps Script and GitHub Pages.

## How it works

1. The lecturer opens `lecturer.html`, signs in with a lecturer ID and PIN, enters the course code (and an optional title such as "Week 5 lecture"), and starts a session. The phone's location is captured once as the room position.
2. The lecturer generates the course QR and prints or projects it.
3. Each student scans it and enters their Reg No and a 4-digit PIN. **First time only:** the student also types their full name. The PIN they typed becomes their PIN, and they are added to the `Students` tab automatically.
4. The server checks the PIN, finds the open session for that course, and compares the student's distance to the room. Students outside the radius, or signing in from a phone already used by another student, are marked **CHECK** for the lecturer to review. Nobody is blocked.
5. The lecturer picks a date, clicks **Show list**, then downloads a CSV, saves a PDF (browser print dialog), or emails the list to themselves.

A lecturer can also add students by hand, for example someone without a phone.

## What is in this repo

| Path | What it is |
|------|------------|
| `index.html` | Student page, opened by the QR code |
| `lecturer.html` | Lecturer page: start session, QR, add by hand, list, CSV, PDF, email |
| `apps-script/Code.gs` | Backend, runs as a Google Apps Script Web app |
| `apps-script/appsscript.json` | Apps Script manifest (Kampala timezone, public Web app) |
| `smoke-test.ps1` | Live end-to-end check of a deployed backend |
| `deploy.ps1` | One-command update: deploy, live test, then push to GitHub |

## Setup

You need a Google account and a GitHub account.

1. **Backend.** Create an empty Google Sheet. Open Extensions > Apps Script, paste `apps-script/Code.gs`, and set the project timezone and Web app settings from `appsscript.json`. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Approve the permissions (Sheet access and sending email). Copy the Web app URL.
2. **Open the Web app URL once.** It should say `E-Presence is running`. This automatically creates the four tabs (`Lecturers`, `Students`, `Sessions`, `Attendance`) and sets the Sheet's timezone to match the script. It never erases existing data.
3. **Create the first lecturer.** Run `smoke-test.ps1 -Url <web app URL> -LecturerId <id> -Pin <pin> -Email <email>`. The first run creates the lecturer, and the test then checks the whole flow. Delete the test rows (`SMOKE`) afterwards. Later lecturers are added by typing a row in the `Lecturers` tab.
4. **Pages.** Put the Web app URL into `index.html` and `lecturer.html` (the `URL_` line near the bottom), then publish both files with GitHub Pages.

After any change to `Code.gs`, deploy a **new version** of the Web app. A plain save keeps the old code running.

## Using it

- **Lecturer:** open `lecturer.html`, enter ID, PIN, course code and optionally a title, click **Start session** (allow location), then **Generate QR**. The defaults are 60 m and 15 minutes.
- **Student:** scan the QR, which opens `index.html?course=COURSECODE`. Enter Reg No and PIN. The first time, also enter your full name when asked. To reset a forgotten PIN, edit that student's row in `Students`.
- **After class:** pick the date, click **Show list**, then **Download CSV**, **Save as PDF** or **Email me the list**. If a session was restarted the same day, the list merges all of that day's sessions for the course.

## Data and privacy

- Student locations are used once to measure distance from the room. Only the distance in metres is stored, not the student's coordinates. The lecturer's room coordinates are stored with the session.
- All data lives in your own Google Sheet. Anyone with access to that Sheet can see everything in it, so keep it private.
- Tell students what is collected, why, and how long you keep it. If you handle personal data in Uganda, make sure your use follows the Data Protection and Privacy Act, 2019.

## Security: what it does and does not do

Designed to be simple, not bulletproof.

- **Does:** requires a Reg No and PIN, locks a student for 10 minutes after 5 wrong PINs, flags sign-ins from outside the radius, flags two students signing in from the same phone, and strips spreadsheet formula characters from names and titles.
- **Does not:** stop a student giving a friend their PIN and QR link, stop someone registering another student's Reg No before that student does (fix it by editing the row in `Students`), hide data from anyone who can open the Sheet, or hash PINs (they are stored as plain text). Any lecturer who knows another lecturer's course code can list that course.
- Indoor location is imprecise. Treat **CHECK** as "look at this one", never as proof of absence.

## Known limitations

- Built for a single Sheet and light use. Very large classes signing in at the same moment may be slow, because every sign-in is handled one at a time.
- Flagged rows show as CHECK in the list. There is no approve or reject button yet.
- PDF export uses the browser's print dialog.
- Not yet tested in a full lecture. Run one real lecture alongside the paper sheet before relying on it.

## Roadmap

Rotating on-screen code to stop proxy sign-ins, hashed PINs, per-lecturer ownership of courses, approve or reject for flagged rows, a lecturer-chosen list of fields to collect, and support for meetings and other gatherings beyond classes.

## Credits

Built in Uganda by **BrytMa Tech Uganda**.

Copyright (c) 2026 BrytMa Tech Uganda. All rights reserved.
