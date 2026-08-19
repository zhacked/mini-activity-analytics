import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Create data folder
const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
fs.mkdirSync(dataDir, { recursive: true });

// Create database
export const db = new Database(path.join(dataDir, "activity.db"));

// Enable better SQLite performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    application TEXT,
    window_title TEXT,
    state TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_started
  ON activity_events(started_at);

  CREATE INDEX IF NOT EXISTS idx_events_app
  ON activity_events(application);
`);