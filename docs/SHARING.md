# Sharing E-Presence with clients

How to take what you built to universities, schools and organisations.

## 1. What you are offering

A ready system that replaces paper attendance lists: a printable QR, a PIN per session, live lists, and a professional PDF with the client's name and logo. Each client's data stays in their own Google Sheet. There is nothing for them to install and no server for them to pay for.

Your promise: **same trust level as a paper sign-in sheet, minus the paper, the typing-up and the lost lists.** Do not promise more. It does not prove students are physically in the room, and a student can pass the PIN to a friend.

## 2. Two ways to share it

| | A. Shared (quick pilots) | B. Dedicated per client (recommended) |
|---|---|---|
| Backend | Everyone uses your one Sheet | Each client gets their own Sheet |
| Data | Mixed in your Sheet | Separate and owned by the client |
| Branding | Per lecturer, on their own device | Per lecturer, plus the client's pages |
| Setup time | None | About 10 minutes with `new-client.ps1` |
| Risk | You hold everyone's student data | Low. Easy to hand over or delete |
| Use for | A friendly lecturer trying it | Any university, school or company |

Start every serious client on **B**. Universities will ask who holds their students' data, and "your own Google Sheet" is a clean answer.

## 3. Onboarding a client, step by step

1. **Discovery (15 minutes).** Ask: how many lecturers and students? What does their current paper list look like? Do they need Reg No or names only? Who is the contact person?
2. **Show a live demo** on your phone: create a class, scan, watch the list fill, download the PDF.
3. **Get a sample paper list** from them. Match it to a template, or send you a CSV with the column headings.
4. **Set them up:** `.\new-client.ps1 -Client "Their Name"`. See [CLIENT-SETUP.md](CLIENT-SETUP.md).
5. **Brand it:** open their link, Settings, set the university name, logo, colour and template.
6. **Test on their devices** with 3 or more phones, Android and iPhone, in a real lecture room.
7. **Train in 15 minutes.** Walk through the [USER-GUIDE](USER-GUIDE.md). Print the poster with them.
8. **Pilot for 2 weeks** with 1 to 3 lecturers, running **next to the paper list**. Compare the two.
9. **Collect feedback** after one week and at the end.
10. **Go live.** Decide who the support contact is on both sides.
11. **Hand over:** the lecturer link, the Sheet link (see ownership in CLIENT-SETUP), the user guide, and a student instruction poster.

## 4. What to give every client

- Lecturer link: `https://muhumuza684.github.io/E-PRESENT-/clients/<name>/lecturer.html`
- The USER-GUIDE.md (print it or send as PDF)
- A student poster: *"1. Scan the QR code. 2. Type your Reg No, your name and the PIN on the screen. 3. Tap Sign in."*
- Your support email: muhumuzabright26@gmail.com

## 5. Keeping clients happy

- **Updates:** run `.\update-clients.ps1`. It re-deploys every client and tests each one.
- **Backups:** Google Sheets keeps version history (File > Version history). For a real backup, each term download the Sheet as Excel.
- **Support routine:** one email address, a reply within one working day, and a short log of problems.
- **Limits to know:** Google allows about 100 emails a day on a free account, and the system handles sign-ins one at a time. It has not been load-tested at scale, so for classes above roughly 150 students, test in the real room first and ask students to sign in over a minute or two, not all at the same second.

## 6. Commercial and legal basics

Decide these before you sell:

- **Pricing model.** Common choices: a setup fee plus an annual support fee per department, a fee per lecturer per year, or a one-off licence per university. Pick one, keep it simple, and offer a free pilot.
- **A simple agreement.** One page covering who owns the data (the client), what you do (set up, support, updates), what you do not do (guarantee uptime of Google services), and how either side ends it.
- **Privacy notice.** Students should be told what is collected (Reg No, name, sign-in time), why, who sees it and how long it is kept. In Uganda, check with the Personal Data Protection Office whether the client or you must register, and follow the Data Protection and Privacy Act, 2019.
- **Branding.** The PDF shows the client's name by default and a small "Powered by E-Presence" line that clients can switch off. The "Built in Uganda by BrytMa Tech Uganda" credit stays on the lecturer and student pages.

## 7. Answering the questions you will get

| They ask | You say |
|---|---|
| Can students cheat? | A friend with the PIN can sign in remotely, the same as a signature on paper. Change the PIN mid-lecture, and look at names marked Check. |
| Where is our data? | In your own Google Sheet, under your account. |
| Do students need an app or data? | No app. A phone with a camera and a little mobile data. |
| What if the internet is down? | Sign-in needs data. Keep a paper list as a backup, then use "Add someone by hand". |
| Can we use our own paper format? | Yes. Pick a template, or send a CSV with your column headings. |
| Is it free? | Your pricing decision. Offer a pilot. |

## 8. If clients ask for more

These are the most likely next requests, in the order I would build them: lecturer accounts with password reset, hashed PINs, a rotating on-screen code, approve or reject for rows marked Check, a rostered attendance report against official class lists, and a proper database (for example Supabase) if a client has thousands of students signing in at once.
