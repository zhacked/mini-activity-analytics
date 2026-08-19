# Mini Activity Analytics Platform

Local-first Mni ActivTrak-style take-home implementation.


## Stack
- Desktop agent: Go + Windows APIs
    - I use Go because it is lightweight, fast, and well-suited for building a local Windows agent that can run in the background, monitor user activity efficiently, and communicate with the dashboard through a simple API.
- Backend: Node.js + TypeScript + Express + SQLite
    - I use Node.js + TypeScript + Express + SQLite for the backend because it is quick to develop, type-safe, lightweight, and easy to maintain, while SQLite provides simple local data storage without requiring a separate database server.
- Dashboard: React + TypeScript + Vite
    - React + TypeScript + Vite is a good choice because React makes it easy to build a responsive dashboard, TypeScript provides type safety and reduces bugs, and Vite gives fast development and builds with minimal configuration.

## installion Process

### Backend
```bash
cd backend
npm install
npm run dev
```
API: http://localhost:4000

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```
Dashboard: http://localhost:5173

### Windows Agent
Requires Windows + Go 1.22+.
```powershell
cd agent
go mod tidy
go build -o activity-agent.exe .
.\activity-agent.exe
```
Controls: `p` pause/resume, `q` quit.
or just click `activity-agent`

The agent collects foreground application, window title, active/idle state, timestamps, duration, device/user ID and sends activity to the local API. It does not keylog, screenshot, monitor files, import browser history, access camera/microphone, or run stealthily.

See AI_USAGE.md for the AI build transcript/decision log.

