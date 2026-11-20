import { createHash } from "node:crypto";
import { canonicalSkeleton, type SkeletonNode } from "./template";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function templateHash(skeleton: SkeletonNode): string {
  return sha256(canonicalSkeleton(skeleton));
}

/**
 * Issue fingerprint, exactly as spec §6: sha256(rule_id + normalised_selector + template_hash).
 * A separator is added between parts so that different splits cannot collide. Changing this
 * splits or merges existing issues — record a decision first (CLAUDE.md).
 */
export function issueFingerprint(
  ruleId: string,
  normalisedSelector: string,
  template: string,
): string {
  return sha256(`${ruleId}\n${normalisedSelector}\n${template}`);
}
