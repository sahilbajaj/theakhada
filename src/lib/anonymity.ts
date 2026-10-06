export const ANONYMOUS_NAME = "Anonymous player";

interface Viewer {
  profileId: string | null | undefined;
  role: string | null | undefined;
}

export function isHiddenFrom(
  member: { profile_id: string; is_anonymous?: boolean | null },
  viewer: Viewer,
): boolean {
  if (!member.is_anonymous) return false;
  if (viewer.profileId && viewer.profileId === member.profile_id) return false;
  if (viewer.role === "owner" || viewer.role === "admin") return false;
  return true;
}

/** Profile ids hidden from the current viewer. Kept in sync by AnonymitySync. */
let hiddenIds = new Set<string>();

export function setHiddenProfileIds(ids: Set<string>) {
  hiddenIds = ids;
}

export function isHiddenId(id: string | null | undefined): boolean {
  return Boolean(id && hiddenIds.has(id));
}

/** Returns the avatar url, or null when the profile is hidden from the viewer. */
export function visibleAvatar(id: string | null | undefined, url: string | null | undefined): string | null {
  return isHiddenId(id) ? null : url ?? null;
}
