import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer, FileText, GraduationCap } from "lucide-react";
import { calcGrade } from "@/lib/result-utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/admin/broadsheet")({ component: BroadsheetPage });

type Subject = { id: string; name: string; code: string | null };
type Student = { id: string; admission_no: string; full_name: string; gender: string | null };
type ResultRow = { student_id: string; subject_id: string; total: number | null };

function BroadsheetPage() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [f, setF] = useState({ class_id: "", session_id: "", term_id: "" });

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: async () => (await supabase.from("sessions").select("*, terms(*)").order("created_at", { ascending: false })).data ?? [] });
  const { data: settings } = useQuery({ queryKey: ["school_settings"], queryFn: async () => (await supabase.from("school_settings").select("*").eq("id", 1).maybeSingle()).data });
  const terms = sessions?.find(s => s.id === f.session_id)?.terms ?? [];

  const selectedClass = classes?.find(c => c.id === f.class_id);
  const selectedSession = sessions?.find(s => s.id === f.session_id);
  const selectedTerm = terms.find((t: { id: string; name: string }) => t.id === f.term_id);

  const { data, isLoading } = useQuery({
    queryKey: ["broadsheet", f.class_id, f.session_id, f.term_id],
    queryFn: async () => {
      const [{ data: studs }, { data: subs }, { data: results }] = await Promise.all([
        supabase.from("students").select("id, admission_no, full_name, gender").eq("class_id", f.class_id).order("full_name"),
        supabase.from("subjects").select("id, name, code").order("name"),
        supabase.from("results").select("student_id, subject_id, total").eq("class_id", f.class_id).eq("session_id", f.session_id).eq("term_id", f.term_id),
      ]);
      return { students: (studs ?? []) as Student[], subjects: (subs ?? []) as Subject[], results: (results ?? []) as ResultRow[] };
    },
    enabled: !!(f.class_id && f.session_id && f.term_id),
  });

  const computed = useMemo(() => {
    if (!data) return null;
    const usedSubjects = data.subjects.filter(sub => data.results.some(r => r.subject_id === sub.id));
    const rows = data.students.map(s => {
      const studentResults = data.results.filter(r => r.student_id === s.id);
      const totals = usedSubjects.map(sub => {
        const r = studentResults.find(x => x.subject_id === sub.id);
        return r?.total != null ? Number(r.total) : null;
      });
      const taken = totals.filter((t): t is number => t != null);
      const sum = taken.reduce((a, b) => a + b, 0);
      const average = taken.length ? sum / taken.length : 0;
      return { student: s, totals, sum, average, subjectsTaken: taken.length, position: 0 };
    });
    const ranked = [...rows].sort((a, b) => b.sum - a.sum);
    let rank = 0, prev = -1;
    ranked.forEach((r, i) => {
      if (r.sum !== prev) { rank = i + 1; prev = r.sum; }
      r.position = rank;
    });

    // per-subject stats
    const subjectStats = usedSubjects.map((sub, idx) => {
      const vals = rows.map(r => r.totals[idx]).filter((t): t is number => t != null);
      const passed = vals.filter(v => v >= 45).length;
      return {
        subject: sub,
        highest: vals.length ? Math.max(...vals) : 0,
        lowest: vals.length ? Math.min(...vals) : 0,
        average: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
        passed,
        failed: vals.length - passed,
        entries: vals.length,
      };
    });

    const classGrand = rows.reduce((a, r) => a + r.sum, 0);
    const classAverage = rows.length ? classGrand / rows.length : 0;
    return { rows, subjects: usedSubjects, subjectStats, classAverage };
  }, [data]);

  const exportCsv = () => {
    if (!computed) return;
    const { rows, subjects, subjectStats } = computed;
    const header = ["S/N", "Adm No", "Student", "Gender", ...subjects.map(s => s.code ?? s.name), "Total", "Subjects", "Average", "Position", "Grade"].join(",");
    const lines = rows.map((r, i) => [
      i + 1, r.student.admission_no, `"${r.student.full_name}"`, r.student.gender ?? "",
      ...r.totals.map(t => t ?? ""), r.sum, r.subjectsTaken, r.average.toFixed(1), r.position, calcGrade(r.average),
    ].join(","));
    const stats = [
      ["", "", "Highest", "", ...subjectStats.map(s => s.highest)].join(","),
      ["", "", "Lowest", "", ...subjectStats.map(s => s.lowest)].join(","),
      ["", "", "Average", "", ...subjectStats.map(s => s.average.toFixed(1))].join(","),
    ];
    const blob = new Blob([[header, ...lines, "", ...stats].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `broadsheet-${selectedClass?.name ?? "class"}-${selectedTerm?.name ?? "term"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!sheetRef.current) return;
    const canvas = await html2canvas(sheetRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height) * (canvas.width / canvas.width);
    const w = pageW - 10;
    const h = (canvas.height * w) / canvas.width;
    if (h <= pageH - 10) {
      pdf.addImage(img, "PNG", 5, 5, w, h);
    } else {
      // multi-page slice
      const pageHeightPx = (canvas.width * (pageH - 10)) / w;
      let y = 0, page = 0;
      while (y < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = sliceH;
        slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page++) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 5, 5, w, (sliceH * w) / canvas.width);
        y += sliceH;
      }
    }
    void ratio;
    pdf.save(`broadsheet-${selectedClass?.name ?? "class"}-${selectedTerm?.name ?? "term"}.pdf`);
  };

  const ready = !!(f.class_id && f.session_id && f.term_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="font-display text-2xl font-bold">Broadsheet</h2>
          <p className="text-sm text-muted-foreground">Class-wide result summary with per-subject analytics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!computed} onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button>
          <Button variant="outline" disabled={!computed} onClick={exportCsv}><Download className="mr-2 size-4" />CSV</Button>
          <Button disabled={!computed} onClick={downloadPdf}><FileText className="mr-2 size-4" />PDF</Button>
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
              <SelectContent>{terms.map((t: { id: string; name: string }) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
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

      {!ready && <Card className="p-12 text-center text-sm text-muted-foreground no-print">Select session, term and class to generate the broadsheet.</Card>}
      {ready && isLoading && <Card className="p-12 text-center text-sm text-muted-foreground no-print">Loading…</Card>}
      {ready && computed && computed.rows.length === 0 && <Card className="p-12 text-center text-sm text-muted-foreground no-print">No students in this class yet.</Card>}

      {computed && computed.rows.length > 0 && (
        <div ref={sheetRef} className="rounded-lg border bg-white p-6 text-slate-900 print-page">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="logo" className="size-16 object-contain" />
              ) : (
                <div className="grid size-16 place-items-center rounded-full bg-slate-900 text-white"><GraduationCap className="size-8" /></div>
              )}
              <div>
                <div className="font-display text-xl font-bold uppercase tracking-wide">{settings?.school_name ?? "HisGrace Academy"}</div>
                {settings?.motto && <div className="text-xs italic text-slate-600">{settings.motto}</div>}
                {settings?.address && <div className="text-xs text-slate-600">{settings.address}</div>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-600">
              {settings?.phone && <div>Tel: {settings.phone}</div>}
              {settings?.email && <div>{settings.email}</div>}
            </div>
          </div>

          <div className="mt-3 text-center">
            <div className="font-display text-base font-bold uppercase">Class Broadsheet</div>
            <div className="text-sm">
              <span className="font-semibold">Class:</span> {selectedClass?.name} ·{" "}
              <span className="font-semibold">Session:</span> {selectedSession?.name} ·{" "}
              <span className="font-semibold">Term:</span> {selectedTerm?.name}
            </div>
          </div>

          {/* Main table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-700 px-1.5 py-1 text-left">S/N</th>
                  <th className="border border-slate-700 px-1.5 py-1 text-left">Adm No</th>
                  <th className="border border-slate-700 px-1.5 py-1 text-left">Student</th>
                  <th className="border border-slate-700 px-1 py-1 text-center">G</th>
                  {computed.subjects.map(s => (
                    <th key={s.id} className="border border-slate-700 px-1 py-1 text-center" title={s.name}>
                      {(s.code ?? s.name).slice(0, 4).toUpperCase()}
                    </th>
                  ))}
                  <th className="border border-slate-700 bg-slate-800 px-1.5 py-1 text-center">Tot</th>
                  <th className="border border-slate-700 bg-slate-800 px-1.5 py-1 text-center">Avg</th>
                  <th className="border border-slate-700 bg-slate-800 px-1.5 py-1 text-center">Gr</th>
                  <th className="border border-slate-700 bg-slate-800 px-1.5 py-1 text-center">Pos</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((r, i) => {
                  const grade = calcGrade(r.average);
                  return (
                    <tr key={r.student.id} className={i % 2 ? "bg-slate-50" : ""}>
                      <td className="border border-slate-300 px-1.5 py-1">{i + 1}</td>
                      <td className="border border-slate-300 px-1.5 py-1 font-mono text-[10px]">{r.student.admission_no}</td>
                      <td className="border border-slate-300 px-1.5 py-1 font-medium">{r.student.full_name}</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">{r.student.gender?.[0] ?? "-"}</td>
                      {r.totals.map((t, idx) => (
                        <td key={idx} className={`border border-slate-300 px-1 py-1 text-center ${t != null && t < 45 ? "text-red-600 font-semibold" : ""}`}>
                          {t ?? "-"}
                        </td>
                      ))}
                      <td className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold">{r.sum}</td>
                      <td className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center">{r.average.toFixed(1)}</td>
                      <td className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold">{grade}</td>
                      <td className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-bold">{r.position}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-semibold">
                  <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right">Subject Highest</td>
                  {computed.subjectStats.map(s => <td key={s.subject.id} className="border border-slate-400 px-1 py-1 text-center">{s.highest}</td>)}
                  <td colSpan={4} className="border border-slate-400"></td>
                </tr>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right">Subject Lowest</td>
                  {computed.subjectStats.map(s => <td key={s.subject.id} className="border border-slate-400 px-1 py-1 text-center">{s.lowest}</td>)}
                  <td colSpan={4} className="border border-slate-400"></td>
                </tr>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right">Subject Average</td>
                  {computed.subjectStats.map(s => <td key={s.subject.id} className="border border-slate-400 px-1 py-1 text-center">{s.average.toFixed(1)}</td>)}
                  <td colSpan={4} className="border border-slate-400"></td>
                </tr>
                <tr className="bg-emerald-50 font-semibold">
                  <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right text-emerald-700">Passed (≥45)</td>
                  {computed.subjectStats.map(s => <td key={s.subject.id} className="border border-slate-400 px-1 py-1 text-center text-emerald-700">{s.passed}</td>)}
                  <td colSpan={4} className="border border-slate-400"></td>
                </tr>
                <tr className="bg-red-50 font-semibold">
                  <td colSpan={4} className="border border-slate-400 px-1.5 py-1 text-right text-red-700">Failed (&lt;45)</td>
                  {computed.subjectStats.map(s => <td key={s.subject.id} className="border border-slate-400 px-1 py-1 text-center text-red-700">{s.failed}</td>)}
                  <td colSpan={4} className="border border-slate-400"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 grid gap-4 text-[11px] md:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold">Subject Key</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {computed.subjects.map(s => (
                  <div key={s.id} className="flex justify-between">
                    <span className="font-mono">{(s.code ?? s.name).slice(0, 4).toUpperCase()}</span>
                    <span className="text-slate-600">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold">Grading Scale</div>
              <div className="grid grid-cols-5 gap-1 text-center">
                <div className="rounded border px-1 py-0.5">A · 70-100</div>
                <div className="rounded border px-1 py-0.5">B · 60-69</div>
                <div className="rounded border px-1 py-0.5">C · 50-59</div>
                <div className="rounded border px-1 py-0.5">D · 45-49</div>
                <div className="rounded border px-1 py-0.5">F · 0-44</div>
              </div>
              <div className="mt-2 text-slate-600">
                Students: <strong>{computed.rows.length}</strong> ·
                Subjects offered: <strong>{computed.subjects.length}</strong> ·
                Class average: <strong>{computed.classAverage.toFixed(1)}</strong>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
            <div>
              <div className="border-t border-slate-400 pt-1 text-center">Class Teacher's Signature & Date</div>
            </div>
            <div>
              {settings?.principal_signature_url && (
                <img src={settings.principal_signature_url} alt="sig" className="mx-auto mb-1 h-10 object-contain" />
              )}
              <div className="border-t border-slate-400 pt-1 text-center">
                {settings?.principal_name ?? "Principal"}'s Signature & Date
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
