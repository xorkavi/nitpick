import "dotenv/config";
import express from "express";
import { functionFactory } from "./function-factory";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

app.post("/handle/async", async (req, res) => {
  console.log("\n[snap-in-server] -- incoming event ──────────────────");

  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const event of events) {
    const keyrings = event.input_data?.keyrings ?? {};
    console.log("[snap-in-server] keyrings received:", Object.keys(keyrings));
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
});
