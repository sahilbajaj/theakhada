import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Copy, LogOut, Plus, Shield, Users } from "lucide-react";
import { AccessRequestRow, type SignupRequest } from "@/components/AccessRequestRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MemberRole } from "@/types/club";

const settableRoles: Exclude<MemberRole, "owner">[] = ["admin", "coach", "player", "guest"];

interface ClubMemberRow {
  profile_id: string;
  club_id: string;
  full_name: string;
  nickname: string | null;
  email: string;
  role: MemberRole;
  rating: number | null;
  avatar_url: string | null;
  is_self: boolean;
}

interface ClubRow {
  id: string;
  name: string;
  city: string | null;
  timezone: string;
  created_at: string;
  member_count: number;
}

const CLUBS_KEY = ["superadmin", "clubs"] as const;

export default function Superadmin() {
  const { isSuperadmin, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground text-sm text-muted-foreground">
        Loading superadmin console
      </div>
    );
  }
  if (!isSuperadmin) return <Navigate to="/app" replace />;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-3xl gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Superadmin console</h1>
              <p className="text-xs text-muted-foreground">Create clubs and onboard their first owner.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </header>

        <CreateClubCard />
        <ClubsList />
      </section>
    </main>
  );
}

function CreateClubCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const mutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase!.rpc("create_club" as never, {
        p_name: name,
        p_city: city || null,
        p_timezone: timezone,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async (clubId) => {
      toast.success("Club created", { description: `New club id: ${clubId.slice(0, 8)}…` });
      setName("");
      setCity("");
      await queryClient.invalidateQueries({ queryKey: CLUBS_KEY });
    },
    onError: (error) => {
      toast.error("Could not create club", { description: error instanceof Error ? error.message : "Try again." });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !timezone.trim()) return;
    mutation.mutate();
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Create a club</h2>
      </div>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={submit}>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="club-name">Name</Label>
          <Input id="club-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="club-city">City</Label>
          <Input id="club-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="club-tz">Timezone</Label>
          <Input id="club-tz" required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <div className="grid content-end">
          <Button type="submit" disabled={mutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

function ClubsList() {
  const query = useQuery({
    queryKey: CLUBS_KEY,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<ClubRow[]> => {
      const { data, error } = await supabase!.rpc("list_all_clubs" as never);
      if (error) throw error;
      return (data as ClubRow[] | null) ?? [];
    },
  });

  if (query.isLoading) {
    return <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">Loading clubs…</div>;
  }
  if (query.isError) {
    return <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">Could not load clubs.</div>;
  }
  const clubs = query.data ?? [];
  if (!clubs.length) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Clubs</h2>
      </div>
      <ul className="grid gap-3">
        {clubs.map((c) => <ClubRowItem key={c.id} club={c} />)}
      </ul>
    </div>
  );
}

function ClubRowItem({ club }: { club: ClubRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{club.name}</div>
          <div className="text-xs text-muted-foreground">
            {[club.city, club.timezone].filter(Boolean).join(" · ")} · {club.member_count} member{club.member_count === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">{club.id}</div>
      </div>
      <InviteOwnerForm clubId={club.id} clubName={club.name} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-2 h-8 px-2 text-xs"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
        Manage requests & members
      </Button>
      {expanded ? <ClubManagePanel clubId={club.id} /> : null}
    </li>
  );
}

function ClubManagePanel({ clubId }: { clubId: string }) {
  const requestsKey = ["superadmin", "signup-requests", clubId] as const;
  const membersKey = ["superadmin", "club-members", clubId] as const;

  const requestsQuery = useQuery({
    queryKey: requestsKey,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<SignupRequest[]> => {
      const { data, error } = await supabase!
        .from("signup_requests" as never)
        .select("id,email,full_name,requested_role,status,created_at")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as SignupRequest[] | null) ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: membersKey,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<ClubMemberRow[]> => {
      const { data, error } = await supabase!.rpc("list_club_members" as never, { p_club_id: clubId } as never);
      if (error) throw error;
      return (data as ClubMemberRow[] | null) ?? [];
    },
  });

  const requests = requestsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  return (
    <div className="mt-3 grid gap-4 rounded-lg border border-border/40 bg-secondary/30 p-3">
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending requests</h3>
        {requestsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending requests.</p>
        ) : (
          requests.map((request) => (
            <AccessRequestRow
              key={request.id}
              request={request}
              invalidateKeys={[[...requestsKey], [...membersKey], ["superadmin", "clubs"]]}
            />
          ))
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</h3>
        {membersQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members yet.</p>
        ) : (
          members.map((member) => (
            <MemberRoleRow key={member.profile_id} clubId={clubId} member={member} membersKey={[...membersKey]} />
          ))
        )}
      </section>
    </div>
  );
}

function MemberRoleRow({
  clubId,
  member,
  membersKey,
}: {
  clubId: string;
  member: ClubMemberRow;
  membersKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();

  const roleMutation = useMutation({
    mutationFn: async (nextRole: MemberRole) => {
      const { error } = await supabase!.rpc("set_member_role" as never, {
        p_club_id: clubId,
        p_profile_id: member.profile_id,
        p_role: nextRole,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKey });
      toast.success("Role updated");
    },
    onError: (error) => toast.error("Could not update role", { description: error instanceof Error ? error.message : "Try again." }),
  });

  const roleLocked = member.role === "owner";
  const primaryName = member.full_name || member.email;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{primaryName}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      {roleLocked ? (
        <Badge variant="secondary" className="capitalize">{member.role}</Badge>
      ) : (
        <Select value={member.role} onValueChange={(value) => roleMutation.mutate(value as MemberRole)} disabled={roleMutation.isPending}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {settableRoles.map((item) => (
              <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function InviteOwnerForm({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "player" | "coach" | "guest">("admin");
  const [inviteUrl, setInviteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setInviteUrl("");
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase!.rpc("create_invite" as never, {
        p_club_id: clubId,
        p_email: email,
        p_role: role,
        p_expires_at: expiresAt,
        p_base_url: window.location.origin,
      } as never);
      if (error) throw error;
      const nextUrl = (data as { invite_url: string }[] | null)?.[0]?.invite_url;
      if (!nextUrl) throw new Error("Invite link was not returned");
      setInviteUrl(nextUrl);
      toast.success(`Invited ${email} to ${clubName}`);
      setEmail("");
    } catch (err) {
      toast.error("Could not create invite", { description: err instanceof Error ? err.message : "Try again." });
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
    <form className="mt-3 grid gap-2 sm:grid-cols-[1fr,140px,auto]" onSubmit={submit}>
      <Input type="email" placeholder="Owner email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="coach">Coach</SelectItem>
          <SelectItem value="player">Player</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={isSubmitting}>Invite</Button>
      {inviteUrl ? (
        <div className="grid gap-2 sm:col-span-3">
          <Textarea readOnly value={inviteUrl} rows={2} />
          <Button type="button" size="sm" variant="outline" onClick={() => void copyInvite()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </div>
      ) : null}
    </form>
  );
}
