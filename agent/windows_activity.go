//go:build windows

package main

import (
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32 = windows.NewLazySystemDLL("user32.dll")

	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	getForegroundWindow = user32.NewProc(
		"GetForegroundWindow",
	)

	getWindowTextW = user32.NewProc(
		"GetWindowTextW",
	)

	getWindowTextLengthW = user32.NewProc(
		"GetWindowTextLengthW",
	)

	getWindowThreadProcessID = user32.NewProc(
		"GetWindowThreadProcessId",
	)

	getLastInputInfo = user32.NewProc(
		"GetLastInputInfo",
	)

	getTickCount64 = kernel32.NewProc(
		"GetTickCount64",
	)
)

type lastInputInfo struct {
	CbSize uint32
	DwTime uint32
}

// ---------------------------------------------------------
// Get foreground window
// ---------------------------------------------------------

func getActiveWindow() windows.Handle {
	ret, _, _ := getForegroundWindow.Call()

	return windows.Handle(ret)
}

// ---------------------------------------------------------
// Get window title
// ---------------------------------------------------------

func getWindowTitle(
	hwnd windows.Handle,
) string {

	if hwnd == 0 {
		return ""
	}

	length, _, _ :=
		getWindowTextLengthW.Call(
			uintptr(hwnd),
		)

	if length == 0 {
		return ""
	}

	buffer :=
		make([]uint16, length+1)

	getWindowTextW.Call(
		uintptr(hwnd),
		uintptr(
			unsafe.Pointer(
				&buffer[0],
			),
		),
		length+1,
	)

	return strings.TrimSpace(
		windows.UTF16ToString(
			buffer,
		),
	)
}

// ---------------------------------------------------------
// Get process ID
// ---------------------------------------------------------

func getProcessID(
	hwnd windows.Handle,
) uint32 {

	if hwnd == 0 {
		return 0
	}

	var processID uint32

	getWindowThreadProcessID.Call(
		uintptr(hwnd),
		uintptr(
			unsafe.Pointer(
				&processID,
			),
		),
	)

	return processID
}

// ---------------------------------------------------------
// Get process name
// ---------------------------------------------------------

func getProcessName(
	pid uint32,
) string {

	if pid == 0 {
		return ""
	}

	handle, err :=
		windows.OpenProcess(
			windows.PROCESS_QUERY_LIMITED_INFORMATION,
			false,
			pid,
		)

	if err != nil {
		return ""
	}

	defer windows.CloseHandle(handle)

	buffer :=
		make([]uint16, windows.MAX_PATH)

	size :=
		uint32(len(buffer))

	err =
		windows.QueryFullProcessImageName(
			handle,
			0,
			&buffer[0],
			&size,
		)

	if err != nil {
		return ""
	}

	fullPath :=
		windows.UTF16ToString(
			buffer[:size],
		)

	return filepath.Base(fullPath)
}

// ---------------------------------------------------------
// Get idle duration
// ---------------------------------------------------------

func getIdleDuration() time.Duration {

	info := lastInputInfo{
		CbSize: uint32(
			unsafe.Sizeof(
				lastInputInfo{},
			),
		),
	}

	ret, _, _ :=
		getLastInputInfo.Call(
			uintptr(
				unsafe.Pointer(
					&info,
				),
			),
		)

	if ret == 0 {
		return 0
	}

	currentTick, _, _ :=
		getTickCount64.Call()

	// GetLastInputInfo uses a 32-bit
	// tick counter. Compare using the
	// lower 32 bits.
	currentTick32 :=
		uint32(currentTick)

	elapsed :=
		uint32(
			currentTick32 -
				info.DwTime,
		)

	return time.Duration(
		elapsed,
	) * time.Millisecond
}

// ---------------------------------------------------------
// Determine activity state
// ---------------------------------------------------------

func getActivityState(
	idleDuration time.Duration,
) string {

	const idleThreshold =
		5 * time.Minute

	if idleDuration >=
		idleThreshold {

		return "idle"
	}

	return "active"
}

// ---------------------------------------------------------
// Get current activity
// ---------------------------------------------------------

func getCurrentActivity() Activity {

	computer :=
		getComputerInfo()

	now :=
		time.Now().UTC()

	// -----------------------------------------------
	// Foreground window
	// -----------------------------------------------

	hwnd :=
		getActiveWindow()

	// -----------------------------------------------
	// Window title
	// -----------------------------------------------

	windowTitle :=
		getWindowTitle(hwnd)

	if windowTitle == "" {
		windowTitle = "Unknown"
	}

	// -----------------------------------------------
	// Process ID
	// -----------------------------------------------

	processID :=
		getProcessID(hwnd)

	// -----------------------------------------------
	// Process name
	// -----------------------------------------------

	processName :=
		getProcessName(processID)

	application :=
		strings.TrimSuffix(
			processName,
			".exe",
		)

	if application == "" {
		application = "Unknown"
	}

	// -----------------------------------------------
	// Idle state
	// -----------------------------------------------

	idleDuration :=
		getIdleDuration()

	state :=
		getActivityState(
			idleDuration,
		)

	// -----------------------------------------------
	// Activity
	// -----------------------------------------------

	return Activity{
		DeviceID:
			computer.DeviceID,

		UserID:
			computer.UserID,

		StartedAt:
			now.Format(
				time.RFC3339,
			),

		Application:
			application,

		WindowTitle:
			windowTitle,

		State:
			state,

		DurationSeconds: 5,
	}
}