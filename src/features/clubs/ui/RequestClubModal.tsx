import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestClubModal({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.rpc("request_club_creation" as never, {
        p_name: name.trim(),
        p_city: city.trim() || null,
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent — an admin will review it");
      setName("");
      setCity("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error("Could not send request", {
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const canSubmit = name.trim().length > 0 && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a new club</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="req-club-name">Club name</Label>
            <Input
              id="req-club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cubbon Park Tennis"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="req-club-city">City <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="req-club-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="req-club-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="req-club-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything an admin should know"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit}>
            {submit.isPending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
