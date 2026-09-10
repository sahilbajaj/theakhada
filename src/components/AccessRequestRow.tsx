import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MemberRole } from "@/types/club";

type RequestRole = Extract<MemberRole, "coach" | "player" | "guest">;

export interface SignupRequest {
  id: string;
  email: string;
  full_name: string;
  requested_role: RequestRole;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export function AccessRequestRow({
  request,
  invalidateKeys = [["signup-requests"]],
}: {
  request: SignupRequest;
  invalidateKeys?: readonly unknown[][];
}) {
  const [role, setRole] = useState<RequestRole>(request.requested_role);
  const queryClient = useQueryClient();

  async function invalidate() {
    await Promise.all(invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc("approve_signup_request" as never, {
        p_request_id: request.id,
        p_role: role,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
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
      await invalidate();
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
