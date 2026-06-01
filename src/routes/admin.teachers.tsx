import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createUserAccount, deleteUserAccount, updateUserAccount } from "@/lib/admin-users.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/teachers")({ component: TeachersPage });

interface Teacher { id: string; full_name: string; email: string | null; phone: string | null }

function TeachersPage() {
  const qc = useQueryClient();
  const createFn = useServerFn(createUserAccount);
  const deleteFn = useServerFn(deleteUserAccount);
  const updateFn = useServerFn(updateUserAccount);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", subject_id: "", class_id: "" });
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assign, setAssign] = useState({ subject_id: "", class_id: "" });

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [] as Teacher[];
      const { data } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
      return (data ?? []) as Teacher[];
    },
  });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [] });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, subjects(name), classes(name)")).data ?? [],
  });

  const reset = () => setForm({ full_name: "", email: "", phone: "", password: "", subject_id: "", class_id: "" });

  const createTeacher = useMutation({
    mutationFn: async () => {
      const res = await createFn({ data: { full_name: form.full_name, email: form.email, phone: form.phone, password: form.password, role: "teacher" } });
      if (form.subject_id && form.class_id) {
        await supabase.from("teacher_assignments").insert({ teacher_id: res.id, subject_id: form.subject_id, class_id: form.class_id } as any);
      }
    },
    onSuccess: () => {
      toast.success("Teacher created");
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      setOpen(false); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editTeacher = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await updateFn({ data: { user_id: editing.id, full_name: form.full_name, phone: form.phone, password: form.password || null } });
    },
    onSuccess: () => {
      toast.success("Teacher updated");
      qc.invalidateQueries({ queryKey: ["teachers"] });
      setEditing(null); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTeacher = useMutation({
    mutationFn: async (id: string) => { await deleteFn({ data: { user_id: id } }); },
    onSuccess: () => { toast.success("Teacher removed"); qc.invalidateQueries({ queryKey: ["teachers"] }); qc.invalidateQueries({ queryKey: ["assignments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAssign = useMutation({
    mutationFn: async (teacher_id: string) => {
      const { error } = await supabase.from("teacher_assignments").insert({ teacher_id, ...assign } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assigned"); qc.invalidateQueries({ queryKey: ["assignments"] }); setAssignOpen(null); setAssign({ subject_id: "", class_id: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delAssign = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("teacher_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  const teacherAssignments = (tid: string) => assignments?.filter(a => a.teacher_id === tid) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Teachers</h2>
          <p className="text-sm text-muted-foreground">{teachers?.length ?? 0} registered</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Add teacher</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register new teacher</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Password (login access)</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Subject (optional)</Label>
                  <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Class (optional)</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => createTeacher.mutate()} disabled={createTeacher.isPending || !form.full_name || !form.email || form.password.length < 6}>Create teacher</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
            <TableHead>Assignments</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {teachers?.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.full_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                <TableCell className="text-sm">{t.phone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {teacherAssignments(t.id).map(a => (
                      <span key={a.id} className="group inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                        {(a as any).subjects?.name} · {(a as any).classes?.name}
                        <button onClick={() => delAssign.mutate(a.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="size-3" /></button>
                      </span>
                    ))}
                    <Dialog open={assignOpen === t.id} onOpenChange={v => setAssignOpen(v ? t.id : null)}>
                      <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 px-2 text-xs">+ assign</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Assign subject and class</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Subject</Label>
                            <Select value={assign.subject_id} onValueChange={v => setAssign({ ...assign, subject_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>{subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label>Class</Label>
                            <Select value={assign.class_id} onValueChange={v => setAssign({ ...assign, class_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter><Button onClick={() => addAssign.mutate(t.id)} disabled={!assign.subject_id || !assign.class_id}>Save</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm({ ...form, full_name: t.full_name, email: t.email ?? "", phone: t.phone ?? "", password: "" }); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${t.full_name}? This removes their login.`)) removeTeacher.mutate(t.id); }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!teachers?.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No teachers yet. Click "Add teacher" to register one.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={v => { if (!v) { setEditing(null); reset(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit teacher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} disabled /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>New password (leave blank to keep)</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => editTeacher.mutate()} disabled={editTeacher.isPending}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
