import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/v1/health", (_, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
  });
});

// Receive activity from the Go agent
app.post("/api/v1/ingest", (req, res) => {
  const data = req.body;

  if (
    !data.deviceId ||
    !data.userId ||
    !data.startedAt ||
    !data.endedAt ||
    typeof data.durationSeconds !== "number" ||
    !data.state
  ) {
    return res.status(400).json({
      message: "Invalid activity data",
    });
  }

  const time = new Date().toISOString();

  // Save device
  db.prepare(`
    INSERT INTO devices (
      device_id,
      user_id,
      last_seen_at
    )
    VALUES (?, ?, ?)
    ON CONFLICT(device_id)
    DO UPDATE SET
      user_id = excluded.user_id,
      last_seen_at = excluded.last_seen_at
  `).run(
    data.deviceId,
    data.userId,
    time
  );

  // Save activity
  db.prepare(`
    INSERT INTO activity_events (
      device_id,
      user_id,
      event_type,
      started_at,
      ended_at,
      duration_seconds,
      application,
      window_title,
      state
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.deviceId,
    data.userId,
    data.eventType ?? "activity",
    data.startedAt,
    data.endedAt,
    Math.max(0, Math.round(data.durationSeconds)),
    data.application ?? null,
    data.windowTitle ?? null,
    data.state
  );

  res.status(202).json({
    accepted: true,
  });
});

// Dashboard summary
app.get("/api/v1/dashboard/summary", (_, res) => {
  const devices = db
    .prepare("SELECT COUNT(*) AS count FROM devices")
    .get() as { count: number };

  const active = db
    .prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) AS seconds
      FROM activity_events
      WHERE state = 'active'
    `)
    .get() as { seconds: number };

  const idle = db
    .prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) AS seconds
      FROM activity_events
      WHERE state = 'idle'
    `)
    .get() as { seconds: number };

  const activeDevices = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM devices
      WHERE last_seen_at >= datetime('now', '-2 minutes')
    `)
    .get() as { count: number };

  res.json({
    devices: devices.count,
    activeDevices: activeDevices.count,
    activeSeconds: active.seconds,
    idleSeconds: idle.seconds,
  });
});

// Application usage
app.get("/api/v1/dashboard/applications", (_, res) => {
  const applications = db
    .prepare(`
      SELECT
        COALESCE(application, 'Unknown') AS application,
        SUM(duration_seconds) AS seconds,
        COUNT(*) AS events
      FROM activity_events
      WHERE state = 'active'
      GROUP BY application
      ORDER BY seconds DESC
      LIMIT 10
    `)
    .all();

  res.json(applications);
});

// Recent activity
app.get("/api/v1/dashboard/recent", (_, res) => {
  const activities = db
    .prepare(`
      SELECT
        id,
        device_id AS deviceId,
        user_id AS userId,
        started_at AS startedAt,
        ended_at AS endedAt,
        duration_seconds AS durationSeconds,
        application,
        window_title AS windowTitle,
        state
      FROM activity_events
      ORDER BY id DESC
      LIMIT 30
    `)
    .all();

  res.json(activities);
});

// Start server
app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});