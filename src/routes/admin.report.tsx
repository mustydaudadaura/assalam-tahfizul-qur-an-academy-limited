import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportCard } from "@/components/ReportCard";

export const Route = createFileRoute("/admin/report")({ component: AdminReportPage });

function AdminReportPage() {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [search, setSearch] = useState("");

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const { data: students } = useQuery({
    queryKey: ["report-students", classId],
    queryFn: async () => (await supabase.from("students").select("id, full_name, admission_no").eq("class_id", classId).order("full_name")).data ?? [],
    enabled: !!classId,
  });

  const allTerms = useMemo(() => sessions?.flatMap(s => (s as any).terms.map((t: any) => ({ ...t, session_name: s.name }))) ?? [], [sessions]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? (students ?? []).filter(s => s.full_name.toLowerCase().includes(q) || s.admission_no.toLowerCase().includes(q)) : (students ?? []);
  }, [students, search]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Student report viewer</h2>
      <Card className="p-4 no-print">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={v => { setClassId(v); setStudentId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <Input placeholder="Name or adm no" value={search} onChange={e => setSearch(e.target.value)} disabled={!classId} />
          </div>
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {filtered.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Term</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>{allTerms.map(t => <SelectItem key={t.id} value={t.id}>{t.session_name} — {t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>
      {studentId && termId
        ? <ReportCard studentId={studentId} termId={termId} />
        : <Card className="p-12 text-center text-sm text-muted-foreground">Select a class, student and term to view, print or download the report sheet.</Card>}
    </div>
  );
}
