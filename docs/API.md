# CampusFix API reference

Base URL: `http://localhost:3000/api` (local) or `https://<your-api>.onrender.com/api` (Render).
All bodies are JSON. Protected endpoints need `Authorization: Bearer <token>` from `/auth/login` or `/auth/register`.

## Errors

Every error uses the same shape:

```json
{ "error": { "message": "Validation failed", "details": [{ "field": "title", "message": "Title is required (3-150 characters)" }] } }
```

| Status | Meaning |
| --- | --- |
| 200 OK | Success |
| 201 Created | A resource was created |
| 400 Bad Request | Invalid input, bad filter, or a workflow rule was broken (e.g. Assigned → Completed by staff) |
| 401 Unauthorized | Missing, invalid or expired token; wrong login |
| 403 Forbidden | Logged in but your role or ownership does not allow it |
| 404 Not Found | Unknown id or route |
| 409 Conflict | Duplicate email or category name |
| 429 Too Many Requests | More than 10 failed logins from one IP in 15 minutes |
| 500 Internal Server Error | Unexpected failure (details are logged, not returned) |

## Roles

`student` and `staff` are **reporters**. `maintenance` staff do the repairs. `admin` runs the maintenance office.

---

## Auth

### POST /auth/register (public)

Students and college staff create their own accounts. Maintenance and admin accounts are created by an admin.

```json
{ "name": "Tashi Dorji", "email": "tashi@sherubtse.edu.bt", "password": "Password1", "role": "student" }
```

`role` is `student` (default) or `staff`. Password: 8+ characters with a letter and a number.
**201** `{ "user": { "id": 6, "name": "...", "email": "...", "role": "student", "created_at": "..." }, "token": "eyJ..." }` · **400** · **409**

### POST /auth/login (public)

```json
{ "email": "student@sherubtse.edu.bt", "password": "Student@123" }
```

**200** `{ "user": {...}, "token": "eyJ..." }` · **401** `Invalid email or password` · **429**

### GET /auth/me (any role)

**200** `{ "user": {...} }`

---

## Requests

### POST /requests (student, staff)

```json
{
  "title": "Broken classroom light",
  "description": "The tube light at the front of Room 101 does not switch on.",
  "location": "Academic Block A, Room 101",
  "category_id": 1,
  "priority": "High"
}
```

`priority` is `Low`, `Medium` (default), `High` or `Urgent`.
**201** `{ "request": { "id": 5, "status": "Pending", "category_name": "Electrical", "reporter_name": "...", ... } }`
Emits **`maintenanceRequestCreated`**.

### GET /requests (any role, scoped)

| Role | Sees |
| --- | --- |
| student / staff | only requests they reported |
| maintenance | only requests assigned to them |
| admin | everything; may also filter by `assigned_to` |

Query parameters (all optional): `status`, `priority`, `category_id`, `assigned_to` (admin), `search` (title, description, location), `sort` (`newest` default, `oldest`, `priority`, `updated`), `page`, `limit` (max 100).

**200**
```json
{ "requests": [ { "id": 5, "title": "...", "status": "Pending", "priority": "High", "location": "...", "category_name": "Electrical", "reporter_name": "...", "assigned_name": null, "created_at": "..." } ],
  "total": 1, "page": 1, "limit": 20, "pages": 1 }
```

### GET /requests/:id (admin, the reporter, or the assigned staff member)

**200** `{ "request": {...}, "history": [ { "old_status": null, "new_status": "Pending", "changed_by_name": "Tashi Dorji", "note": "Request submitted", "changed_at": "..." } ] }` · **403** · **404**

### PUT /requests/:id (reporter while Pending, or admin)

Send any of `title`, `description`, `location`, `category_id`, `priority`.
**200** `{ "request": {...} }` · **400** · **403** (not owner, or no longer Pending) · **404**

### PATCH /requests/:id/assign (admin)

```json
{ "staff_id": 3 }
```

The user must have role `maintenance`. Sets status to **Assigned**. Completed requests must be reopened first.
**200** `{ "request": {...} }` · **400** · **403** · **404**
Emits **`requestAssigned`**.

### PATCH /requests/:id/status (assigned maintenance staff, or admin)

```json
{ "status": "In Progress", "note": "Replacing the starter" }
```

| Who | Allowed changes |
| --- | --- |
| maintenance (assigned to it) | Assigned → In Progress, In Progress → Completed |
| admin | any status to any other; moving to Pending releases the assignment |

Any status other than Pending needs an assigned staff member.
**200** `{ "request": {...} }` · **400** (illegal transition) · **403** · **404**
Emits **`requestStatusUpdated`**, plus **`requestCompleted`** when the new status is Completed.

### DELETE /requests/:id (admin)

**200** `{ "message": "Request deleted" }` · **403** · **404**

---

## Categories

| Method | Endpoint | Access | Body | Success |
| --- | --- | --- | --- | --- |
| GET | `/categories` | any role | | 200 `{ categories: [{ id, name, request_count }] }` |
| POST | `/categories` | admin | `{ "name": "Sports Ground" }` | 201 · 409 duplicate |
| PUT | `/categories/:id` | admin | `{ "name": "Sports Facilities" }` | 200 · 404 · 409 |
| DELETE | `/categories/:id` | admin | | 200 (its requests become uncategorised) · 404 |

## Users (admin only)

| Method | Endpoint | Body | Success |
| --- | --- | --- | --- |
| GET | `/users?role=maintenance` | | 200 `{ users: [{ id, name, email, role, open_assignments }] }` |
| POST | `/users` | `{ name, email, password, role }` (any role) | 201 · 400 · 409 |
| PATCH | `/users/:id/role` | `{ "role": "staff" }` | 200 · 400 (own account) · 404 |
| DELETE | `/users/:id` | | 200 · 400 (own account) · 404 |

## Notifications (any role, own only)

| Method | Endpoint | Success |
| --- | --- | --- |
| GET | `/notifications?unread=true` | 200 `{ notifications: [...], unread: 2 }` |
| PATCH | `/notifications/:id/read` | 200 · 404 (not yours) |
| PATCH | `/notifications/read-all` | 200 `{ updated: 2 }` |

## Dashboard (admin only)

### GET /stats

```json
{ "stats": {
  "total": 4,
  "by_status": { "Pending": 1, "Assigned": 1, "In Progress": 1, "Completed": 1 },
  "by_category": [{ "category": "Electrical", "count": 1 }],
  "open_by_priority": [{ "priority": "Urgent", "count": 1 }],
  "avg_resolution_hours": 5.5,
  "staff_workload": [{ "id": 3, "name": "Karma Wangdi", "open": 1, "completed": 1 }],
  "recurring_locations": [{ "location": "Boys Hostel 2", "count": 3 }]
} }
```

### GET /events

The last 50 events raised in this server process, newest first:
`{ "events": [{ "event": "requestAssigned", "request_id": 5, "actor": { "name": "Ugyen Wangmo", "role": "admin" }, "details": { "assigned_to": "Karma Wangdi" }, "at": "..." }] }`

## Health

`GET /health` (public) → `{ "status": "ok", "service": "campusfix-api", "time": "..." }`. Also checks the database connection.
