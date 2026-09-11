import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Args {
  /** Profile whose photo is being changed. */
  profileId: string;
  file: File;
}

export function useAvatarUpload() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ profileId, file }: Args) => {
      if (!supabase) throw new Error("Not connected");
      if (!user) throw new Error("Please sign in first");
      if (!ALLOWED.includes(file.type)) throw new Error("Please choose a JPG, PNG, WEBP or GIF image");
      if (file.size > MAX_BYTES) throw new Error("Image is too large (max 5 MB)");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${profileId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const isSelf = profile?.id === profileId;
      const { error: rpcError } = isSelf
        ? await supabase.rpc("set_my_avatar" as never, { p_url: publicUrl } as never)
        : await supabase.rpc("set_member_avatar" as never, {
            p_profile_id: profileId,
            p_url: publicUrl,
          } as never);
      if (rpcError) throw rpcError;

      return publicUrl;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      void queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}
