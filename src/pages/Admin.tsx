import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCog, Check, ShieldCheck, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { InviteDialog } from "@/components/InviteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm lg:grid-cols-[1fr_150px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{request.full_name}</h3>
          <Badge variant="secondary">{request.status}</Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{request.email}</p>
      </div>
      <Select value={role} onValueChange={(value) => setRole(value as RequestRole)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="player">Player</SelectItem>
          <SelectItem value="coach">Coach</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || rejectMutation.isPending}>
          <Check className="mr-2 h-4 w-4" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate()} disabled={approveMutation.isPending || rejectMutation.isPending}>
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";

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
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Admin controls</h2>
        <p className="mt-2 text-sm text-muted-foreground">Only owners and admins can manage club access.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
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
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            {requestsQuery.isLoading ? "Loading requests..." : "No pending access requests."}
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
            <div key={invite.id} className="grid gap-2 rounded-lg border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{invite.email}</p>
                <p className="text-sm text-muted-foreground">Expires {new Date(invite.expires_at).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline" className="capitalize">{invite.role}</Badge>
              <Badge variant={invite.status === "pending" ? "secondary" : "default"} className="capitalize">{invite.status}</Badge>
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            {invitesQuery.isLoading ? "Loading invites..." : "No invites yet."}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        {controls.map((control) => (
          <div key={control.label} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
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
