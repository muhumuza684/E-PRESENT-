# E-Presence

**QR-code attendance that replaces paper sheets. Built in Uganda by BrytMa Tech Uganda.**

The lecturer opens one page, names the session and picks a PIN. A QR code appears. Students scan it, type their Reg No, name and the PIN shown on the lecturer's screen, and they are signed in. The lecturer downloads the list as CSV, saves it as PDF, or has it emailed. No app to install, no accounts, no server to pay for: it runs on a Google Sheet, Google Apps Script and GitHub Pages.

## How it works

1. **Lecturer** opens `lecturer.html`, types a session name (for example "CSC2101 Week 5 lecture"), keeps or changes the suggested PIN, and taps **Start sign-in**. The QR code and a big PIN appear, ready to project.
2. **Students** scan the QR code, type their Reg No and full name (remembered on their phone for next time) and the PIN, and tap **Sign in**.
3. **During class** the lecturer sees a live count. **Change PIN** replaces the PIN at any moment (students who already signed in are unaffected). **End sign-in** closes it.
4. **After class** tap **List & export**: download a CSV, save a PDF, or email the list to yourself.
5. **Someone without a phone?** Under *Add someone by hand*, paste rows copied from Google Sheets (Reg No and Name, one person per row, in either order). They merge into the list, and duplicates are skipped.

For meetings and other gatherings, untick **Students also type a Reg No** and students only enter their name.

There are no lecturer accounts. The lecturer's browser keeps a private key for its session, which is needed to see the list, change the PIN or end the session. Reopen the same page on the same device and you are back in your session. A session closes by itself after 6 hours.

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
2. **Open the Web app URL once.** It should say `E-Presence is running`. This creates the `Sessions` and `Attendance` tabs, and sets the Sheet's timezone to match the script. Tabs from an older version are renamed "Old ...", never deleted.
3. **Pages.** Put the Web app URL into `index.html` and `lecturer.html` (the `URL_` line near the bottom), then publish both files with GitHub Pages.
4. **Check it.** Run `smoke-test.ps1 -Url <web app URL>`. It runs a full test session and prints PASS or FAIL for each step. Delete the rows named "SMOKE" from the Sheet afterwards.

After any change to `Code.gs`, deploy a **new version** of the Web app. A plain save keeps the old code running.

## Data and privacy

- Everything lives in your own Google Sheet: the session (name, PIN, optional email) and each sign-in (Reg No, name, time). There is no location tracking.
- Anyone with access to that Sheet can see everything in it, so keep it private.
- Tell students what is collected, why, and how long you keep it. If you handle personal data in Uganda, make sure your use follows the Data Protection and Privacy Act, 2019.

## Security: what it does and does not do

Designed to be simple, not bulletproof.

- **Does:** requires the session PIN to sign in, locks out a device after 5 wrong PINs, flags two people signing in from the same phone as **CHECK**, strips spreadsheet formula characters from names and titles, and keeps the list, PIN changes and export behind the lecturer's private key.
- **Does not:** stop a student telling a friend the PIN (change the PIN mid-class if that worries you), prove the student is physically in the room, or hide data from anyone who can open the Sheet. The session PIN is stored as plain text in the Sheet.
- Anyone can start a session. Sessions are separate, and one lecturer cannot see another's list without that session's key.

## Known limitations

- Built for a single Sheet and light use. Very large classes signing in at the same moment may be slow, because every sign-in is handled one at a time.
- If a lecturer clears their browser data, the on-screen session is lost. The data stays in the Sheet and can be emailed or exported from the Sheet.
- PDF export uses the browser's print dialog.

## Credits

Built in Uganda by **BrytMa Tech Uganda**.

Copyright (c) 2026 BrytMa Tech Uganda. All rights reserved.
