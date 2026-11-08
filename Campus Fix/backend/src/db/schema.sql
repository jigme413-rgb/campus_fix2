-- CampusFix database schema (PostgreSQL)
-- Safe to run more than once: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'staff', 'maintenance', 'admin')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  description  TEXT         NOT NULL,
  location     VARCHAR(150) NOT NULL,
  priority     VARCHAR(10)  NOT NULL DEFAULT 'Medium'
               CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status       VARCHAR(20)  NOT NULL DEFAULT 'Pending'
               CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Completed')),
  reporter_id  INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
  assigned_to  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Written by the requestStatusUpdated / maintenanceRequestCreated event handlers
CREATE TABLE IF NOT EXISTS status_history (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER     NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status  VARCHAR(20),
  new_status  VARCHAR(20) NOT NULL,
  changed_by  INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-app notifications written by event handlers (no SMS/email gateway, see proposal 4.2)
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id  INTEGER     REFERENCES requests(id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_reporter    ON requests(reporter_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_status      ON requests(status);
CREATE INDEX IF NOT EXISTS idx_history_request      ON status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, is_read);
