package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"sync"
	"time"
)

type Summary struct {
	Devices       int   `json:"devices"`
	ActiveDevices int   `json:"activeDevices"`
	ActiveSeconds int64 `json:"activeSeconds"`
	IdleSeconds   int64 `json:"idleSeconds"`
}

type Application struct {
	Application string `json:"application"`
	Seconds     int64  `json:"seconds"`
	Events      int    `json:"events"`
}

type Device struct {
	DeviceID   string `json:"deviceId"`
	UserID     string `json:"userId"`
	LastSeenAt string `json:"lastSeenAt"`
	Status     string `json:"status"`
}

type Activity struct {
	ID              int64  `json:"id"`
	DeviceID        string `json:"deviceId"`
	UserID          string `json:"userId"`
	StartedAt       string `json:"startedAt"`
	Application     string `json:"application"`
	WindowTitle     string `json:"windowTitle"`
	State           string `json:"state"`
	DurationSeconds int64  `json:"durationSeconds"`
}

type Computer struct {
	DeviceID   string `json:"deviceId"`
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	OS         string `json:"os"`
	Arch       string `json:"arch"`
	Hostname   string `json:"hostname"`
	LastSeenAt string `json:"lastSeenAt"`
}

var (
	activityMutex sync.RWMutex

	activityHistory []Activity

	nextActivityID int64 = 1

	// Maximum number of activity records kept in memory.
	maxActivityHistory = 1000
)

