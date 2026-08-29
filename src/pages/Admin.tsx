import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCog, Check, Pencil, ShieldCheck, SlidersHorizontal, Trash2, UsersRound, X } from "lucide-react";
import { InviteDialog } from "@/components/InviteDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { MemberRole } from "@/types/club";

const controls = [
  { label: "Allow member self-booking", detail: "Members can reserve open courts from web or mobile.", icon: CalendarCog, enabled: true },
  { label: "Require check-in", detail: "Late arrivals remain visible in attendance queues.", icon: Bell, enabled: true },
  { label: "Coach overrides", detail: "Coaches can move lessons and update match outcomes.", icon: ShieldCheck, enabled: false },
  { label: "Visitor access", detail: "Guests can be invited into selected programs.", icon: UsersRound, enabled: true },
];

type RequestRole = Extract<MemberRole, "coach" | "player" | "guest">;

interface SignupRequest {
  id: string;
  email: string;
  full_name: string;
  requested_role: RequestRole;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface ClubInvite {
  id: string;
  email: string;
  role: MemberRole;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
}

interface ClubMember {
  profile_id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  role: MemberRole;
  rating: number | null;
  avatar_url: string | null;
  is_self: boolean;
}

interface ClubSettings {
  prefer_nicknames: boolean;
}

const assignableRoles: Exclude<MemberRole, "owner">[] = ["admin", "coach", "player", "guest"];

function MemberEditDialog({ member }: { member: ClubMember }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(member.full_name);
  const [nickname, setNickname] = useState(member.nickname ?? "");
  const [rating, setRating] = useState(member.rating != null ? String(member.rating) : "");
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url ?? "");

