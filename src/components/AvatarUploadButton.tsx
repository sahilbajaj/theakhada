import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

interface Props {
  profileId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary" | "default";
}

export function AvatarUploadButton({ profileId, label = "Change photo", size = "sm", variant = "outline" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useAvatarUpload();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          upload.mutate(
            { profileId, file },
            {
              onSuccess: () => toast.success("Photo updated"),
              onError: (error) =>
                toast.error("Could not upload photo", {
                  description: error instanceof Error ? error.message : "Try again.",
                }),
            },
          );
        }}
      />
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Camera className="mr-2 h-4 w-4" />
        )}
        {upload.isPending ? "Uploading…" : label}
      </Button>
    </>
  );
}
