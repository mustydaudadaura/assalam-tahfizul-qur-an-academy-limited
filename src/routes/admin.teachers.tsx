import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/teachers")({ component: TeachersPage });

function TeachersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assign, setAssign] = useState<{ teacher_id: string; subject_id: string; class_id: string } | null>(null);

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = roles?.map(r => r.user_id) ?? [];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      return data ?? [];
    },
  });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [] });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, subjects(name), classes(name)")).data ?? [],
  });

  const addAssign = useMutation({
    mutationFn: async () => {
      if (!assign) return;
      const { error } = await supabase.from("teacher_assignments").insert(assign);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assigned"); qc.invalidateQueries({ queryKey: ["assignments"] }); setOpen(false); setAssign(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delAssign = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("teacher_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Teachers</h2>
        <p className="text-sm text-muted-foreground">Teachers self-register from the sign-up page with role "Teacher". Assign them to subjects and classes below.</p>
      </div>

      <Card className="p-6">
        <h3 className="mb-3 font-display font-semibold">Registered teachers</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
          <TableBody>
            {teachers?.map(t => <TableRow key={t.id}><TableCell className="font-medium">{t.full_name}</TableCell><TableCell className="text-muted-foreground">{t.email}</TableCell></TableRow>)}
            {!teachers?.length && <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">No teachers yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Subject assignments</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 size-4" />New assignment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign teacher</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Teacher</Label>
                  <Select onValueChange={v => setAssign({ ...(assign ?? { subject_id: "", class_id: "" }), teacher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>{teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Subject</Label>
                  <Select onValueChange={v => setAssign({ ...(assign ?? { teacher_id: "", class_id: "" }), subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Class</Label>
                  <Select onValueChange={v => setAssign({ ...(assign ?? { teacher_id: "", subject_id: "" }), class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={() => addAssign.mutate()} disabled={!assign?.teacher_id || !assign?.subject_id || !assign?.class_id}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {assignments?.map(a => {
              const teacher = teachers?.find(t => t.id === a.teacher_id);
              return (
                <TableRow key={a.id}>
                  <TableCell>{teacher?.full_name ?? a.teacher_id.slice(0, 8)}</TableCell>
                  <TableCell>{(a as any).subjects?.name}</TableCell>
                  <TableCell>{(a as any).classes?.name}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => delAssign.mutate(a.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
            {!assignments?.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No assignments yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
