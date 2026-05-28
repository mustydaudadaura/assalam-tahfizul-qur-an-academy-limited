import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sessions")({ component: SessionsPage });

function SessionsPage() {
  const qc = useQueryClient();
  const [newSession, setNewSession] = useState("");
  const [termName, setTermName] = useState("");
  const [termBegins, setTermBegins] = useState("");
  const [termEnds, setTermEnds] = useState("");
  const [sessionId, setSessionId] = useState("");

  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });

  const addSession = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("sessions").insert({ name: newSession }); if (error) throw error; },
    onSuccess: () => { toast.success("Session added"); qc.invalidateQueries({ queryKey: ["sessions"] }); setNewSession(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addTerm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("terms").insert({
        session_id: sessionId, name: termName,
        term_begins: termBegins || null, term_ends: termEnds || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Term added"); qc.invalidateQueries({ queryKey: ["sessions"] }); setTermName(""); setTermBegins(""); setTermEnds(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateTermDates = useMutation({
    mutationFn: async ({ id, term_begins, term_ends }: { id: string; term_begins: string | null; term_ends: string | null }) => {
      const { error } = await supabase.from("terms").update({ term_begins, term_ends }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dates updated"); qc.invalidateQueries({ queryKey: ["sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setCurrentSession = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sessions").update({ is_current: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await supabase.from("sessions").update({ is_current: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const setCurrentTerm = useMutation({
    mutationFn: async ({ id, session_id }: { id: string; session_id: string }) => {
      await supabase.from("terms").update({ is_current: false }).eq("session_id", session_id);
      const { error } = await supabase.from("terms").update({ is_current: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Sessions & Terms</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-display font-semibold">New session</h3>
          <form onSubmit={e => { e.preventDefault(); addSession.mutate(); }} className="flex gap-2">
            <Input placeholder="e.g. 2025/2026" value={newSession} onChange={e => setNewSession(e.target.value)} required />
            <Button type="submit"><Plus className="size-4" /></Button>
          </form>
        </Card>
        <Card className="p-6">
          <h3 className="mb-3 font-display font-semibold">Add term</h3>
          <div className="space-y-2">
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>{sessions?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input placeholder="Term name" value={termName} onChange={e => setTermName(e.target.value)} />
              <Button onClick={() => addTerm.mutate()} disabled={!sessionId || !termName}><Plus className="size-4" /></Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {sessions?.map(s => (
          <Card key={s.id} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{s.name}</h3>
                {s.is_current && <Badge>Current</Badge>}
              </div>
              {!s.is_current && <Button variant="outline" size="sm" onClick={() => setCurrentSession.mutate(s.id)}>Set current</Button>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(s as any).terms?.map((t: any) => (
                <button key={t.id} onClick={() => !t.is_current && setCurrentTerm.mutate({ id: t.id, session_id: s.id })}
                  className={`flex items-center gap-1 rounded-md border px-3 py-1 text-sm ${t.is_current ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  {t.is_current && <Check className="size-3" />}{t.name}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
