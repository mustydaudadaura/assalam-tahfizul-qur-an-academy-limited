import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateSubscription } from "@/lib/super-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/super/subscriptions")({ component: Subscriptions });

const PLANS = ["trial", "starter", "standard", "premium", "enterprise"] as const;
const STATUSES = ["active", "past_due", "suspended", "cancelled", "expired"] as const;

function Subscriptions() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSubscription);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const { data: rows } = useQuery({
    queryKey: ["all-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("school_subscriptions")
        .select("*, schools(name, slug)").order("current_period_end");
      return data ?? [];
    },
  });

  const startEdit = (r: any) => {
    setEditing(r);
    setForm({
      school_id: r.school_id, plan: r.plan, status: r.status, billing_cycle: r.billing_cycle,
      price_ngn: Number(r.price_ngn), seats: r.seats,
      current_period_end: r.current_period_end?.slice(0, 10), notes: r.notes ?? "",
    });
  };

  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: { ...form, current_period_end: new Date(form.current_period_end).toISOString(), price_ngn: Number(form.price_ngn), seats: Number(form.seats) } }),
    onSuccess: () => { toast.success("Subscription updated"); qc.invalidateQueries({ queryKey: ["all-subs"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Subscriptions</h2>
        <p className="text-sm text-muted-foreground">Manage billing, plans, and renewal dates per tenant.</p>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>School</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead>
            <TableHead>Cycle</TableHead><TableHead>Price</TableHead><TableHead>Renews</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.schools?.name}</div><div className="text-xs text-muted-foreground">{r.schools?.slug}</div></TableCell>
                <TableCell className="capitalize">{r.plan}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${r.status === "active" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>{r.status}</span></TableCell>
                <TableCell className="capitalize">{r.billing_cycle}</TableCell>
                <TableCell>₦{Number(r.price_ngn).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{new Date(r.current_period_end).toLocaleDateString()}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => startEdit(r)}><Pencil className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!rows?.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No subscriptions.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit subscription — {editing?.schools?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Plan</Label>
              <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cycle</Label>
              <Select value={form.billing_cycle} onValueChange={v => setForm({ ...form, billing_cycle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Price (₦)</Label><Input type="number" value={form.price_ngn ?? 0} onChange={e => setForm({ ...form, price_ngn: e.target.value })} /></div>
            <div><Label>Seats</Label><Input type="number" value={form.seats ?? 0} onChange={e => setForm({ ...form, seats: e.target.value })} /></div>
            <div><Label>Renews on</Label><Input type="date" value={form.current_period_end ?? ""} onChange={e => setForm({ ...form, current_period_end: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
