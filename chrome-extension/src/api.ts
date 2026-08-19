export interface ActivityPayload {
  deviceId: string;
  userId: string;
  application: string;
  domain: string;
  url: string;
  windowTitle: string;
  state: "active" | "idle";
  startedAt: string;
  durationSeconds: number;
}

export async function sendActivity(
  activity: ActivityPayload
) {
  const response = await fetch(
    "http://localhost:4000/api/v1/activity",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(activity),
    }
  );

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status}`
    );
  }

  return response.json();
}