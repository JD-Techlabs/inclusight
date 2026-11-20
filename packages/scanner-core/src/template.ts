/** Element skeleton captured in the browser: tag names and landmark roles only. */
export type SkeletonNode = { tag: string; role?: string; children: SkeletonNode[] };

/** Elements that are (or usually are) landmarks, and explicit landmark roles. */
export const LANDMARK_TAGS = ["header", "nav", "main", "footer", "aside", "form", "search"];
export const LANDMARK_ROLES = [
  "banner",
  "navigation",
  "main",
  "contentinfo",
  "complementary",
  "search",
  "form",
  "region",
];

function isLandmark(node: SkeletonNode): boolean {
  return (
    LANDMARK_TAGS.includes(node.tag) ||
    (node.role !== undefined && LANDMARK_ROLES.includes(node.role))
  );
}

/** Landmark descendants of `node`, keeping only landmark-to-landmark nesting. */
function landmarkChildren(node: SkeletonNode): SkeletonNode[] {
  const result: SkeletonNode[] = [];
  for (const child of node.children) {
    if (isLandmark(child)) result.push({ ...child, children: landmarkChildren(child) });
    else result.push(...landmarkChildren(child));
  }
  return result;
}

function serialise(node: SkeletonNode): string {
  const label = node.role ? `${node.tag}[${node.role}]` : node.tag;
  const parts: string[] = [];
  for (const child of node.children) {
    const text = serialise(child);
    const previous = parts[parts.length - 1];
    if (previous === text || previous === `${text}+`) parts[parts.length - 1] = `${text}+`;
    else parts.push(text);
  }
  return parts.length > 0 ? `${label}(${parts.join(",")})` : label;
}

/**
 * Canonical string for a page's template (spec §6 template_hash input): the landmark structure
 * only — which landmarks exist and how they nest — ignoring text, attributes and all other
 * elements. Content changes inside a landmark therefore keep the page in its template, so
 * issue fingerprints stay stable when a page changes. See docs/DECISIONS.md.
 */
export function canonicalSkeleton(root: SkeletonNode): string {
  return serialise({ tag: root.tag, children: landmarkChildren(root) });
}
