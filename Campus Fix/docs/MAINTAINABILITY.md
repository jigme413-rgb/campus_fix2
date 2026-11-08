# Maintainability notes

## Code structure

The backend follows MVC with one direction of dependency:

```
routes/       which URL, which middleware, which controller function
  ↓
controllers/  validate input, check permissions, call models, emit events
  ↓
models/       the ONLY place SQL is written (always parameterised: $1, $2 ...)
```

Side effects (history, notifications, logging) never live in controllers. They live in `events/handlers/` and react to events.

| Concern | File |
| --- | --- |
| Input rules | `src/utils/validators.js` (pure functions, unit tested) |
| Workflow rules | `canTransition()` in the same file |
| Who can see what | `canView()` in `requestController.js` and the role scoping in `list()` |
| Error format | `src/middleware/errorHandler.js` |
| Database shape | `src/db/schema.sql` (idempotent) and `src/db/seed.js` |

The frontend never talks to the database. It calls the API through `frontend/src/lib/api.js`, so the API stays the single source of truth and could serve a mobile app later without changes.

## How to add a new event

Example: email the reporter when a request has waited 3 days.

1. Add the name to `EVENTS` in `src/events/eventBus.js`, e.g. `REQUEST_OVERDUE: 'requestOverdue'`.
2. Emit it where it happens: `await eventBus.emitAsync(EVENTS.REQUEST_OVERDUE, { request, actor })`.
3. Create `src/events/handlers/overdueHandler.js` with a `register(bus)` function that calls `bus.on(EVENTS.REQUEST_OVERDUE, handler)`.
4. Register it in `src/events/index.js`.
5. Add a unit test like `tests/unit/handlers.test.js`: build a fresh `CampusFixEventBus`, register the handler, mock the models, emit, assert.

No existing controller or handler needs to change. The activity log picks up any name in `EVENTS` automatically.

## How to add a field to requests

1. Add the column to `schema.sql` (`ALTER TABLE requests ADD COLUMN IF NOT EXISTS ...` for existing databases).
2. Accept it in `validateRequest()` and in the `allowed` list of `requestModel.update()`.
3. Add it to the form in `frontend/views/requests/form.ejs` and `pickRequestFields()` in `frontend/src/routes/requests.js`.
4. Add a test case.

## Conventions

- Throw `HttpError` helpers (`badRequest`, `forbidden`, `notFound`...) from controllers. Express 5 forwards async errors automatically, so no `try/catch` is needed.
- Validation errors carry `{ field, message }` so the frontend can show them next to the right input.
- Integration tests create their own users with unique emails and never depend on demo data.
- The test database name must contain `test`; `tests/globalSetup.js` refuses to reset anything else.

## Design system (frontend)

`frontend/public/css/style.css` starts with the design tokens. One accent colour (Sherubtse maroon) on cool slate neutrals; status colours are semantic only. Headings use Outfit (self-hosted variable font); everything else uses the platform font. Icons are Phosphor SVGs inlined at render time by `icon()` in `lib/helpers.js`. Radius rule: controls 10px, containers 14px, badges fully round. Every page works without JavaScript; `public/js/app.js` only adds confirm dialogs, auto-submitting filters and the instant theme switch.

## Ideas for future work

- Photo attachments on requests (multer + object storage).
- Email or SMS notifications as an extra event handler (out of scope in the proposal, now a one-file change).
- Scheduled overdue reminders (see the example above).
- Reporter rating after completion, feeding the staff workload view.
- Persist the activity log in a table instead of memory.
- Websocket push so the notification bell updates without a page load.
