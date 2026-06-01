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
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/students")({ component: StudentsPage });

const empty = { admission_no: "", full_name: "", gender: "Male", class_id: "", guardian_name: "", guardian_phone: "", date_of_birth: "", passport_url: "", house: "" };

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

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

  const handleUpload = async (file: File) => {
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("passports").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("passports").getPublicUrl(path);
      setForm(f => ({ ...f, passport_url: data.publicUrl }));
      toast.success("Passport uploaded");
    } else toast.error(error.message);
    setUploading(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, class_id: form.class_id || null, date_of_birth: form.date_of_birth || null, passport_url: form.passport_url || null };
      if (editId) {
        const { error } = await supabase.from("students").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Student updated" : "Student added");
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false); setEditId(null); setForm(empty);
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

  const openEdit = (s: NonNullable<typeof students>[number]) => {
    setEditId(s.id);
    setForm({
      admission_no: s.admission_no, full_name: s.full_name, gender: s.gender ?? "Male",
      class_id: s.class_id ?? "", guardian_name: s.guardian_name ?? "", guardian_phone: s.guardian_phone ?? "",
      date_of_birth: s.date_of_birth ?? "", passport_url: s.passport_url ?? "",
      house: (s as { house?: string | null }).house ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">{students?.length ?? 0} registered</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Add student</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Edit student" : "New student"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-20 overflow-hidden rounded-full border bg-muted">
                  {form.passport_url ? <img src={form.passport_url} alt="passport" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-xs text-muted-foreground">No photo</div>}
                </div>
                <div className="flex-1">
                  <Label>Passport photograph</Label>
                  <Input type="file" accept="image/*" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Admission No</Label><Input value={form.admission_no} onChange={e => setForm({ ...form, admission_no: e.target.value })} /></div>
                <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              </div>
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gender</Label>
                  <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Class</Label>
                  <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Guardian / parent name</Label><Input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Parent phone</Label><Input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} /></div>
                <div><Label>House</Label><Input placeholder="e.g. Red / Green" value={form.house} onChange={e => setForm({ ...form, house: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.full_name || !form.admission_no}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Adm No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students?.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  {s.passport_url
                    ? <img src={s.passport_url} alt="" className="size-10 rounded-full object-cover" />
                    : <div className="size-10 rounded-full bg-muted" />}
                </TableCell>
                <TableCell className="font-mono text-xs">{s.admission_no}</TableCell>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.gender}</TableCell>
                <TableCell>{(s as { classes?: { name?: string } }).classes?.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.guardian_name} {s.guardian_phone && <span className="ml-1">· {s.guardian_phone}</span>}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete student?")) del.mutate(s.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!students?.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No students yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
