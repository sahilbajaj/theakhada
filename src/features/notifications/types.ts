export type NotificationKind = "match_created" | "match_finalized" | "match_reopened";

export interface NotificationItem {
  id: string;
  match_id: string | null;
  kind: NotificationKind;
  actor_profile_id: string | null;
  actor_full_name: string | null;
  actor_nickname: string | null;
  actor_avatar_url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}
