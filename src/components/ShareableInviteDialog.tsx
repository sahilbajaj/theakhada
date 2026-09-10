import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link as LinkIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Scope = "club" | "app";
type Role = "coach" | "player" | "guest";

const roles: Role[] = ["player", "coach", "guest"];

export function ShareableInviteDialog() {
  const { clubId, isSuperadmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("club");
  const [role, setRole] = useState<Role>("player");
  const [days, setDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setInviteUrl("");
    setScope("club");
    setRole("player");
    setDays("30");
    setMaxUses("");
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setInviteUrl("");
    try {
      const parsedDays = Math.max(1, Math.min(365, Number(days) || 30));
      const parsedMax = maxUses.trim().length ? Math.max(1, Number(maxUses)) : null;
      if (parsedMax != null && Number.isNaN(parsedMax)) throw new Error("Max uses must be a number");
      const expiresAt = new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000).toISOString();
      const targetClubId = scope === "app" ? null : clubId;
      const { data, error } = await supabase!.rpc("create_shareable_invite" as never, {
        p_club_id: targetClubId,
        p_role: role,
        p_expires_at: expiresAt,
        p_max_uses: parsedMax,
        p_base_url: window.location.origin,
      } as never);
      if (error) throw error;
      const nextUrl = (data as { invite_url: string }[] | null)?.[0]?.invite_url;
      if (!nextUrl) throw new Error("Link was not returned");
      setInviteUrl(nextUrl);
      await queryClient.invalidateQueries({ queryKey: ["shareable-invites"] });
      toast.success("Shareable link created");
    } catch (error) {
      toast.error("Could not create link", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copied");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Shareable link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create shareable link</DialogTitle>
          <DialogDescription>
            Anyone with this link can sign up and request to join. No email needed on the link.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={create}>
          {isSuperadmin ? (
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="club">This club</SelectItem>
                  <SelectItem value="app">App-wide (user picks club)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((item) => (
                  <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="link-days">Expires in (days)</Label>
              <Input id="link-days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link-max">Max uses (optional)</Label>
              <Input id="link-max" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Create link
          </Button>
        </form>

        {inviteUrl ? (
          <div className="grid gap-2">
            <Label htmlFor="shareable-url">Link</Label>
            <Textarea id="shareable-url" readOnly value={inviteUrl} />
            <Button variant="outline" onClick={() => void copy()}>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
