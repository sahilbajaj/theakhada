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
