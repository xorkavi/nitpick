import type { NitpickMode } from "../types";
import { getWork } from "./devrev-api";

export async function detectMode(
  token: string,
  endpoint: string,
  workId: string
): Promise<NitpickMode> {
  const work = await getWork(token, endpoint, workId);
  const stage = work?.custom_fields?.nitpick_stage;

  switch (stage) {
    case "Awaiting choice":
      return "fix";       // User replied with their choice
    case "In review":
    case "Revising":
      return "revision";  // User wants changes to existing PR
    default:
      return "analysis";  // Fresh issue or unknown state
  }
}
