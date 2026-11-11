# CampusFix user guide

CampusFix runs in any web browser, on a phone or a computer. Open the address your college gives you (for local testing, http://localhost:4000).

> **Screenshots:** add your own captures of each step below into `docs/screenshots/` before submitting. Suggested files are named in each section.

## Students and lecturers

### Create an account (`register.png`)
1. Choose **Report a problem** on the home page.
2. Enter your name and college email, choose **Student** or **Lecturer / staff**, and pick a password (8+ characters with a letter and a number).

### Report a problem (`report.png`)
1. Choose **Report a problem** in the top bar.
2. Write a short title, such as "Tube light not working".
3. Pick the category: Electrical, Plumbing, Wi-Fi, Furniture, Hostel, Cleaning or Other.
4. Give the exact location: building, floor and room.
5. Describe the problem and choose a priority. Use **Urgent** only for safety risks such as exposed wiring or flooding.
6. Choose **Submit request**. The maintenance office is notified straight away.

You can edit a request until it has been assigned.

### Follow progress (`detail.png`)
- **Dashboard** shows how many of your requests are at each stage.
- Every request shows a four-step track: **Pending → Assigned → In Progress → Completed**, and a history of who changed what and when.
- The bell in the top bar shows new notifications: when your request is assigned, when work starts, and when it is fixed.

## Maintenance staff

1. Log in with the account the maintenance office created for you.
2. **My work** lists the jobs assigned to you, most urgent first (`queue.png`).
3. Open a job and choose **Mark as In Progress** when you start. Add a note if it helps, such as "Ordered a replacement part".
4. When the job is done, choose **Mark as Completed** and note what you did. The reporter is told the problem is resolved.

## Maintenance office (administrators)

### Overview (`admin.png`)
The overview shows requests at each stage, the queue waiting for assignment, average time to fix, each staff member's open and finished jobs, which categories and locations come up most often, and a live log of system events.

### Assign work
1. Open a Pending request from **Waiting for assignment** or **Requests**.
2. Under **Assign to staff**, choose a person. Their current number of open jobs is shown next to their name.
3. Choose **Assign**. The staff member and the reporter are both notified.

### Other actions
- **Change status** lets you move a request to any stage, for example to reopen a completed job that failed again.
- **Requests** can be filtered by status, priority, category and staff member, searched by text, and sorted by urgency.
- **Users** lets you create maintenance and admin accounts and change anyone's role.
- **Categories** lets you add, rename or remove categories.
- **Delete request** removes a request permanently (you are asked to confirm).

## Light and dark mode
CampusFix follows your device setting. Use the half-circle button in the top bar to switch.
