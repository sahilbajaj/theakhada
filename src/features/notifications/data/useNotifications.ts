import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem } from "@/features/notifications/types";

const LIST_KEY = ["notifications", "list"] as const;
const COUNT_KEY = ["notifications", "unread-count"] as const;

export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: [...LIST_KEY, limit],
    enabled: Boolean(supabase),
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase!.rpc("list_notifications" as never, { p_limit: limit } as never);
      if (error) throw error;
      return (data as NotificationItem[] | null) ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: COUNT_KEY,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase!.rpc("unread_notifications_count" as never);
      if (error) throw error;
      return typeof data === "number" ? data : 0;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase!.rpc("mark_notification_read" as never, { p_id: id } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      await queryClient.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase!.rpc("mark_all_notifications_read" as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      await queryClient.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}
