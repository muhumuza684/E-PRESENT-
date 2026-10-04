# E-Presence

**QR-code attendance that replaces paper sheets. Built in Uganda by BrytMa Tech Uganda.**

A lecturer starts a session and shows a QR code. Students scan it with their own phones, enter their student number and PIN, and are marked present. The lecturer gets the list as a CSV file, a PDF, or by email. No app to install, no server to pay for: it runs on a Google Sheet, Google Apps Script and GitHub Pages.

## How it works

1. The lecturer opens `lecturer.html`, signs in with a lecturer ID and PIN, enters the course code, and starts a session. The phone's location is captured once as the room position.
2. The lecturer generates the course QR and prints or projects it.
3. Each student scans it, enters student number and PIN, and allows location once.
4. The server checks the student and PIN, finds the open session for that course, and compares the student's distance to the room. Students outside the radius, or signing in from a phone already used by another student, are marked **CHECK** for the lecturer to review. Nobody is blocked.
5. The lecturer opens **Show list** for a date and downloads a CSV, saves a PDF, or emails the list to themselves.

A lecturer can also add students by hand (for example, someone without a phone).

## What is in this repo

| Path | What it is |
|------|------------|
| `index.html` | Student page (opened by the QR code) |
| `lecturer.html` | Lecturer page: start session, QR, manual add, list, CSV, PDF, email |
| `apps-script/Code.gs` | Backend, runs as a Google Apps Script Web app |
| `apps-script/appsscript.json` | Apps Script manifest |
| `sheet-templates/` | Header rows for the four Sheet tabs |
| `SETUP.md` | Short setup checklist |

## Setup

You need a Google account and a GitHub account.

**1. Google Sheet.** Create a Sheet with four tabs named exactly `Lecturers`, `Students`, `Sessions` and `Attendance`, with these headers in row 1:

| Tab | Columns |
|-----|---------|
| Lecturers | `lecturer_id`, `pin`, `email` |
| Students | `student_no`, `name`, `pin` |
| Sessions | `session_id`, `course`, `lat`, `lng`, `radius`, `closes_at`, `is_open`, `mode` |
| Attendance | `session_id`, `student_no`, `name`, `device_id`, `time`, `status`, `distance`, `reason` |

Format the `pin` and `student_no` columns as plain text so leading zeros are kept. `Code.gs` includes a `setupSheets()` function that builds the tabs for you.

**2. Backend.** In the Sheet, open Extensions > Apps Script, paste `apps-script/Code.gs`, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Approve the permissions (Sheet access and sending email). Copy the Web app URL. After any later code change, deploy a **new version**.

**3. Pages.** Replace `PASTE_WEB_APP_URL_HERE` in `index.html` and `lecturer.html` with the Web app URL, then publish the two files with GitHub Pages.

**4. Students.** Add students to the `Students` tab and lecturers to the `Lecturers` tab (with an email if they want the list sent to them).

## Using it

- **Lecturer:** open `lecturer.html`, enter ID, PIN and course code, click **Start session** (allow location), then **Generate QR**. The default window is 15 minutes and the default radius is 60 m.
- **Student:** scan the QR, which opens `index.html?course=COURSECODE`, then enter student number and PIN.
- **After class:** pick the date, click **Show list**, then **Download CSV**, **Save as PDF** (uses the browser's print dialog) or **Email me the list**.

## Data and privacy

- Student locations are used once to measure distance from the room. Only the distance in metres is stored, not the student's coordinates. The lecturer's room coordinates are stored with the session.
- All data lives in your own Google Sheet. Anyone with access to that Sheet can see everything in it, so keep it private and share it with nobody you would not trust with the class list.
- Tell students what is collected, why, and how long you keep it. If you handle personal data in Uganda, make sure your use follows the Data Protection and Privacy Act, 2019.

## Security: what it does and does not do

Designed to be simple, not bulletproof.

- **Does:** requires a student number and PIN, locks a student for 10 minutes after 5 wrong PINs, flags sign-ins from outside the radius, and flags two students signing in from the same phone.
- **Does not:** stop a student giving a friend their PIN and QR link, hide data from anyone who can open the Sheet, or hash PINs (they are stored as plain text in the Sheet). Any lecturer who knows another lecturer's course code can list that course.
- Indoor location is imprecise. Treat **CHECK** as "look at this one", never as proof of absence.

## Known limitations

- Built for a single Sheet and light use. Very large classes signing in at the same moment may be slow, because every sign-in is handled one at a time.
- Flagged rows are shown as CHECK in the list. There is no approve or reject button yet.
- PDF export uses the browser's print dialog.
- Not yet tested at scale. Run one real lecture alongside the paper sheet before relying on it.

## Roadmap

Rotating on-screen code to stop proxy sign-ins, hashed PINs, per-lecturer ownership of courses, approve or reject for flagged rows, and support for meetings and other gatherings beyond classes.

## Credits

Built in Uganda by **BrytMa Tech Uganda**.

Copyright (c) 2026 BrytMa Tech Uganda. All rights reserved.
