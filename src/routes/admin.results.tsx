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
import { ScoreImportExport } from "@/components/ScoreImportExport";

export const Route = createFileRoute("/admin/results")({ component: ResultsPage });

export function ResultsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ class_id: "", subject_id: "", session_id: "", term_id: "" });
  const [scores, setScores] = useState<Record<string, { ca1: number; ca2: number; exam: number }>>({});

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });

  const terms = sessions?.find(s => s.id === filters.session_id)?.terms ?? [];

  const { data: students } = useQuery({
    queryKey: ["roster", filters.class_id, filters.subject_id, filters.session_id, filters.term_id],
    queryFn: async () => {
      if (!filters.class_id) return [];
      const { data: studs } = await supabase.from("students").select("*").eq("class_id", filters.class_id).order("full_name");
      if (!studs?.length || !filters.subject_id || !filters.term_id) return studs ?? [];
      const { data: existing } = await supabase.from("results").select("*")
        .eq("subject_id", filters.subject_id).eq("session_id", filters.session_id).eq("term_id", filters.term_id)
        .in("student_id", studs.map(s => s.id));
      const map: Record<string, { ca1: number; ca2: number; exam: number }> = {};
      existing?.forEach(r => { map[r.student_id] = { ca1: Number(r.ca1), ca2: Number(r.ca2), exam: Number(r.exam) }; });
      setScores(map);
      return studs;
    },
    enabled: !!filters.class_id,
  });

  const calcRemark = (g: string) => ({ A: "Excellent", B: "Very Good", C: "Good", D: "Fair", F: "Fail" } as Record<string, string>)[g] ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(scores).map(([student_id, s]) => ({
        student_id, subject_id: filters.subject_id, class_id: filters.class_id,
        session_id: filters.session_id, term_id: filters.term_id,
        ca1: s.ca1 || 0, ca2: s.ca2 || 0, exam: s.exam || 0,
      }));
      const { error } = await supabase.from("results").upsert(rows as any, { onConflict: "student_id,subject_id,session_id,term_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Results saved"); qc.invalidateQueries({ queryKey: ["roster"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = filters.class_id && filters.subject_id && filters.session_id && filters.term_id;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Result entry</h2>
      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Session</Label>
            <Select value={filters.session_id} onValueChange={v => setFilters({ ...filters, session_id: v, term_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{sessions?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={filters.term_id} onValueChange={v => setFilters({ ...filters, term_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{terms.map((t: { id: string; name: string }) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Class</Label>
            <Select value={filters.class_id} onValueChange={v => setFilters({ ...filters, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Subject</Label>
            <Select value={filters.subject_id} onValueChange={v => setFilters({ ...filters, subject_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{subjects?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {ready && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm text-muted-foreground">{students?.length ?? 0} students · 1st CA (20) · 2nd CA (20) · Exam (60) = 100</div>
            <div className="flex flex-wrap items-center gap-2">
              <ScoreImportExport
                ready={!!ready}
                students={(students ?? []).map(s => ({ id: s.id, admission_no: s.admission_no, full_name: s.full_name }))}
                filters={filters}
                currentScores={scores}
                onImported={() => qc.invalidateQueries({ queryKey: ["roster"] })}
              />
              <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />Save results</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Adm No</TableHead><TableHead>Student</TableHead>
              <TableHead className="w-20">1st CA</TableHead><TableHead className="w-20">2nd CA</TableHead>
              <TableHead className="w-20">Exam</TableHead>
              <TableHead className="w-16">Total</TableHead><TableHead>Grade</TableHead><TableHead>Remark</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {students?.map(s => {
                const sc = scores[s.id] ?? { ca1: 0, ca2: 0, exam: 0 };
                const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.exam || 0);
                const grade = total >= 70 ? "A" : total >= 60 ? "B" : total >= 50 ? "C" : total >= 45 ? "D" : "F";
                const upd = (k: "ca1" | "ca2" | "exam", v: string) => setScores({ ...scores, [s.id]: { ...sc, [k]: Number(v) } });
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.admission_no}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell><Input type="number" min={0} max={20} value={sc.ca1} onChange={e => upd("ca1", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" min={0} max={20} value={sc.ca2} onChange={e => upd("ca2", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" min={0} max={60} value={sc.exam} onChange={e => upd("exam", e.target.value)} /></TableCell>
                    <TableCell className="font-semibold">{total}</TableCell>
                    <TableCell><span className={`rounded px-2 py-0.5 text-xs font-medium ${grade === "F" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{grade}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{calcRemark(grade)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}
      {!ready && <Card className="p-12 text-center text-sm text-muted-foreground">Select session, term, class, and subject to enter scores.</Card>}
    </div>
  );
}


