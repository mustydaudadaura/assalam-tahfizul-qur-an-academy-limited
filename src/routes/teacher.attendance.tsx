import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/attendance")({ component: AttendancePage });

function AttendancePage() {
  const qc = useQueryClient();
  const [f, setF] = useState({ class_id: "", session_id: "", term_id: "" });
  const [att, setAtt] = useState<Record<string, { present: number; absent: number; total_days: number }>>({});

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const terms = sessions?.find(s => s.id === f.session_id)?.terms ?? [];

  const { data: students } = useQuery({
    queryKey: ["att-roster", f.class_id, f.session_id, f.term_id],
    queryFn: async () => {
      const { data: studs } = await supabase.from("students").select("*").eq("class_id", f.class_id).order("full_name");
      if (!studs || !f.term_id) return studs ?? [];
      const { data: existing } = await supabase.from("attendance").select("*")
        .eq("session_id", f.session_id).eq("term_id", f.term_id).in("student_id", studs.map(s => s.id));
      const map: Record<string, any> = {};
      existing?.forEach(r => { map[r.student_id] = { present: r.present, absent: r.absent, total_days: r.total_days }; });
      setAtt(map);
      return studs;
    },
    enabled: !!(f.class_id && f.session_id && f.term_id),
  });

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(att).map(([student_id, a]) => ({
        student_id, session_id: f.session_id, term_id: f.term_id,
        present: a.present || 0, absent: a.absent || 0, total_days: a.total_days || 0,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,session_id,term_id" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Attendance saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = f.class_id && f.session_id && f.term_id;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Attendance</h2>
      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Session</Label>
            <Select value={f.session_id} onValueChange={v => setF({ ...f, session_id: v, term_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{sessions?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={f.term_id} onValueChange={v => setF({ ...f, term_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Class</Label>
            <Select value={f.class_id} onValueChange={v => setF({ ...f, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>
      {ready && (
        <Card>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">{students?.length ?? 0} students</span>
            <Button onClick={() => save.mutate()}><Save className="mr-2 size-4" />Save</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead><TableHead>Total days</TableHead></TableRow></TableHeader>
            <TableBody>
              {students?.map(s => {
                const a = att[s.id] ?? { present: 0, absent: 0, total_days: 0 };
                const upd = (k: string, v: string) => setAtt({ ...att, [s.id]: { ...a, [k]: Number(v) } });
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell><Input type="number" value={a.present} onChange={e => upd("present", e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input type="number" value={a.absent} onChange={e => upd("absent", e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input type="number" value={a.total_days} onChange={e => upd("total_days", e.target.value)} className="w-24" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
