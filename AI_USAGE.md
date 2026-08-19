# AI Usage Log

## Initial Request

Build a local **Mini Activity Analytics Platform** following the required implementation order:

1. Desktop activity agent
2. Node.js + TypeScript backend API
3. React + TypeScript dashboard
4. Optional Chrome extension

The goal was to create a small, local-first ActivTrak-style system that demonstrates the complete flow from activity collection to data ingestion and dashboard visualization.

## Architecture Decisions

### Desktop Agent — Go + Windows APIs

Go was selected for the desktop agent because it produces a lightweight native executable, has low runtime overhead, and integrates well with Windows APIs.

The agent is responsible for:

* Detecting the current foreground application and window.
* Tracking active and idle states.
* Recording activity timestamps and durations.
* Sending periodic heartbeat/activity data to the backend.
* Identifying the local device and user.
* Running as a lightweight local process.

### Backend — Node.js + TypeScript + Express + SQLite

Node.js with TypeScript and Express was selected for the backend because it provides a simple, maintainable API layer while TypeScript improves type safety and code reliability.

SQLite was selected for local development because it requires no separate database server and keeps the project easy to set up and run.

The backend is structured so that SQLite can later be replaced with PostgreSQL with minimal impact on the application architecture.

The backend is responsible for:

* Receiving activity events from the desktop agent.
* Storing activity and heartbeat data.
* Providing dashboard APIs.
* Calculating activity summaries.
* Tracking devices and last-seen status.
* Supporting future authentication and authorization.
* Providing a clear separation between API, business logic, and persistence concerns.

### Dashboard — React + TypeScript + Vite

React with TypeScript and Vite was selected for the dashboard because it provides a fast development workflow, component-based architecture, and strong TypeScript support.

The dashboard is responsible for:

* Displaying registered devices.
* Showing active and idle activity.
* Displaying application usage.
* Presenting activity durations and summaries.
* Refreshing data from the backend API.
* Providing a simple foundation for future analytics features.

### Optional Chrome Extension

A Chrome extension was considered as an optional enhancement for browser-specific activity context.

The extension is designed to complement the desktop agent rather than replace it. It can provide additional browser context while keeping the collection scope limited to the requirements of the assignment.

## Privacy and Data Collection Decisions

Privacy was treated as a core design requirement rather than an afterthought.

The system only collects information necessary for basic activity analytics:

* Foreground application name
* Foreground window title
* Active/idle state
* Activity start timestamp
* Activity duration
* Device identifier
* User identifier
* Heartbeat and last-seen information

The implementation intentionally **does not** collect:

* Keystrokes or keylogging data
* Screenshots
* Files or file contents
* Browser history imports
* Camera or microphone data
* Passwords or credentials
* Clipboard contents
* Hidden or stealth tracking information

The agent should operate transparently and should provide predictable pause/quit behavior.

## AI-Assisted Development Approach

AI tools were used as development assistants throughout the implementation.

AI assistance was primarily used for:

* Exploring architecture options.
* Generating initial implementation scaffolding.
* Reviewing and refactoring code.
* Troubleshooting build and runtime errors.
* Improving API structure.
* Generating TypeScript and Go implementation ideas.
* Identifying potential edge cases.
* Improving documentation.
* Suggesting testing strategies.

Generated code was reviewed and adapted rather than blindly accepted. Implementation decisions were validated against the assignment requirements and the intended local-first architecture.

## Engineering Review and Validation

The following areas require human review and validation before considering the implementation production-ready:

* [ ] Verify Windows API behavior across supported Windows versions.
* [ ] Confirm foreground application and window detection accuracy.
* [ ] Test active/idle state transitions.
* [ ] Test agent pause behavior.
* [ ] Test agent quit/shutdown behavior.
* [ ] Verify heartbeat reliability and retry behavior.
* [ ] Test backend activity ingestion.
* [ ] Verify dashboard data refresh and error handling.
* [ ] Test behavior when the backend is unavailable.
* [ ] Review database indexing and query performance.
* [ ] Review API validation and error handling.
* [ ] Review security and authentication requirements.
* [ ] Add automated integration tests.
* [ ] Add end-to-end tests for the main agent → API → dashboard flow.
* [ ] Review privacy implications before production deployment.

## Future Improvements

With additional development time, the platform could be extended with:

* PostgreSQL support for production deployments.
* Authentication and role-based access control.
* Configurable heartbeat intervals.
* Offline event queuing and synchronization.
* More detailed application usage analytics.
* Historical activity reports.
* Daily and weekly productivity summaries.
* Better device management.
* Automated agent installation and updates.
* Comprehensive integration and E2E test coverage.
* Improved observability and structured logging.

## Final Engineering Perspective

The implementation prioritizes **simplicity, privacy, maintainability, and extensibility**.

The architecture keeps the desktop agent, backend, database, and dashboard independently replaceable while maintaining a straightforward data flow:

**Windows Agent → Backend API → SQLite → React Dashboard**

This provides a practical foundation for a local-first activity analytics platform without introducing unnecessary infrastructure or invasive monitoring capabilities.
