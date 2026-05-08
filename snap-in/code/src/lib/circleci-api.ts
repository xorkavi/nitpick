export async function triggerPipeline(
  token: string,
  projectSlug: string,
  branch: string,
  parameters: { nitpick_issue_id: string; nitpick_mode: string }
): Promise<void> {
  const response = await fetch(
    `https://circleci.com/api/v2/project/${projectSlug}/pipeline`,
    {
      method: "POST",
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branch, parameters }),
    }
  );
  if (!response.ok) {
    throw new Error(`CircleCI trigger failed: ${response.status} ${await response.text()}`);
  }
}
