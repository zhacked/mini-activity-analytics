import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./style.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";
const API_TIMEOUT = import.meta.env.API_TIMEOUT || 10000;
const ACTIVITIES_PER_PAGE =  import.meta.env.PER_PAGE || 10;

type Summary = {
  devices: number;
  activeDevices: number;
  activeSeconds: number;
  idleSeconds: number;
};

type Application = {
  application: string;
  seconds: number;
  events: number;
};

type Device = {
  deviceId: string;
  userId: string;
  lastSeenAt: string;
  status: string;
};

type Activity = {
  id: number;
  deviceId: string;
  userId: string;
  startedAt: string;
  application: string | null;
  windowTitle: string | null;
  state: string;
  durationSeconds: number;
};

/**
 * Generic GET request helper.
 */
const get = async <T,>(
  endpoint: string
): Promise<T> => {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `API error ${response.status} ${response.statusText}${
          body ? `: ${body.slice(0, 200)}` : ""
        }`
      );
    }

    if (!contentType.includes("application/json")) {
      const body = await response.text();

      console.error(
        "Expected JSON but received:",
        body
      );

      throw new Error(
        `Backend returned ${
          contentType || "unknown content type"
        } instead of JSON.`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `Backend request timed out after ${
          API_TIMEOUT / 1000
        } seconds.`
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

/**
 * DELETE request helper.
 */
const remove = async (
  endpoint: string
): Promise<void> => {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `API error ${response.status} ${response.statusText}${
          body ? `: ${body.slice(0, 200)}` : ""
        }`
      );
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `Delete request timed out after ${
          API_TIMEOUT / 1000
        } seconds.`
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

/**
 * Format seconds into a readable duration.
 */
const formatDuration = (
  seconds: number
): string => {
  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
};

/**
 * Format dates safely.
 */
const formatDateTime = (
  value: string
): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

/**
 * Format time only.
 */
const formatTime = (
  value: string
): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString();
};

function App() {
  const [summary, setSummary] =
    useState<Summary | null>(null);

  const [applications, setApplications] =
    useState<Application[]>([]);

  const [devices, setDevices] =
    useState<Device[]>([]);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [clearing, setClearing] =
    useState(false);

  const [error, setError] =
    useState("");

  /**
   * Pagination state.
   */
  const [activityPage, setActivityPage] =
    useState(1);

  /**
   * Calculate total pages.
   */
  const activityTotalPages =
    Math.max(
      1,
      Math.ceil(
        activities.length /
          ACTIVITIES_PER_PAGE
      )
    );

  /**
   * Get activities for current page.
   */
  const paginatedActivities =
    useMemo(() => {
      const start =
        (activityPage - 1) *
        ACTIVITIES_PER_PAGE;

      const end =
        start +
        ACTIVITIES_PER_PAGE;

      return activities.slice(
        start,
        end
      );
    }, [
      activities,
      activityPage,
    ]);

  /**
   * Load all dashboard data.
   */
  const loadDashboard =
    useCallback(
      async (
        showLoading = false
      ) => {
        try {
          if (showLoading) {
            setRefreshing(true);
          }

          const [
            summaryData,
            applicationsData,
            devicesData,
            activitiesData,
          ] = await Promise.all([
            get<Summary>(
              "/api/v1/dashboard/summary"
            ),

            get<Application[]>(
              "/api/v1/dashboard/applications"
            ),

            get<Device[]>(
              "/api/v1/dashboard/devices"
            ),

            get<Activity[]>(
              "/api/v1/dashboard/recent"
            ),
          ]);

          setSummary(summaryData);

          setApplications(
            Array.isArray(
              applicationsData
            )
              ? applicationsData
              : []
          );

          setDevices(
            Array.isArray(
              devicesData
            )
              ? devicesData
              : []
          );

          const activityList =
            Array.isArray(
              activitiesData
            )
              ? activitiesData
              : [];

          setActivities(
            activityList
          );

          /**
           * Prevent the current page from
           * becoming invalid after refresh.
           */
          const totalPages =
            Math.max(
              1,
              Math.ceil(
                activityList.length /
                  ACTIVITIES_PER_PAGE
              )
            );

          setActivityPage(
            (currentPage) =>
              Math.min(
                currentPage,
                totalPages
              )
          );

          setError("");
        } catch (err) {
          console.error(
            "Dashboard error:",
            err
          );

          if (
            err instanceof Error
          ) {
            setError(err.message);
          } else {
            setError(
              "Unable to load dashboard data."
            );
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  /**
   * Clear all activity.
   */
  const handleClearActivities =
    useCallback(async () => {
      const confirmed =
        window.confirm(
          "Are you sure you want to clear all activity history?\n\nThis action cannot be undone."
        );

      if (!confirmed) {
        return;
      }

      try {
        setClearing(true);
        setError("");

        await remove(
          "/api/v1/dashboard/activities"
        );

        setActivities([]);

        setActivityPage(1);

        /**
         * Reload dashboard summary,
         * applications and devices.
         */
        await loadDashboard();
      } catch (err) {
        console.error(
          "Clear activity error:",
          err
        );

        if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Unable to clear activity history."
          );
        }
      } finally {
        setClearing(false);
      }
    }, [loadDashboard]);

  /**
   * Initial load + automatic refresh.
   */
  useEffect(() => {
    loadDashboard();

    const interval =
      window.setInterval(() => {
        loadDashboard();
      }, 5000);

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [loadDashboard]);

  return (
    <main>
      {/* HEADER */}

      <header>
        <div>
          <small>
            Mini ActivTrak Prepared by
            Fernando Siapco III
          </small>

          <h1>
            Activity Analytics
          </h1>

          <p>
            Windows agent activity on
            your local machine.
          </p>
        </div>

        <button
          onClick={() =>
            loadDashboard(true)
          }
          disabled={
            refreshing ||
            clearing
          }
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </header>

      {/* ERROR */}

      {error && (
        <div className="error">
          <strong>
            Dashboard Error:
          </strong>

          <span>
            {error}
          </span>

          <p>
            Make sure the Go backend is
            running at{" "}
            <strong>
              {API_BASE_URL}
            </strong>
          </p>

          <p>
            Test the API directly:
          </p>

          <code>
            {API_BASE_URL}
            /api/v1/dashboard/summary
          </code>
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div className="loading">
          Loading activity data...
        </div>
      )}

      {/* SUMMARY */}

      <section className="cards">
        <Card
          name="Devices"
          value={
            summary?.devices ?? 0
          }
        />

        <Card
          name="Active now"
          value={
            summary?.activeDevices ??
            0
          }
        />

        <Card
          name="Active time"
          value={formatDuration(
            summary?.activeSeconds ??
              0
          )}
        />

        <Card
          name="Idle time"
          value={formatDuration(
            summary?.idleSeconds ??
              0
          )}
        />
      </section>

      {/* DEVICES */}

      <section className="panel">
        <div className="panel-header">
          <h2>
            Devices
          </h2>

          <span>
            {devices.length} device(s)
          </span>
        </div>

        {devices.length === 0 ? (
          <p>
            No devices connected.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    Device
                  </th>

                  <th>
                    User
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Last Seen
                  </th>
                </tr>
              </thead>

              <tbody>
                {devices.map(
                  (device) => (
                    <tr
                      key={
                        device.deviceId
                      }
                    >
                      <td>
                        <strong>
                          {
                            device.deviceId
                          }
                        </strong>
                      </td>

                      <td>
                        {device.userId}
                      </td>

                      <td>
                        <span
                          className={`status ${
                            device.status ===
                            "online"
                              ? "online"
                              : "offline"
                          }`}
                        >
                          {
                            device.status
                          }
                        </span>
                      </td>

                      <td>
                        {formatDateTime(
                          device.lastSeenAt
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* APPLICATIONS + SYSTEM */}

      <section className="grid">
        {/* APPLICATIONS */}

        <div className="panel">
          <h2>
            Top Applications
          </h2>

          {applications.length ===
          0 ? (
            <p>
              No activity yet.
            </p>
          ) : (
            applications.map(
              (
                application,
                index
              ) => (
                <div
                  className="row"
                  key={`${application.application}-${index}`}
                >
                  <span>
                    <b>
                      {
                        application.application
                      }
                    </b>

                    <small>
                      {
                        application.events
                      }{" "}
                      events
                    </small>
                  </span>

                  <b>
                    {formatDuration(
                      application.seconds
                    )}
                  </b>
                </div>
              )
            )
          )}
        </div>

        {/* SYSTEM STATUS */}

        <div className="panel">
          <h2>
            System Status
          </h2>

          <div className="status-row">
            <span>
              Backend API
            </span>

            <strong className="online-text">
              {error
                ? "OFFLINE"
                : "ONLINE"}
            </strong>
          </div>

          <div className="status-row">
            <span>
              Desktop Agent
            </span>

            <strong
              className={
                summary?.activeDevices
                  ? "online-text"
                  : "offline-text"
              }
            >
              {summary?.activeDevices
                ? "ONLINE"
                : "OFFLINE"}
            </strong>
          </div>

          <div className="status-row">
            <span>
              Database
            </span>

            <strong
              className={
                error
                  ? "offline-text"
                  : "online-text"
              }
            >
              {error
                ? "UNKNOWN"
                : "CONNECTED"}
            </strong>
          </div>

          <div className="status-row">
            <span>
              Auto Refresh
            </span>

            <strong>
              5 seconds
            </strong>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITY */}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              Recent Activity
            </h2>

            <span>
              {activities.length} event
              {activities.length !==
              1
                ? "s"
                : ""}
            </span>
          </div>

          <button
            className="danger-button"
            onClick={
              handleClearActivities
            }
            disabled={
              clearing ||
              activities.length === 0
            }
          >
            {clearing
              ? "Clearing..."
              : "Clear Activity"}
          </button>
        </div>

        {activities.length ===
        0 ? (
          <p>
            No activity events.
          </p>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>
                      Time
                    </th>

                    <th>
                      Application
                    </th>

                    <th>
                      Window
                    </th>

                    <th>
                      State
                    </th>

                    <th>
                      Duration
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedActivities.map(
                    (activity) => (
                      <tr
                        key={
                          activity.id
                        }
                      >
                        <td>
                          {formatTime(
                            activity.startedAt
                          )}
                        </td>

                        <td>
                          {activity.application ||
                            "Unknown"}
                        </td>

                        <td className="window-title">
                          {activity.windowTitle ||
                            "Unknown"}
                        </td>

                        <td>
                          <span
                            className={`status ${activity.state}`}
                          >
                            {
                              activity.state
                            }
                          </span>
                        </td>

                        <td>
                          {formatDuration(
                            activity.durationSeconds
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="pagination">
              <button
                onClick={() =>
                  setActivityPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1
                      )
                  )
                }
                disabled={
                  activityPage === 1
                }
              >
                ← Previous
              </button>

              <span>
                Page{" "}
                <strong>
                  {activityPage}
                </strong>{" "}
                of{" "}
                <strong>
                  {
                    activityTotalPages
                  }
                </strong>
              </span>

              <button
                onClick={() =>
                  setActivityPage(
                    (page) =>
                      Math.min(
                        activityTotalPages,
                        page + 1
                      )
                  )
                }
                disabled={
                  activityPage >=
                  activityTotalPages
                }
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

/**
 * Summary card.
 */
function Card({
  name,
  value,
}: {
  name: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <span>
        {name}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

export default App;