  useEffect(() => {
    if (open) {
      setFullName(member.full_name);
      setNickname(member.nickname ?? "");
      setRating(member.rating != null ? String(member.rating) : "");
      setAvatarUrl(member.avatar_url ?? "");
    }
  }, [open, member.full_name, member.nickname, member.rating, member.avatar_url]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedFullName = fullName.trim();
      if (!trimmedFullName.length) {
        throw new Error("Full name is required");
      }
      if (trimmedFullName !== member.full_name) {
        const { error } = await supabase!.rpc("set_member_full_name" as never, {
          p_profile_id: member.profile_id,
          p_full_name: trimmedFullName,
        } as never);
        if (error) throw error;
      }

      const trimmedNickname = nickname.trim();
      const nextNickname = trimmedNickname.length ? trimmedNickname : null;
      const currentNickname = member.nickname ?? null;

      if (nextNickname !== currentNickname) {
        const { error } = await supabase!.rpc("set_member_nickname" as never, {
          p_profile_id: member.profile_id,
          p_nickname: nextNickname,
        } as never);
        if (error) throw error;
      }

      const parsedRating = rating.trim().length ? Number(rating) : null;
      if (parsedRating != null && (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 7)) {
        throw new Error("Rating must be between 1.0 and 7.0");
      }
      if (parsedRating != null && parsedRating !== member.rating) {
        const { error } = await supabase!.rpc("set_member_rating" as never, {
          p_profile_id: member.profile_id,
          p_rating: parsedRating,
        } as never);
        if (error) throw error;
      }

      const trimmedAvatar = avatarUrl.trim();
      const nextAvatar = trimmedAvatar.length ? trimmedAvatar : null;
      const currentAvatar = member.avatar_url ?? null;
      if (nextAvatar !== currentAvatar) {
        const { error } = await supabase!.rpc("set_member_avatar" as never, {
          p_profile_id: member.profile_id,
          p_avatar_url: nextAvatar,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
      toast.success("Member updated");
      setOpen(false);
    },
    onError: (error) => toast.error("Could not save changes", { description: error instanceof Error ? error.message : "Try again." }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Edit member">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {member.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Optional short name" maxLength={40} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rating">Rating (1.0–7.0)</Label>
            <Input id="rating" type="number" min={1} max={7} step={0.1} value={rating} onChange={(event) => setRating(event.target.value)} placeholder="e.g. 3.5" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input id="avatar_url" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" />
            <p className="text-xs text-muted-foreground">Paste a link to a hosted image. Upload flow comes later.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddGuestPanel() {
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState("");

  const createGuest = useMutation({
    mutationFn: async () => {
      const trimmed = guestName.trim();
      if (!trimmed.length) throw new Error("Guest name is required");
      const { error } = await supabase!.rpc("create_guest_member" as never, { p_full_name: trimmed } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
      await queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      toast.success("Guest added");
      setGuestName("");
    },
    onError: (error) => toast.error("Could not add guest", { description: error instanceof Error ? error.message : "Try again." }),
  });

  return (
    <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold">Add guest</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guests have no login but appear in the roster, so you can add them to matches and tournaments.
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          createGuest.mutate();
        }}
      >
        <Input
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          placeholder="Guest name"
          maxLength={80}
          aria-label="Guest name"
        />
        <Button type="submit" disabled={createGuest.isPending || !guestName.trim().length}>
          <UsersRound className="mr-2 h-4 w-4" />
          Add guest
        </Button>
      </form>
    </section>
  );
}


function MemberRoleRow({ member, preferNicknames }: { member: ClubMember; preferNicknames: boolean }) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const roleMutation = useMutation({
    mutationFn: async (nextRole: MemberRole) => {
      const { error } = await supabase!.rpc("set_member_role" as never, {
        p_profile_id: member.profile_id,
        p_role: nextRole,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
      toast.success("Role updated");
    },
    onError: (error) => toast.error("Could not update role", { description: error instanceof Error ? error.message : "Try again." }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc("delete_player" as never, {
        p_profile_id: member.profile_id,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
      await queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      toast.success("Player deleted");
      setDeleteOpen(false);
    },
    onError: (error) => toast.error("Could not delete player", { description: error instanceof Error ? error.message : "Try again." }),
  });

  const roleLocked = member.role === "owner" || member.is_self;
  const canDelete = member.role !== "owner" && !member.is_self;
  const primaryName = displayName(member, { preferNicknames });
  const secondaryName = primaryName === member.full_name ? null : member.full_name;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={primaryName} /> : null}
          <AvatarFallback>{initialsFrom(primaryName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{primaryName}</p>
            {member.is_self ? <Badge variant="outline" className="shrink-0 text-[10px]">You</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {secondaryName ? `${secondaryName} · ` : ""}{member.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {member.rating != null ? member.rating.toFixed(1) : "—"}
        </Badge>
        {roleLocked ? (
          <Badge variant="secondary" className="shrink-0 capitalize">{member.role}</Badge>
        ) : (
          <Select value={member.role} onValueChange={(value) => roleMutation.mutate(value as MemberRole)} disabled={roleMutation.isPending}>
            <SelectTrigger className="h-9 w-[120px] sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((item) => (
                <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <MemberEditDialog member={member} />
        {canDelete ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete player"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {member.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their profile, match participation, notifications, and login. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function AccessRequestRow({ request }: { request: SignupRequest }) {
  const [role, setRole] = useState<RequestRole>(request.requested_role);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc("approve_signup_request" as never, {
        p_request_id: request.id,
        p_role: role,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["signup-requests"] });
      toast.success("Access approved");
    },
    onError: (error) => toast.error("Could not approve request", { description: error instanceof Error ? error.message : "Try again." }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc("reject_signup_request" as never, {
        p_request_id: request.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["signup-requests"] });
      toast.success("Access rejected");
    },
    onError: (error) => toast.error("Could not reject request", { description: error instanceof Error ? error.message : "Try again." }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{request.full_name}</h3>
          <Badge variant="status" className="shrink-0">{request.status}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.email}</p>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Select value={role} onValueChange={(value) => setRole(value as RequestRole)}>
          <SelectTrigger className="h-9 w-[120px] sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="player">Player</SelectItem>
            <SelectItem value="coach">Coach</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || rejectMutation.isPending}>
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate()} disabled={approveMutation.isPending || rejectMutation.isPending} aria-label="Reject">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { role, clubId } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "owner" || role === "admin";

  const settingsQuery = useQuery({
    queryKey: ["club-settings", clubId],
    enabled: isAdmin && Boolean(supabase) && Boolean(clubId),
    queryFn: async (): Promise<ClubSettings> => {
      const { data, error } = await supabase!
        .from("clubs" as never)
        .select("prefer_nicknames")
        .eq("id", clubId!)
        .single();
      if (error) throw error;
      return (data as ClubSettings) ?? { prefer_nicknames: true };
    },
  });
  const preferNicknames = settingsQuery.data?.prefer_nicknames ?? true;

  const preferNicknamesMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      const { error } = await supabase!.rpc("set_club_prefer_nicknames" as never, {
        p_value: nextValue,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-settings"] });
      toast.success("Preference saved");
    },
    onError: (error) => toast.error("Could not save preference", { description: error instanceof Error ? error.message : "Try again." }),
  });

  const requestsQuery = useQuery({
    queryKey: ["signup-requests"],
    enabled: isAdmin && Boolean(supabase),
    queryFn: async (): Promise<SignupRequest[]> => {
      const { data, error } = await supabase!
        .from("signup_requests" as never)
        .select("id,email,full_name,requested_role,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as SignupRequest[] | null) ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["club-members"],
    enabled: isAdmin && Boolean(supabase),
    queryFn: async (): Promise<ClubMember[]> => {
      const { data, error } = await supabase!.rpc("list_club_members" as never);
      if (error) throw error;
      return (data as ClubMember[] | null) ?? [];
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["club-invites"],
    enabled: isAdmin && Boolean(supabase),
    queryFn: async (): Promise<ClubInvite[]> => {
      const { data, error } = await supabase!
        .from("club_invites" as never)
        .select("id,email,role,status,expires_at,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data as ClubInvite[] | null) ?? [];
    },
  });

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
        <h2 className="text-xl font-semibold">Admin controls</h2>
        <p className="mt-2 text-sm text-muted-foreground">Only owners and admins can manage club access.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Admin controls</h2>
            <p className="text-sm text-muted-foreground">Club rules, roles, permissions, and operating defaults.</p>
          </div>
          <div className="flex gap-2">
            <InviteDialog />
            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Rules</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Access requests</h2>
          <p className="text-sm text-muted-foreground">Approve new members after they request access.</p>
        </div>
        {(requestsQuery.data ?? []).length ? (
          requestsQuery.data?.map((request) => <AccessRequestRow key={request.id} request={request} />)
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
            {requestsQuery.isLoading ? "Loading requests..." : "No pending access requests."}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Prefer nicknames</h3>
            <p className="mt-1 text-sm text-muted-foreground">When on, display member nicknames throughout the club (feed, scores, stats) whenever a nickname is set.</p>
          </div>
          <Switch
            checked={preferNicknames}
            disabled={settingsQuery.isLoading || preferNicknamesMutation.isPending}
            onCheckedChange={(next) => preferNicknamesMutation.mutate(next)}
          />
        </div>
      </section>

      <AddGuestPanel />

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">Change roles for existing members. The owner role is locked. Tap the pencil to edit nickname and rating.</p>
        </div>

        {(membersQuery.data ?? []).length ? (
          membersQuery.data?.map((member) => (
            <MemberRoleRow key={member.profile_id} member={member} preferNicknames={preferNicknames} />
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
            {membersQuery.isLoading ? "Loading members..." : "No members yet."}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recent invites</h2>
          <p className="text-sm text-muted-foreground">Invite links are shown only when created; create a new link if one is lost.</p>
        </div>
        {(invitesQuery.data ?? []).length ? (
          invitesQuery.data?.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invite.email}</p>
                <p className="truncate text-xs text-muted-foreground">Expires {new Date(invite.expires_at).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="capitalize">{invite.role}</Badge>
                <Badge variant={invite.status === "pending" ? "secondary" : "default"} className="capitalize">{invite.status}</Badge>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
            {invitesQuery.isLoading ? "Loading invites..." : "No invites yet."}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        {controls.map((control) => (
          <div key={control.label} className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <control.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{control.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{control.detail}</p>
              </div>
            </div>
            <Switch defaultChecked={control.enabled} />
          </div>
        ))}
      </section>
    </div>
  );
}
