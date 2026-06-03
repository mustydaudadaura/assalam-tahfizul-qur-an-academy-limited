import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createSchool, assignSchoolAdmin, deleteSchool } from "@/lib/super-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/super/schools")({ component: SuperSchools });

function SuperSchools() {
  const qc = useQueryClient();
  const createFn = useServerFn(createSchool);
  const assignFn = useServerFn(assignSchoolAdmin);
  const delFn = useServerFn(deleteSchool);

  const [open, setOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", motto: "",
    plan: "trial", billing_cycle: "monthly", price_ngn: 0, seats: 100,
  });
  const [admin, setAdmin] = useState({ email: "", password: "", full_name: "", phone: "" });

  const { data: schools } = useQuery({
    queryKey: ["super-schools"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("*, school_subscriptions(*)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { ...form, price_ngn: Number(form.price_ngn), seats: Number(form.seats) } as any }),
    onSuccess: () => { toast.success("School created"); qc.invalidateQueries({ queryKey: ["super-schools"] }); setOpen(false); setForm({ name: "", phone: "", email: "", address: "", motto: "", plan: "trial", billing_cycle: "monthly", price_ngn: 0, seats: 100 }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const assignMut = useMutation({
    mutationFn: () => assignFn({ data: { school_id: assignFor!, ...admin } }),
    onSuccess: () => { toast.success("Admin assigned"); setAssignFor(null); setAdmin({ email: "", password: "", full_name: "", phone: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { school_id: id } }),
    onSuccess: () => { toast.success("School deleted"); qc.invalidateQueries({ queryKey: ["super-schools"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Schools</h2>
          <p className="text-sm text-muted-foreground">{schools?.length ?? 0} tenants on the platform</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Add school</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create a new school tenant</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>School name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Motto</Label><Input value={form.motto} onChange={e => setForm({ ...form, motto: e.target.value })} /></div>
              <div><Label>Plan</Label>
                <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["trial", "starter", "standard", "premium", "enterprise"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Billing cycle</Label>
                <Select value={form.billing_cycle} onValueChange={v => setForm({ ...form, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Price (₦)</Label><Input type="number" value={form.price_ngn} onChange={e => setForm({ ...form, price_ngn: Number(e.target.value) })} /></div>
              <div><Label>Seats</Label><Input type="number" value={form.seats} onChange={e => setForm({ ...form, seats: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter><Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}>Create school</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>School</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead>
            <TableHead>Seats</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {schools?.map((s: any) => {
              const sub = s.school_subscriptions?.[0];
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.slug} · {s.email ?? "no email"}</div>
                  </TableCell>
                  <TableCell><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs capitalize">{sub?.plan ?? "—"}</span></TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${sub?.status === "active" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                      {sub?.status ?? "no sub"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{sub?.seats ?? "—"}</TableCell>
                  <TableCell className="text-sm">{sub ? `₦${Number(sub.price_ngn).toLocaleString()}/${sub.billing_cycle}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Assign admin" onClick={() => setAssignFor(s.id)}><UserPlus className="size-4" /></Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => confirm(`Delete ${s.name}? This removes all its data.`) && deleteMut.mutate(s.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!schools?.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No schools yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!assignFor} onOpenChange={v => !v && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign school administrator</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={admin.full_name} onChange={e => setAdmin({ ...admin, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={admin.phone} onChange={e => setAdmin({ ...admin, phone: e.target.value })} /></div>
            <div><Label>Password</Label><Input value={admin.password} onChange={e => setAdmin({ ...admin, password: e.target.value })} placeholder="Min 6 chars" /></div>
            <p className="text-xs text-muted-foreground">If the email already has an account, the existing user is linked as admin for this school.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => assignMut.mutate()} disabled={assignMut.isPending || !admin.email || !admin.full_name || admin.password.length < 6}>
              Assign as admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
