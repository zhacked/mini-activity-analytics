# Mini Activity Analytics Platform

 Mini ActivTrak-style take-home implementation by Fernando Siapco III.

## Architecture

The system is designed as a local-first activity analytics platform. The Windows agent collects desktop activity, the Chrome extension collects browser activity, the backend stores and exposes the data through a local REST API, and the React dashboard visualizes the activity.


### Components

* **Windows Agent** — Go application that monitors foreground application activity and active/idle state.
* **Chrome Extension** — Collects browser tab activity such as the current website and page title.
* **Backend API** — Node.js, TypeScript, and Express REST API.
* **SQLite** — Local database for activity history.
* **Dashboard** — React, TypeScript, and Vite frontend.

## Local System Example

The application can run entirely on the local machine without requiring a cloud service.

Sample Screenshot of local Dashboard

<img width="1068" height="1882" alt="image" src="https://github.com/user-attachments/assets/b73e6d60-a336-4bb5-97c4-404e4a4dfc5e" />


Example local flow:

```text
Windows Agent
      │
      │ POST activity
      ▼
http://localhost:4000
      │
      ├── SQLite
      │
      └── REST API
              │
              ▼
      http://localhost:5173
              │
              ▼
       React Dashboard
```

The Chrome extension follows the same local architecture and sends browser activity to the backend API.

Sample Screenshot of Chrome Extension

<img width="1065" height="519" alt="image" src="https://github.com/user-attachments/assets/ebc79af5-aed3-429d-b8c2-19e53e2cfca7" />


## Chrome Extension Setup

The Chrome extension is included in the project and can be loaded locally using Chrome's Developer Mode.

### 1. Install the backend

```bash
cd backend
npm install
npm run dev
```

Backend:

```text
http://localhost:4000
```

### 2. Build the Chrome extension

Open a new terminal:

```bash
cd chrome-extension
npm install
npm run build
```

This generates the extension build files inside:

```text
chrome-extension/dist
```

### 3. Load the extension in Chrome

Open:

```text
chrome://extensions
```

Then:

1. Enable **Developer mode**.
2. Click **Load unpacked**.
3. Select:

```text
chrome-extension/dist
```

4. The extension should appear in the installed extensions list.
5. Pin the extension if you want quick access from the Chrome toolbar.

![Chrome Extension Setup](docs/chrome-extension.png)

### 4. Test the extension

Start the backend first:

```bash
cd backend
npm run dev
```

Then load the extension in Chrome.

Open different websites and switch between tabs.

The extension should collect browser activity and send it to the local backend.

Example:

```text
Chrome
 ├── Google
 ├── GitHub
 ├── YouTube
 └── localhost:5173
```

The backend receives the activity and stores it in SQLite.

The dashboard can then display the collected activity alongside desktop-agent activity.

### Chrome Extension Development

If changes are made to the extension source code, rebuild it:

```bash
npm run build
```

Then return to:

```text
chrome://extensions
```

and click **Reload** on the extension.

If the extension is not working:

1. Check that the backend is running.
2. Confirm that `chrome-extension/dist/manifest.json` exists.
3. Confirm that the correct `dist` directory was selected in Chrome.
4. Reload the extension from `chrome://extensions`.
5. Open the extension's service worker console and check for errors.
6. Verify that the API URL points to:

```text
http://localhost:4000
```

## Desktop Agent Setup

Requires Windows + Go 1.22+.

```powershell
cd agent
go mod tidy
go build -o activity-agent.exe .
.\activity-agent.exe
```

Or simply run:

```text
activity-agent.exe
```

Controls:

```text
p = pause/resume
q = quit
```

The agent collects:

* Foreground application
* Window title
* Active/idle state
* Timestamp
* Duration
* Device ID
* User ID

The agent does **not**:

* Keylog
* Take screenshots
* Monitor files
* Import browser history
* Access camera
* Access microphone
* Run stealthily

## Backend

```bash
cd backend
npm install
npm run dev
```

API:

```text
http://localhost:4000
```

## Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard:

```text
http://localhost:5173
```

## Complete Local Startup

Run the following components:

### Terminal 1 — Backend

```bash
cd backend
npm install
npm run dev
```

### Terminal 2 — Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### Terminal 3 — Windows Agent

```powershell
cd agent
go mod tidy
go build -o activity-agent.exe .
.\activity-agent.exe
```

### Chrome

Open:

```text
chrome://extensions
```

Enable **Developer mode** and load:

```text
chrome-extension/dist
```

The complete system should then look like:

```text
                 LOCAL MACHINE
┌─────────────────────────────────────────────┐
│                                             │
│  Windows Agent          Chrome Extension   │
│      Go                       │             │
│       │                       │             │
│       └──────────┬────────────┘             │
│                  │                          │
│                  ▼                          │
│        Node.js + Express API               │
│             localhost:4000                 │
│                  │                          │
│                  ▼                          │
│                SQLite                       │
│                  │                          │
│                  ▼                          │
│        React + TypeScript + Vite           │
│             localhost:5173                 │
│                                             │
└─────────────────────────────────────────────┘
```

See `AI_USAGE.md` for the AI build transcript and engineering decision log.
