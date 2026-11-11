# CampusFix

Students and staff report problems such as a broken classroom light, a leaking hostel tap or dead Wi-Fi. The maintenance office assigns each report to a staff member, and everyone follows it from **Pending → Assigned → In Progress → Completed**. Every change raises an event; separate handlers write the status history and send notifications.

| Folder | What it is | Port |
| --- | --- | --- |
| [backend/](backend/) | REST API: Node.js, Express 5, PostgreSQL, Node `EventEmitter`. MVC with routes → controllers → models. | 3000 |
| [frontend/](frontend/) | Web app: Express + EJS server-rendered pages that consume the API. Plain CSS, no build step. | 4000 |
| [postman/](postman/) | Postman collection that exercises every endpoint and the full workflow. | |
| [docs/](docs/) | [API reference](docs/API.md) · [User guide](docs/USER_GUIDE.md) · [Maintainability notes](docs/MAINTAINABILITY.md) | |

```
Browser ──HTML forms──▶ frontend (Express + EJS :4000) ──JSON + Bearer JWT──▶ backend API (:3000) ──▶ PostgreSQL
                                                                                   │
                                                                         EventEmitter bus ──▶ history / notification / log handlers
```

The browser never sees the JWT. The frontend keeps it in an `httpOnly`, `SameSite=Lax` cookie and attaches it to API calls from the server.

---

## Quick start

You need **Node.js 18+** and **PostgreSQL 14+** running locally. Use two terminals. Run each command from its service folder; the project root has no `npm run dev` script. Leave both terminal processes running while you use the app.

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env              # put your Postgres password in DATABASE_URL
npm run db:setup                  # creates the database, tables and demo data
npm run dev                       # http://localhost:3000/api
```

**2. Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                       # http://localhost:4000
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@sherubtse.edu.bt` | `Student@123` |
| Lecturer (staff) | `lecturer@sherubtse.edu.bt` | `Staff@123` |
| Maintenance (electrician) | `electrician@sherubtse.edu.bt` | `Maint@123` |
| Maintenance (plumber) | `plumber@sherubtse.edu.bt` | `Maint@123` |
| Administrator | `admin@sherubtse.edu.bt` | `Admin@123` |

`npm run db:reset` drops the tables and rebuilds the demo data.

---

## How the requirements are met

| Requirement (proposal) | Where it lives |
| --- | --- |
| **FR1** Register, log in, role-based access | `backend/src/controllers/authController.js`, `middleware/auth.js` (`authenticate`, `authorize(...roles)`) |
| **FR2** Create request with title, description, location, category, priority | `POST /api/requests`, validated by `utils/validators.js` |
| **FR3** Reporters see their own requests | `GET /api/requests` is scoped by role in `requestController.list` |
| **FR4** Admins view, filter and search all requests | `?status=&priority=&category_id=&assigned_to=&search=&sort=&page=` |
| **FR5** Admin assigns to maintenance staff | `PATCH /api/requests/:id/assign` |
| **FR6** Staff move Assigned → In Progress → Completed | `PATCH /api/requests/:id/status` with rules in `canTransition()` |
| **FR7** Every status change logged | `events/handlers/historyHandler.js` writes `status_history` |
| **FR8** Events raised, handlers notify | `events/eventBus.js` + `handlers/notificationHandler.js` |
| **MVC** | `routes/` → `controllers/` → `models/` (all SQL), EJS views in the frontend |
| **REST** | Resource URLs, correct verbs, status codes 200/201/400/401/403/404/409/500 |
| **Security** | bcrypt hashes, JWT, parameterised SQL everywhere, helmet, login rate limit, CSP on the frontend |
| **Testing** | 83 Jest + Supertest tests (unit + integration), Postman collection, GitHub Actions CI |
| **Deployment** | `render.yaml` blueprint: Postgres + API + web app, auto-deploy on push to `main` |

### Events (proposal section 8)

| Event | Emitted by | Handlers |
| --- | --- | --- |
| `maintenanceRequestCreated` | `POST /api/requests` | notify all admins · first history row (none → Pending) · activity log |
| `requestAssigned` | `PATCH /requests/:id/assign` | notify assigned staff and reporter · history row (→ Assigned) · activity log |
| `requestStatusUpdated` | `PATCH /requests/:id/status` | history row (old → new, note, who) · notify reporter when work starts · activity log |
| `requestCompleted` | status set to Completed | notify reporter the problem is resolved · activity log |

Controllers call `await eventBus.emitAsync(...)`, an `EventEmitter` subclass method that runs every listener, waits for async ones, and logs a failing handler instead of throwing. A broken notification can never undo a saved request, and tests can check history rows straight after the response.

### Database

Five tables (`backend/src/db/schema.sql`): the four from the proposal (`users`, `categories`, `requests`, `status_history`) plus `notifications`, which holds in-app notifications because SMS and email gateways are out of scope (proposal 4.2).

---

## Testing

```bash
cd backend
cp .env.test.example .env.test    # a SEPARATE database, e.g. campusfix_test
npm test                          # 83 tests, rebuilds the test DB first
npm run test:coverage
```

| Proposal test case | Automated test |
| --- | --- |
| T1 Submit valid request → 201 + event | `tests/integration/requests.test.js` |
| T2 Missing title → 400 | `requests.test.js`, `tests/unit/validators.test.js` |
| T3 No token → 401 | `requests.test.js` |
| T4 Student assigns → 403 | `requests.test.js`, `tests/unit/authMiddleware.test.js` |
| T5 Admin assigns → Assigned + event | `requests.test.js` |
| T6 Staff completes → reporter notified | `tests/integration/workflow.test.js` |
| T7 Unknown id → 404 | `requests.test.js` |
| T8 Handler writes history | `tests/unit/handlers.test.js` (mocked models) and `workflow.test.js` (real DB) |

**Postman:** import `postman/CampusFix.postman_collection.json` and run it with the Collection Runner (needs the demo data). Or from the command line:

```bash
npx newman run postman/CampusFix.postman_collection.json
```

GitHub Actions (`.github/workflows/test.yml`) runs the full suite against a Postgres service on every push and pull request.

---

## Deploying to Render

1. Push this repository to GitHub.
2. In Render choose **New → Blueprint** and select the repository. `render.yaml` creates `campusfix-db`, `campusfix-api` and `campusfix-web`.
3. When prompted, set `ADMIN_PASSWORD` on the API and `API_URL` on the web service (for example `https://campusfix-api.onrender.com/api`).
4. Every push to `main` redeploys both services. The API build runs `db:setup --no-demo`, which creates the tables, the categories and the admin account without touching existing data.

---

## Project structure

```
backend/
  src/
    app.js, server.js       Express setup / HTTP server
    config/db.js            PostgreSQL pool
    routes/                 URL → middleware → controller
    controllers/            validate, call models, emit events
    models/                 every SQL query
    events/                 eventBus.js, handlers/, index.js (registration)
    middleware/             auth, validation, rate limit, error handler
    utils/                  validators, HttpError
    db/                     schema.sql, seed.js, setup.js
  tests/unit, tests/integration
frontend/
  src/                      app.js, routes/, lib/api.js (API client), middleware/session.js
  views/                    EJS pages and partials
  public/                   style.css, app.js (progressive enhancement), favicon
```
