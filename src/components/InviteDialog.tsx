import { useState, type FormEvent } from "react";
import { Copy, Link, UserPlus } from "lucide-react";
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
import type { MemberRole } from "@/types/club";

const inviteRoles: MemberRole[] = ["admin", "coach", "player", "guest"];

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("player");
  const [inviteUrl, setInviteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setInviteUrl("");
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase!.rpc("create_invite" as never, {
        p_email: email,
        p_role: role,
        p_expires_at: expiresAt,
        p_base_url: window.location.origin,
      } as never);
      if (error) throw error;
      const nextUrl = (data as { invite_url: string }[] | null)?.[0]?.invite_url;
      if (!nextUrl) throw new Error("Invite link was not returned");
      setInviteUrl(nextUrl);
      toast.success("Invite created");
    } catch (error) {
      toast.error("Could not create invite", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create invite</DialogTitle>
          <DialogDescription>Generate a link for one email address. The invite expires in 7 days.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={createInvite}>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inviteRoles.map((item) => (
                  <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <Link className="mr-2 h-4 w-4" />
            Create link
          </Button>
        </form>

        {inviteUrl ? (
          <div className="grid gap-2">
            <Label htmlFor="invite-url">Invite link</Label>
            <Textarea id="invite-url" readOnly value={inviteUrl} />
            <Button variant="outline" onClick={() => void copyInvite()}>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
