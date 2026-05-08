import type { ValidationResult } from "../types";

export function validateIssue(work: any): ValidationResult {
  // (a) Has "nitpicked" tag
  const hasTag = work.tags?.some((t: any) =>
    t.tag?.name === "nitpicked" || t.name === "nitpicked"
  );
  if (!hasTag) return { valid: false, reason: "Missing nitpicked tag" };

  // (b) Body contains "### Code identifiers" section
  const body: string = work.body || "";
  if (!body.includes("### Code identifiers")) {
    return { valid: false, reason: "Missing Code identifiers section" };
  }

  // (c) Has screenshot artifacts OR inline images in body
  const hasArtifacts = (work.artifacts?.length ?? 0) > 0;
  if (!hasArtifacts) {
    const hasInlineImages = /!\[.*?\]\(https?:\/\/.*?\)/.test(body);
    if (!hasInlineImages) {
      return { valid: false, reason: "No screenshot artifacts" };
    }
  }

  return { valid: true };
}