func getComputerInfo() Computer {
	hostname, err := os.Hostname()

	if err != nil {
		hostname = "unknown-device"
	}

	currentUser, err := user.Current()

	username := "unknown-user"
	userID := "unknown-user"

	if err == nil {
		username = currentUser.Username
		userID = currentUser.Username
	}

	return Computer{
		DeviceID:   hostname,
		UserID:     userID,
		Username:   username,
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
		Hostname:   hostname,
		LastSeenAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to encode JSON response: %v", err)
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		w.Header().Set(
			"Access-Control-Allow-Origin",
			"http://localhost:5173",
		)

		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		)

		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ---------------------------------------------------------
// Activity history
// ---------------------------------------------------------

func saveActivity(activity Activity) {
	activityMutex.Lock()
	defer activityMutex.Unlock()

	// Merge with previous activity if application,
	// window title and state are the same.
	if len(activityHistory) > 0 {

		lastIndex := len(activityHistory) - 1

		last := &activityHistory[lastIndex]

		if last.DeviceID == activity.DeviceID &&
			last.UserID == activity.UserID &&
			last.Application == activity.Application &&
			last.WindowTitle == activity.WindowTitle &&
			last.State == activity.State {

			last.DurationSeconds += activity.DurationSeconds

			return
		}
	}

	activity.ID = nextActivityID
	nextActivityID++

	activityHistory = append(
		activityHistory,
		activity,
	)

	if len(activityHistory) > maxActivityHistory {

		activityHistory = activityHistory[len(activityHistory)-maxActivityHistory:]
	}
}

func getActivityHistory(limit int) []Activity {
	activityMutex.RLock()
	defer activityMutex.RUnlock()

	if limit <= 0 {
		limit = 50
	}

	if limit > len(activityHistory) {
		limit = len(activityHistory)
	}

	result := make([]Activity, 0, limit)

	for i := len(activityHistory) - 1; i >= 0 && len(result) < limit; i-- {
		result = append(result, activityHistory[i])
	}

	return result
}

// ---------------------------------------------------------
// Clear activity history
// ---------------------------------------------------------

func clearActivityHistory() int {
	activityMutex.Lock()
	defer activityMutex.Unlock()

	deleted := len(activityHistory)

	activityHistory = nil
	nextActivityID = 1

	return deleted
}
// ---------------------------------------------------------
// Application aggregation
// ---------------------------------------------------------

func getApplicationSummary() []Application {
	activityMutex.RLock()
	defer activityMutex.RUnlock()

	appMap := make(map[string]*Application)

	for _, activity := range activityHistory {

		if activity.Application == "" {
			continue
		}

		if _, exists := appMap[activity.Application]; !exists {

			appMap[activity.Application] = &Application{
				Application: activity.Application,
				Seconds:     0,
				Events:      0,
			}
		}

		appMap[activity.Application].Seconds += activity.DurationSeconds
		appMap[activity.Application].Events++
	}

	result := make([]Application, 0, len(appMap))

	for _, app := range appMap {
		result = append(result, *app)
	}

	return result
}

// ---------------------------------------------------------
// Summary aggregation
// ---------------------------------------------------------

func getDashboardSummary() Summary {
	activityMutex.RLock()
	defer activityMutex.RUnlock()

	var activeSeconds int64
	var idleSeconds int64

	for _, activity := range activityHistory {

		if activity.State == "active" {
			activeSeconds += activity.DurationSeconds
		}

		if activity.State == "idle" {
			idleSeconds += activity.DurationSeconds
		}
	}

	activeDevices := 0

	if len(activityHistory) > 0 {

		last := activityHistory[len(activityHistory)-1]

		if last.State == "active" {
			activeDevices = 1
		}
	}

	return Summary{
		Devices:       1,
		ActiveDevices: activeDevices,
		ActiveSeconds: activeSeconds,
		IdleSeconds:   idleSeconds,
	}
}

// ---------------------------------------------------------
// Activity collector
// ---------------------------------------------------------

func startActivityCollector() {

	go func() {

		ticker := time.NewTicker(5 * time.Second)

		defer ticker.Stop()

		log.Println("Activity collector started")
		log.Println("Sampling interval: 5 seconds")

		for {

			activity := getCurrentActivity()

			// Each sample represents 5 seconds.
			//
			// If the computer is active, count the
			// sample as 5 active seconds.
			//
			// If the computer is idle, count the
			// sample as 5 idle seconds.
			activity.DurationSeconds = 5

			saveActivity(activity)

			log.Printf(
				"Activity | user=%s device=%s app=%s title=%q state=%s",
				activity.UserID,
				activity.DeviceID,
				activity.Application,
				activity.WindowTitle,
				activity.State,
			)

			<-ticker.C
		}
	}()
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

func main() {

	mux := http.NewServeMux()

	// ---------------------------------------------------------
	// Health
	// ---------------------------------------------------------

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		jsonResponse(w, map[string]string{
			"status": "ok",
		})
	})

	// ---------------------------------------------------------
	// Computer
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/computer", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		jsonResponse(w, getComputerInfo())
	})

	// ---------------------------------------------------------
	// Dashboard summary
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/dashboard/summary", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		jsonResponse(
			w,
			getDashboardSummary(),
		)
	})

	// ---------------------------------------------------------
	// Dashboard applications
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/dashboard/applications", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		jsonResponse(
			w,
			getApplicationSummary(),
		)
	})

	// ---------------------------------------------------------
	// Dashboard devices
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/dashboard/devices", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		computer := getComputerInfo()

		status := "offline"

		activityHistoryData := getActivityHistory(1)

		if len(activityHistoryData) > 0 {

			last := activityHistoryData[0]

			switch last.State {

			case "active":
				status = "online"

			case "idle":
				status = "idle"
			}
		}

		jsonResponse(w, []Device{
			{
				DeviceID:   computer.DeviceID,
				UserID:     computer.UserID,
				LastSeenAt: computer.LastSeenAt,
				Status:     status,
			},
		})
	})

	// ---------------------------------------------------------
	// Recent activity / history
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/dashboard/recent", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		limit := 50

		if value := r.URL.Query().Get("limit"); value != "" {

			if parsed, err := strconv.Atoi(value); err == nil {

				if parsed > 0 && parsed <= 1000 {
					limit = parsed
				}
			}
		}

		activities := getActivityHistory(limit)

		jsonResponse(w, activities)
	})

	// ---------------------------------------------------------
	// Clear activity history
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/dashboard/activities", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodDelete {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		deleted := clearActivityHistory()

		log.Printf(
			"Activity history cleared: %d records removed",
			deleted,
		)

		jsonResponse(w, map[string]interface{}{
			"success": true,
			"message": "Activity history cleared",
			"deleted": deleted,
		})
	})

	// ---------------------------------------------------------
	// Current activity
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/activity/current", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		activity := getCurrentActivity()

		jsonResponse(w, activity)
	})

	// ---------------------------------------------------------
	// Agent ingestion
	// ---------------------------------------------------------

	mux.HandleFunc("/api/v1/ingest", func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodPost {
			http.Error(
				w,
				"method not allowed",
				http.StatusMethodNotAllowed,
			)

			return
		}

		var activity Activity

		if err := json.NewDecoder(r.Body).Decode(&activity); err != nil {

			http.Error(
				w,
				"invalid JSON",
				http.StatusBadRequest,
			)

			return
		}

		// If the agent doesn't provide these fields,
		// use the current computer information.
		computer := getComputerInfo()

		if activity.DeviceID == "" {
			activity.DeviceID = computer.DeviceID
		}

		if activity.UserID == "" {
			activity.UserID = computer.UserID
		}

		if activity.StartedAt == "" {
			activity.StartedAt =
				time.Now().UTC().Format(time.RFC3339)
		}

		if activity.DurationSeconds <= 0 {
			activity.DurationSeconds = 5
		}

		saveActivity(activity)

		log.Printf(
			"Ingested activity | user=%s device=%s app=%s title=%q state=%s duration=%ds",
			activity.UserID,
			activity.DeviceID,
			activity.Application,
			activity.WindowTitle,
			activity.State,
			activity.DurationSeconds,
		)

		jsonResponse(w, map[string]interface{}{
			"success":  true,
			"activity": activity,
		})
	})

	// ---------------------------------------------------------
	// Start activity collector
	// ---------------------------------------------------------

	startActivityCollector()

	// ---------------------------------------------------------
	// CORS
	// ---------------------------------------------------------

	handler := enableCORS(mux)

	// ---------------------------------------------------------
	// Start server
	// ---------------------------------------------------------

	log.Println("==========================================")
	log.Println("Activity Analytics API")
	log.Println("==========================================")
	log.Println("Server running on http://localhost:4000")

	computer := getComputerInfo()

	log.Printf("Device: %s", computer.DeviceID)
	log.Printf("User:   %s", computer.UserID)
	log.Printf("OS:     %s", computer.OS)
	log.Printf("Arch:   %s", computer.Arch)

	if err := http.ListenAndServe(":4000", handler); err != nil {
		log.Fatal(err)
	}
}
