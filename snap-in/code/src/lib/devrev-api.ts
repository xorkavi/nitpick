import type { TimelineEntry } from "../types";

export async function postComment(
  token: string,
  endpoint: string,
  objectId: string,
  body: string
): Promise<void> {
  const response = await fetch(`${endpoint}/timeline-entries.create`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "timeline_comment",
      object: objectId,
      body,
      visibility: "external",
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.status} ${await response.text()}`);
  }
}

export async function updateWork(
  token: string,
  endpoint: string,
  workId: string,
  updates: { stage?: string; customFields?: Record<string, string>; tags?: { set: string[] } }
): Promise<void> {
  const body: any = { id: workId };
  if (updates.stage) {
    body.stage = { name: updates.stage };
  }
  if (updates.customFields) {
    body.custom_fields = updates.customFields;
  }
  if (updates.tags) {
    body.tags = updates.tags;
  }
  const response = await fetch(`${endpoint}/works.update`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update work: ${response.status} ${await response.text()}`);
  }
}

export async function listTimeline(
  token: string,
  endpoint: string,
  objectId: string
): Promise<TimelineEntry[]> {
  const response = await fetch(
    `${endpoint}/timeline-entries.list?object=${objectId}`,
    { headers: { Authorization: token } }
  );
  if (!response.ok) {
    throw new Error(`Failed to list timeline: ${response.status}`);
  }
  const data = await response.json();
  return data.timeline_entries || [];
}

export async function getWork(
  token: string,
  endpoint: string,
  workId: string
): Promise<any> {
  const response = await fetch(
    `${endpoint}/works.get?id=${workId}`,
    { headers: { Authorization: token } }
  );
  if (!response.ok) {
    throw new Error(`Failed to get work: ${response.status}`);
  }
  const data = await response.json();
  return data.work;
}
