# E-Presence: setup

## 1. Google Sheet
1. Create a new Google Sheet.
2. Make 4 tabs named exactly: Lecturers, Students, Sessions, Attendance.
3. For each tab: File > Import > Upload the matching file in sheet-templates/ > "Replace current sheet".
   (Sessions and Attendance only hold the header row. Delete the sample rows in Lecturers and Students and add real ones.)
4. Lecturers: lecturer_id, pin, email. Students: student_no, name, pin.
   Format the pin and student_no columns as Plain text so leading zeros are kept.

## 2. Backend
1. In the Sheet: Extensions > Apps Script. Delete the sample code, paste apps-script/Code.gs, save.
2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy.
3. Approve the permissions (it needs the Sheet and email).
4. Copy the Web app URL.

After any later change to Code.gs: Deploy > Manage deployments > edit > New version > Deploy.

## 3. Web pages
1. Open index.html and lecturer.html. Replace PASTE_WEB_APP_URL_HERE with the Web app URL (both files).
2. Create a GitHub repo, put index.html and lecturer.html in the root, then Settings > Pages > deploy from main.
3. Lecturer page: https://YOUR-USER.github.io/YOUR-REPO/lecturer.html

## 4. First test (3+ phones, in the real room)
1. Lecturer page: ID + PIN + course (e.g. CSC2101) + Start session (allow location).
2. Generate QR, scan it with the other phones, sign in as test students.
3. Show list, then try Download CSV, Save as PDF and Email me the list.
4. Try a student standing outside the room, and two students on one phone: both should show CHECK.
5. Run one real lecture next to the paper sheet before relying on it.

Students scan: https://YOUR-USER.github.io/YOUR-REPO/index.html?course=CSC2101
