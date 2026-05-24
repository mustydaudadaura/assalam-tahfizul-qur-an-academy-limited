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

export const Route = createFileRoute("/admin/students")({ component: StudentsPage });

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ admission_no: "", full_name: "", gender: "Male", class_id: "", guardian_name: "", guardian_phone: "" });

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*, classes(name)").order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({ ...form, class_id: form.class_id || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student added");
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setForm({ admission_no: "", full_name: "", gender: "Male", class_id: "", guardian_name: "", guardian_phone: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">{students?.length ?? 0} registered</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 size-4" />Add student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New student</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Admission No</Label><Input value={form.admission_no} onChange={e => setForm({ ...form, admission_no: e.target.value })} /></div>
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Guardian name</Label><Input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} /></div>
              <div><Label>Guardian phone</Label><Input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adm No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Guardian</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.admission_no}</TableCell>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.gender}</TableCell>
                <TableCell>{(s as any).classes?.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.guardian_name}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!students?.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No students yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
