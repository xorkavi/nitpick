import type { Config } from "../../types";
import { validateIssue } from "../../lib/validation";
import { triggerPipeline } from "../../lib/circleci-api";
import { postComment, updateWork, getWork, listTimeline } from "../../lib/devrev-api";
import { detectMode } from "../../lib/mode-detection";

const MAX_RUNS = 5; // D-29: per-issue cap

export const run = async (events: any[]) => {
  for (const event of events) {
    try {
      const serviceAccountToken = event.context?.secrets?.service_account_token;
      const serviceAccountId = event.context?.dev_oid;
      const devrevEndpoint = event.execution_metadata?.devrev_endpoint || "https://api.devrev.ai";
      const keyrings = event.input_data?.keyrings;
      const globalValues = event.input_data?.global_values;

      const circleciToken = keyrings?.circleci_token as string;
      const projectSlug = globalValues?.circleci_project_slug as string;
      const branch = globalValues?.circleci_branch || "main";

      if (!serviceAccountToken || !circleciToken || !projectSlug) {
        console.error("[nitpick] Missing required configuration:", {
          hasToken: !!serviceAccountToken,
          hasCircleci: !!circleciToken,
          hasSlug: !!projectSlug,
        });
        continue;
      }

      const config: Config = {
        serviceAccountToken,
        serviceAccountId: serviceAccountId || "",
        circleciToken,
        projectSlug,
        branch,
        devrevEndpoint,
      };

      const eventType = event.execution_metadata?.event_type;

      if (eventType === "work_created") {
        await handleWorkCreated(event.payload, config);
      } else if (eventType === "timeline_entry_created") {
        await handleCommentCreated(event.payload, config);
      } else {
        console.log(`[nitpick] Ignoring event type: ${eventType}`);
      }
    } catch (err) {
      console.error("[nitpick] Error:", err instanceof Error ? err.message : String(err));
    }
  }
};

async function handleWorkCreated(payload: any, config: Config): Promise<void> {
  const work = payload.work_created?.work;
  if (!work || work.type !== "issue") return;

  // D-05: Validate issue
  const validation = validateIssue(work);
  if (!validation.valid) {
    // D-06: Post rejection comment and remove tag
    await postComment(
      config.serviceAccountToken,
      config.devrevEndpoint,
      work.id,
      "This doesn't look like it was filed through the Nitpick extension. Was the nitpicked tag added by mistake? Removing it for now."
    );
    // Remove nitpicked tag: fetch current tags, filter, set remaining
    const currentTags = (work.tags || [])
      .filter((t: any) => (t.tag?.name || t.name) !== "nitpicked")
      .map((t: any) => t.tag?.id || t.id);
    if (currentTags.length > 0 || work.tags?.length > 0) {
      await updateWork(config.serviceAccountToken, config.devrevEndpoint, work.id, {
        tags: { set: currentTags },
      });
    }
    return;
  }

  // D-19: Post pickup message
  await postComment(
    config.serviceAccountToken,
    config.devrevEndpoint,
    work.id,
    "\u{1f50d} Nitpick Bot is looking into this... will post fix options soon"
  );

  // D-32: Transition to in_development + set stage to Analyzing
  await updateWork(config.serviceAccountToken, config.devrevEndpoint, work.id, {
    stage: "in_development",
    customFields: { nitpick_stage: "Analyzing" },
  }).catch((e) => console.warn("[nitpick] Stage update failed (non-fatal):", e.message));

  // D-42: Trigger analysis pipeline
  await triggerPipeline(config.circleciToken, config.projectSlug, config.branch, {
    nitpick_issue_id: work.display_id,
    nitpick_mode: "analysis",
  });
}

async function handleCommentCreated(payload: any, config: Config): Promise<void> {
  const entry = payload.timeline_entry_created?.entry;
  if (!entry) return;

  // D-09: Loop guard -- ignore own comments
  if (entry.created_by?.id === config.serviceAccountId) return;

  // Only process comments on work items (issues)
  const objectId = entry.object;
  if (!objectId) return;

  // Check the work item is still nitpick-tagged
  const work = await getWork(config.serviceAccountToken, config.devrevEndpoint, objectId);
  if (!work) return;

  const hasTag = work.tags?.some((t: any) =>
    t.tag?.name === "nitpicked" || t.name === "nitpicked"
  );
  if (!hasTag) return;

  // D-29: Check run cap (count bot comments as proxy for runs)
  const timeline = await listTimeline(config.serviceAccountToken, config.devrevEndpoint, objectId);
  const botComments = timeline.filter(
    (e) => e.created_by?.id === config.serviceAccountId
  );
  // Each run produces at least one bot comment; cap at MAX_RUNS triggers
  // Count "looking into" + "Working on" messages as run starts
  const runStarts = botComments.filter(
    (e) => e.body?.includes("looking into") || e.body?.includes("Working on it")
  );
  if (runStarts.length >= MAX_RUNS) {
    console.log(`[nitpick] Max runs (${MAX_RUNS}) reached for ${objectId}. Skipping.`);
    return;
  }

  // D-10: Check for "retry" / "try again" keywords (re-trigger failed run)
  const commentBody: string = entry.body || "";
  const isRetry = /\b(retry|try again)\b/i.test(commentBody);

  // D-41: Determine mode from stage + history
  const mode = await detectMode(config.serviceAccountToken, config.devrevEndpoint, objectId);

  // Update stage based on mode
  const stageMap: Record<string, string> = {
    analysis: "Analyzing",
    fix: "Fixing",
    revision: "Revising",
  };
  await updateWork(config.serviceAccountToken, config.devrevEndpoint, objectId, {
    customFields: { nitpick_stage: stageMap[mode] || "Analyzing" },
  }).catch((e) => console.warn("[nitpick] Stage update failed (non-fatal):", e.message));

  // D-43: Trigger pipeline (same mechanism for creation and comment re-runs)
  await triggerPipeline(config.circleciToken, config.projectSlug, config.branch, {
    nitpick_issue_id: work.display_id,
    nitpick_mode: isRetry ? "analysis" : mode,
  });
}

export default run;
