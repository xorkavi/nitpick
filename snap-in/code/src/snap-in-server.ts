import "dotenv/config";
import express from "express";
import { functionFactory } from "./function-factory";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

function wrapWithRuntime(rawPayload: any): any {
  return {
    context: {
      secrets: { service_account_token: process.env.DEVREV_PAT },
      dev_oid: process.env.SERVICE_ACCOUNT_ID || "local-test-bot",
    },
    execution_metadata: {
      devrev_endpoint: "https://api.devrev.ai",
      event_type: rawPayload.event_type || "work_created",
    },
    input_data: {
      keyrings: { circleci_token: process.env.CIRCLECI_TOKEN },
      global_values: {
        circleci_project_slug: process.env.CIRCLECI_PROJECT_SLUG,
        circleci_branch: process.env.CIRCLECI_BRANCH || "main",
      },
    },
    payload: rawPayload.payload || rawPayload,
  };
}

app.post("/handle/async", async (req, res) => {
  console.log("\n[snap-in-server] -- incoming event ──────────────────");

  const raw = Array.isArray(req.body) ? req.body : [req.body];
  const events = raw.map((e) =>
    e.context?.secrets ? e : wrapWithRuntime(e)
  );

  for (const event of events) {
    console.log("[snap-in-server] event_type:", event.execution_metadata?.event_type);
    console.log("[snap-in-server] payload:", JSON.stringify(event.payload, null, 2));
  }

  try {
    await functionFactory.handle_nitpick_event(events);
    console.log("[snap-in-server] -- done ─────────────────────────────\n");
    res.json({ success: true });
  } catch (err) {
    console.error("[snap-in-server] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.post("/handle/sync", (_req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`[snap-in-server] listening on http://localhost:${PORT}`);
  console.log(`  POST /handle/async  — async function invocations`);
  console.log(`  POST /handle/sync   — sync invocations`);
  console.log(`\nTest with:`);
  console.log(`  curl -X POST http://localhost:${PORT}/handle/async -H "Content-Type: application/json" -d @test/fixtures/work_created.json`);
});
