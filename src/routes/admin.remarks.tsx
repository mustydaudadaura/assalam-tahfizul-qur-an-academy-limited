import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/remarks")({ component: RemarksPage });

type Meta = { class_teacher_remark: string; principal_remark: string; next_term_begins: string };

function RemarksPage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [data, setData] = useState<Record<string, Meta>>({});

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const terms = sessions?.find(s => s.id === sessionId)?.terms ?? [];

  const { data: students } = useQuery({
    queryKey: ["remarks-students", classId, termId],
    queryFn: async () => {
      if (!classId || !termId) return [];
      const { data: studs } = await supabase.from("students").select("id, full_name, admission_no").eq("class_id", classId).order("full_name");
      return studs ?? [];
    },
    enabled: !!classId && !!termId,
  });

  const { data: existing } = useQuery({
    queryKey: ["remarks-existing", termId, students?.map(s => s.id).join(",")],
    queryFn: async () => {
      if (!termId || !students?.length) return [];
      const { data } = await supabase.from("student_term_reports").select("*").eq("term_id", termId).in("student_id", students.map(s => s.id));
      return data ?? [];
    },
    enabled: !!termId && !!students?.length,
  });

  useEffect(() => {
    if (!existing || !students) return;
    const map: Record<string, Meta> = {};
    students.forEach(s => {
      const e = existing.find(x => x.student_id === s.id);
      map[s.id] = {
        class_teacher_remark: e?.class_teacher_remark ?? "",
        principal_remark: e?.principal_remark ?? "",
        next_term_begins: e?.next_term_begins ?? "",
      };
    });
    setData(map);
  }, [existing, students]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(data).map(([student_id, m]) => ({
        student_id, term_id: termId,
        class_teacher_remark: m.class_teacher_remark || null,
        principal_remark: m.principal_remark || null,
        next_term_begins: m.next_term_begins || null,
      }));
      const { error } = await supabase.from("student_term_reports").upsert(rows, { onConflict: "student_id,term_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Remarks saved"); qc.invalidateQueries({ queryKey: ["remarks-existing"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = (id: string, k: keyof Meta, v: string) => setData(d => ({ ...d, [id]: { ...d[id], [k]: v } }));

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Remarks & next term</h2>
      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Session</Label>
            <Select value={sessionId} onValueChange={v => { setSessionId(v); setTermId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{sessions?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{terms.map((t: { id: string; name: string }) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {classId && termId && (
        <Card>
          <div className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">{students?.length ?? 0} students</p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />Save all</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class teacher remark</TableHead>
              <TableHead>Principal remark</TableHead>
              <TableHead className="w-40">Next term begins</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {students?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="align-top font-medium">{s.full_name}<div className="font-mono text-xs text-muted-foreground">{s.admission_no}</div></TableCell>
                  <TableCell><Textarea rows={2} value={data[s.id]?.class_teacher_remark ?? ""} onChange={e => upd(s.id, "class_teacher_remark", e.target.value)} /></TableCell>
                  <TableCell><Textarea rows={2} value={data[s.id]?.principal_remark ?? ""} onChange={e => upd(s.id, "principal_remark", e.target.value)} /></TableCell>
                  <TableCell><Input type="date" value={data[s.id]?.next_term_begins ?? ""} onChange={e => upd(s.id, "next_term_begins", e.target.value)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
