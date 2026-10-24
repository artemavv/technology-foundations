// SQLite database for user accounts, chronos and training statistics.
// Migrations are only ever appended: the applied count is kept in PRAGMA user_version.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const MIGRATIONS = [
  // 1: accounts, chronos, training
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    login         TEXT NOT NULL UNIQUE COLLATE NOCASE, -- limited to [A-Za-z0-9_.-], so NOCASE is exact
    pw_hash       BLOB NOT NULL,
    pw_salt       BLOB NOT NULL,
    pw_params     TEXT NOT NULL,                       -- 'scrypt:16384:8:1': cost can be raised later
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at    INTEGER NOT NULL,                    -- unix ms
    approved_at   INTEGER,
    last_login_at INTEGER
  );
  CREATE INDEX users_status ON users(status);

  CREATE TABLE sessions (
    token_hash   TEXT PRIMARY KEY,                     -- sha256 hex of the cookie token
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expires ON sessions(expires_at);

  -- Global chronos (owner_id NULL, admin-managed) and personal ones in one table,
  -- so selections and training answers reference a single chrono_id.
  CREATE TABLE chronos (
    id          INTEGER PRIMARY KEY,
    owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    card_id     TEXT,                                  -- global only; cards live in JSON, so no FK
    time        TEXT NOT NULL,                         -- display date; a snapshot when linked to a card
    mya         REAL NOT NULL,                         -- sort key; a snapshot when linked to a card
    title_i18n  TEXT,                                  -- global: JSON { <lang>: text }
    title       TEXT,                                  -- personal: plain text
    description TEXT,                                  -- personal, optional
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    CHECK (
      (owner_id IS NULL AND title_i18n IS NOT NULL AND title IS NULL AND description IS NULL)
      OR (owner_id IS NOT NULL AND title IS NOT NULL AND title_i18n IS NULL AND card_id IS NULL)
    )
  );
  CREATE INDEX chronos_owner ON chronos(owner_id);
  CREATE INDEX chronos_card ON chronos(card_id);

  -- global chronos a user put on their memory line (personal ones are implicitly theirs)
  CREATE TABLE user_chronos (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chrono_id INTEGER NOT NULL REFERENCES chronos(id) ON DELETE CASCADE,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, chrono_id)
  ) WITHOUT ROWID;
  CREATE INDEX user_chronos_chrono ON user_chronos(chrono_id);

  CREATE TABLE training_runs (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode        TEXT NOT NULL DEFAULT 'default',
    status      TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    total       INTEGER NOT NULL DEFAULT 0,            -- filled when the run finishes
    correct     INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    meta        TEXT                                   -- free JSON for later modes
  );
  CREATE INDEX training_runs_user ON training_runs(user_id, started_at DESC);

  CREATE TABLE training_answers (
    id             INTEGER PRIMARY KEY,
    run_id         INTEGER NOT NULL REFERENCES training_runs(id) ON DELETE CASCADE,
    seq            INTEGER NOT NULL,                   -- position in the run; makes retries idempotent
    chrono_id      INTEGER REFERENCES chronos(id) ON DELETE SET NULL, -- history outlives the chrono
    title_snapshot TEXT,
    correct        INTEGER NOT NULL CHECK (correct IN (0, 1)),
    response_ms    INTEGER,
    answer         TEXT,                               -- free JSON, format decided with the training UI
    answered_at    INTEGER NOT NULL,
    UNIQUE (run_id, seq)
  );
  CREATE INDEX training_answers_chrono ON training_answers(chrono_id);
  `,
  // 2: admin accounts (created with scripts/create-admin.js, never by registration)
  `
  ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));
  `,
  // 3: skipped answers (the answer was only shown) are kept, but are neither correct nor
  // incorrect: they are not part of a run's total or of the statistics
  `
  ALTER TABLE training_answers ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1));
  ALTER TABLE training_runs ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;
  `,
  // 4: chronos a user has marked as known: left out of training. Works for global and
  // personal chronos alike (a global one must be on the user's memory line).
  `
  CREATE TABLE user_known (
    user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    chrono_id INTEGER NOT NULL REFERENCES chronos(id) ON DELETE CASCADE,
    known_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, chrono_id)
  ) WITHOUT ROWID;
  CREATE INDEX user_known_chrono ON user_known(chrono_id);
  `,
]

// better-sqlite3 is loaded here, not at the top, so `vite build` and the rest of
// the site work even if the native module is missing.
export async function openDb(file) {
  const { default: Database } = await import('better-sqlite3')
  mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  const applied = db.pragma('user_version', { simple: true })
  for (let i = applied; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    })()
  }
  return db
}
