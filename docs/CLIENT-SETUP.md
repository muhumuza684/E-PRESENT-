# Setting E-Presence up for a new client

Each client gets **their own Google Sheet and backend** and **their own copy of the pages**, so their data stays separate from everyone else's.

## What you need

- A Windows PC with Node.js, `clasp` (`npm install -g @google/clasp`), Git and GitHub CLI, already logged in. This is the same PC you used to build E-Presence.
- This project in `Desktop\e-presence\repo-check`.
- About 10 minutes per client.

## The easy way (script)

Open PowerShell and run, with the client's name:

```powershell
cd "$([Environment]::GetFolderPath('Desktop'))\e-presence\repo-check"
.\new-client.ps1 -Client "MUST"
```

The script:
1. Creates a new Google Sheet and Apps Script project called `E-Presence - MUST` and deploys it.
2. Opens the backend link. **You approve the permissions once** (Review permissions > Advanced > Go to project > Allow), then press Enter in PowerShell.
3. Makes a copy of the two pages in `clients/must/` with that client's backend address built in.
4. Runs the live end-to-end test. If any check fails, it stops and does not publish.
5. Publishes to GitHub Pages and prints the client's links.

You get:
- Lecturer link: `https://muhumuza684.github.io/E-PRESENT-/clients/must/lecturer.html`
- The client's Google Sheet link.

Wait about a minute for GitHub Pages, then open the lecturer link.

## Giving the client ownership of their data

The Sheet is created in **your** Google account. Two choices:
- **You keep it** and run it for them (managed service). Share the Sheet with a client contact as Viewer if they want to see data.
- **Transfer ownership:** open the Sheet > Share > add the client's Google account > change them to Owner. They accept, and the data is theirs. The backend script is attached to the Sheet, so it moves with it. Redeploy under their account if they want to manage updates themselves.

## Branding for the client

Open their lecturer link, go to **Settings**, and set the university name, logo, colour and a template once. Every lecturer sets their own lecturer name. Each lecturer's settings are saved on their own device.

## Updating every client later

When you improve E-Presence, run `.\update-clients.ps1` from the repo folder. It re-deploys every client's backend, refreshes their pages (keeping their address), tests each one, and publishes.

## Doing it by hand (no script)

1. Create a Google Sheet. Extensions > Apps Script. Paste `apps-script/Code.gs` and apply `appsscript.json`.
2. Deploy > New deployment > Web app (Execute as: Me, access: Anyone). Approve. Copy the URL.
3. Open the URL once. It should say `E-Presence is running`.
4. Copy `index.html` and `lecturer.html` to a new folder. In both, replace the address on the `URL_` line with the client's URL.
5. Publish the folder with GitHub Pages (or any static host).
6. Run `smoke-test.ps1 -Url <URL>`. All checks should pass. Delete the rows named "SMOKE class" from their Sheet afterwards.
