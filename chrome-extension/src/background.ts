
/// <reference types="chrome" />
let currentTabId: number | null = null;
let currentUrl: string | null = null;
let currentTitle: string | null = null;
let startedAt: number | null = null;

// Start tracking the current tab
async function startActivity() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  const tab = tabs[0];

  if (!tab?.id || !tab.url) {
    return;
  }

  currentTabId = tab.id;
  currentUrl = tab.url;
  currentTitle = tab.title ?? "";
  startedAt = Date.now();

  console.log("Activity started:", {
    tabId: currentTabId,
    url: currentUrl,
    title: currentTitle,
  });
}

// Stop tracking the current tab
async function stopActivity() {
  if (!startedAt || !currentUrl) {
    return;
  }

  const durationSeconds = Math.floor(
    (Date.now() - startedAt) / 1000
  );

  console.log("Activity stopped:", {
    url: currentUrl,
    title: currentTitle,
    durationSeconds,
  });

  startedAt = null;
  currentUrl = null;
  currentTitle = null;
  currentTabId = null;
}


// ========================================
// TAB CHANGED
// ========================================

chrome.tabs.onActivated.addListener(async () => {
  await stopActivity();
  await startActivity();
});


// ========================================
// URL CHANGED
// ========================================

chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {
    if (tabId !== currentTabId) {
      return;
    }

    if (changeInfo.url) {
      await stopActivity();

      if (tab.active) {
        await startActivity();
      }
    }
  }
);

chrome.idle.setDetectionInterval(60);

chrome.idle.onStateChanged.addListener(async (state) => {
  console.log("Browser state:", state);

  if (state === "active") {
    await startActivity();
  } else {
    await stopActivity();
  }
});