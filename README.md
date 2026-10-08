# E-Presence

**QR-code attendance that replaces paper sheets. Built in Uganda by BrytMa Tech Uganda.**

The lecturer creates a class once and gets a QR code that can be printed and used all semester. At each lecture they start sign-in with a PIN. Students scan the QR, type their Reg No, name and the PIN on the lecturer's screen, and they are signed in. The lecturer downloads the list as CSV, saves it as PDF, or has it emailed. No app to install, no accounts, no server to pay for: it runs on a Google Sheet, Google Apps Script and GitHub Pages.

## How it works

1. **Create your class once.** Open `lecturer.html`, type a class name (for example "CSC2101 Semester 1") and tap **Create class and QR code**. You get a QR code that **never changes**, so you can **print it** (tap **Print QR** for a poster) and stick it on the wall or put it in your slides for the whole semester.
2. **Each lecture, start sign-in.** Optionally name the session ("Week 6"), keep or change the suggested PIN, and tap **Start sign-in**. The big PIN appears, ready to project. Students scan the same printed QR.
3. **Students** scan, type their Reg No and full name (remembered on their phone for next time) and the PIN, and tap **Sign in**. If they scan before you have started, they see "Sign-in is not open right now" and a **Check again** button.
4. **During class** you see a live count. **Change PIN** replaces the PIN at any moment. **End sign-in** closes it. Starting again next week reuses the same QR.
5. **After class** tap **Lists & export**. Pick any session, then download a CSV, save a PDF, or email the list to yourself. **Whole semester** downloads one table with a row per student, a column per session and a total.
6. **Someone without a phone?** Under *Add someone by hand*, paste rows copied from Google Sheets (Reg No and Name, one person per row, in either order). They merge into the session you are viewing, and duplicates are skipped.

Prefer a QR that changes every time? While a session is open, tap **Use a one-time QR for this session instead**. That QR stops working when the session ends.

For meetings and other gatherings, untick **Students also type a Reg No** when creating the class and students only enter their name.

There are no lecturer accounts. The lecturer's browser keeps a private key for each class, which is needed to start sessions, see lists, change the PIN or end a session. Reopen the page on the same device and your classes are there. A session closes by itself after 6 hours.

## Settings, themes and branding (v4)

- **Settings** (saved on the lecturer's own device, no account): university name, lecturer name, welcome line, logo, theme. **Back up settings** and **Restore** move them to a new phone.
- **Students see your branding.** The university name, logo, colour and welcome line are saved with the class, so every student's sign-in page shows them, with the course unit under the university name.
- **Themes.** The default is Delight (navy, magenta and yellow). Pick another preset, your own colour, and Auto, Light or Dark mode.
- **Lists** show **Status** (Present or Check) and **Method** (Scanned or Added by hand) as separate columns, in the app, the CSV and the PDF.
- **PDF** shows your university, lecturer name and a signature line, with no E-Presence or BrytMa branding. The credit lives on the About page.

## New in v5

- **Lists update live** while a session is open, and each session keeps its own list. A new session never shows earlier names. Pick any past session from the dropdown.
- **Real PDF file** made on the lecturer's device: university logo and name, lecturer, page numbers, signature line, optional cover page and footer text, and an optional small "Powered by E-Presence" line.
- **Templates:** digital list, weekly grid, time in and out, name and signature, or upload a CSV sample whose column headings become the PDF columns.
- **Settings buttons:** Themes, Templates, PDF & pages, Student page (Reg No and name, or name only; welcome line).

## What is in this repo

| Path | What it is |
|------|------------|
| `index.html` | Student page, opened by the QR code |
| `lecturer.html` | Lecturer page: start, QR and PIN, list, CSV, PDF, email, add by hand |
| `apps-script/Code.gs` | Backend, runs as a Google Apps Script Web app |
| `apps-script/appsscript.json` | Apps Script manifest (Kampala timezone, public Web app) |
| `smoke-test.ps1` | Live end-to-end check of a deployed backend |
| `deploy.ps1` | One-command update: deploy, live test, then push to GitHub |

## Setup

You need a Google account and a GitHub account.

1. **Backend.** Create an empty Google Sheet. Open Extensions > Apps Script, paste `apps-script/Code.gs`, and apply the settings in `appsscript.json`. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Approve the permissions (Sheet access and sending email). Copy the Web app URL.
2. **Open the Web app URL once.** It should say `E-Presence is running`. This creates the `Classes`, `Sessions` and `Attendance` tabs, and sets the Sheet's timezone to match the script. Tabs from an older version are renamed "Old ...", never deleted.
3. **Pages.** Put the Web app URL into `index.html` and `lecturer.html` (the `URL_` line near the bottom), then publish both files with GitHub Pages.
4. **Check it.** Run `smoke-test.ps1 -Url <web app URL>`. It runs a full test session and prints PASS or FAIL for each step. Delete the rows named "SMOKE" from the Sheet afterwards.

After any change to `Code.gs`, deploy a **new version** of the Web app. A plain save keeps the old code running.

## Data and privacy

- Everything lives in your own Google Sheet: the class and its sessions (names, PIN, optional email) and each sign-in (Reg No, name, time). There is no location tracking.
- Anyone with access to that Sheet can see everything in it, so keep it private.
- Tell students what is collected, why, and how long you keep it. If you handle personal data in Uganda, make sure your use follows the Data Protection and Privacy Act, 2019.

## Security: what it does and does not do

Designed to be simple, not bulletproof.

- **Does:** requires the session PIN to sign in, locks out a device after 5 wrong PINs, flags two people signing in from the same phone as **CHECK**, strips spreadsheet formula characters from names and titles, and keeps the list, PIN changes and export behind the lecturer's private key.
- **Does not:** stop a student telling a friend the PIN (change the PIN mid-class if that worries you), prove the student is physically in the room, or hide data from anyone who can open the Sheet. The session PIN is stored as plain text in the Sheet.
- Anyone can create a class. Classes are separate, and one lecturer cannot see another's lists without that class's private key.
- Anyone who sees the printed QR can open the sign-in page. They still need the PIN, which only shows while you are teaching.

## Known limitations

- Built for a single Sheet and light use. Very large classes signing in at the same moment may be slow, because every sign-in is handled one at a time.
- If a lecturer clears their browser data, their classes disappear from that browser and cannot be recovered. The attendance data stays in the Sheet, and the printed QR still works, but the lecturer must create a new class to control sessions.
- PDF export uses the browser's print dialog.

## Credits

Built in Uganda by **BrytMa Tech Uganda**.

Copyright (c) 2026 BrytMa Tech Uganda. All rights reserved.
