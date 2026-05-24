import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/broadsheet")({ component: BroadsheetPage });

function BroadsheetPage() {
  const [f, setF] = useState({ class_id: "", session_id: "", term_id: "" });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const terms = sessions?.find(s => s.id === f.session_id)?.terms ?? [];

  const { data } = useQuery({
    queryKey: ["broadsheet", f.class_id, f.session_id, f.term_id],
    queryFn: async () => {
      const [{ data: studs }, { data: subs }, { data: results }] = await Promise.all([
        supabase.from("students").select("*").eq("class_id", f.class_id).order("full_name"),
        supabase.from("subjects").select("*").order("name"),
        supabase.from("results").select("*").eq("class_id", f.class_id).eq("session_id", f.session_id).eq("term_id", f.term_id),
      ]);
      return { students: studs ?? [], subjects: subs ?? [], results: results ?? [] };
    },
    enabled: !!(f.class_id && f.session_id && f.term_id),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const usedSubjects = data.subjects.filter(sub => data.results.some(r => r.subject_id === sub.id));
    const built = data.students.map(s => {
      const studentResults = data.results.filter(r => r.student_id === s.id);
      const totals = usedSubjects.map(sub => Number(studentResults.find(r => r.subject_id === sub.id)?.total ?? 0));
      const sum = totals.reduce((a, b) => a + b, 0);
      const filled = totals.filter(t => t > 0).length || 1;
      return { student: s, totals, sum, average: sum / filled };
    });
    const sorted = [...built].sort((a, b) => b.sum - a.sum);
    sorted.forEach((r, i) => ((r as any).position = i + 1));
    return { rows: built.map(b => ({ ...b, position: sorted.find(x => x.student.id === b.student.id)?.position })), subjects: usedSubjects };
  }, [data]);

  const exportCsv = () => {
    if (!rows || !Array.isArray((rows as any).rows)) return;
    const { rows: rs, subjects } = rows as any;
    const header = ["Adm No", "Student", ...subjects.map((s: any) => s.name), "Total", "Average", "Position"].join(",");
    const lines = rs.map((r: any) => [r.student.admission_no, `"${r.student.full_name}"`, ...r.totals, r.sum, r.average.toFixed(1), r.position].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "broadsheet.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <h2 className="font-display text-2xl font-bold">Broadsheet</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button>
          <Button onClick={exportCsv}><Download className="mr-2 size-4" />Export CSV</Button>
        </div>
      </div>
      <Card className="p-6 no-print">
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

      {rows && (rows as any).rows?.length > 0 && (
        <Card className="overflow-x-auto print-page">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adm No</TableHead><TableHead>Student</TableHead>
                {(rows as any).subjects.map((s: any) => <TableHead key={s.id} className="text-center">{s.code ?? s.name.slice(0, 3)}</TableHead>)}
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Avg</TableHead>
                <TableHead className="text-center">Pos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows as any).rows.map((r: any) => (
                <TableRow key={r.student.id}>
                  <TableCell className="font-mono text-xs">{r.student.admission_no}</TableCell>
                  <TableCell className="font-medium">{r.student.full_name}</TableCell>
                  {r.totals.map((t: number, i: number) => <TableCell key={i} className="text-center">{t || "-"}</TableCell>)}
                  <TableCell className="text-center font-semibold">{r.sum}</TableCell>
                  <TableCell className="text-center">{r.average.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{r.position}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
